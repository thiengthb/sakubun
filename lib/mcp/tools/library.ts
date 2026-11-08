import { z } from 'zod';
import { prisma } from '@/lib/db/db';
import type { UserDb } from '@/lib/db/user-db';
import { stripDecoration } from '@/lib/core/normalize';
import { ensureOpenJlptLibrary } from '@/lib/library/seed';
import {
  GROUP_TYPE,
  listGroupEntries,
  OPENJLPT_ORIGIN,
  SCRIPT_TYPE,
  searchEntries,
  VISIBLE,
} from '@/lib/library/shared';
import { ownedItems, takeEntry, takeGroup } from '@/lib/library/take';
import { listScriptEntries, scriptCopies, takeScript } from '@/lib/library/scripts';
import { scriptLink } from '@/lib/mcp/tools/kaiwa';
import { guard, learnerDb, mcpError, type McpServer, type ToolExtra } from '@/lib/mcp/tool-kit';
import { JLPT_LEVELS } from '@/lib/settings/schema';

// Kho chung over MCP (phase 8, L5; plan rule 11): the AI searches the shared library with the learner
// and takes from it when they agree, Kaiwa scripts included (thien, 2026-11-07). Publishing stays on
// the web (rule 4), so there is no tool for it.

function text(lines: (string | null | false)[]) {
  return { content: [{ type: 'text' as const, text: lines.filter(Boolean).join('\n') }] };
}

const MAX_SHOWN = 6;
const TAKE_NEXT = 'next: library_take with an entryId, only after the learner agrees.';

type Entry = Awaited<ReturnType<typeof searchEntries>>[number];

export function entryLine(e: Entry, owned: boolean): string {
  const reading = e.reading ? ` (${e.reading})` : '';
  const origin = e.origin === OPENJLPT_ORIGIN ? 'OpenJLPT' : `shared, ${e.takeCount} takes`;
  return `entryId ${e.id} · ${e.expression}${reading} · ${e.type.toLowerCase()} ${e.level} · ${origin} · ${e.meaningVi}${owned ? ' · already in library' : ''}`;
}

// Entries matching a query, with which the learner already has.
export async function findShared(
  db: UserDb,
  query: string,
  {
    kind,
    level,
    take = MAX_SHOWN,
  }: { kind?: 'GRAMMAR' | 'VOCAB'; level?: string; take?: number } = {},
) {
  const needle = stripDecoration(query.normalize('NFKC'));
  if (!needle) return [];
  await ensureOpenJlptLibrary();
  const entries = await searchEntries(prisma, { text: needle, type: kind, level, take });
  const owned = await ownedItems(db, entries);
  return entries.map((e) => entryLine(e, owned.has(e.id)));
}

// Shared Kaiwa scripts whose title or text holds the query, with which the learner has a copy of.
export async function findSharedScripts(db: UserDb, query: string, take: number) {
  const scripts = await listScriptEntries(prisma, { text: query.normalize('NFKC'), take });
  const copies = await scriptCopies(db, scripts);
  return scripts.map(
    (s) =>
      `entryId ${s.id} · script "${s.title}" · ${s.lineCount} lines · parts ${s.speakers.join(', ') || 'none'} · ${s.takeCount} takes${copies.has(s.id) ? ' · already in Kaiwa' : ''}`,
  );
}

export function registerLibraryTools(server: McpServer): void {
  server.tool(
    'library_search',
    'Search Kho chung, the shared library anyone can take from: patterns, words, groups, Kaiwa scripts.',
    {
      query: z
        .string()
        .min(1)
        .describe('Japanese, reading, Vietnamese meaning, a group name like N5, or a scene'),
      kind: z.enum(['GRAMMAR', 'VOCAB', 'SCRIPT']).optional(),
      level: z.enum(JLPT_LEVELS).optional(),
    },
    guard(
      'library_search',
      async (
        args: { query: string; kind?: 'GRAMMAR' | 'VOCAB' | 'SCRIPT'; level?: string },
        extra: ToolExtra,
      ) => {
        const db = learnerDb(extra);
        if (args.kind === 'SCRIPT') {
          const scripts = await findSharedScripts(db, args.query, MAX_SHOWN);
          if (scripts.length === 0)
            return text([
              `No shared Kaiwa script matches "${args.query}".`,
              'next: offer to write one with the kaiwa prompt.',
            ]);
          return text([...scripts, TAKE_NEXT]);
        }
        const kind = args.kind;
        const lines = await findShared(db, args.query, { ...args, kind });
        const q = args.query.trim().toLowerCase();
        const groups = (await listGroupEntries(prisma, { level: args.level }))
          .filter((g) => g.name?.toLowerCase().includes(q))
          .slice(0, 3)
          .map((g) => `entryId ${g.id} · group "${g.name}" · ${g.size} items`);
        // Scripts have no kind or level: a search narrowed by either is about items.
        const scripts = kind || args.level ? [] : await findSharedScripts(db, args.query, 3);
        if (lines.length + groups.length + scripts.length === 0) {
          return text([`Nothing in Kho chung matches "${args.query}".`, 'next: offer add_items.']);
        }
        return text([...groups, ...lines, ...scripts, TAKE_NEXT]);
      },
    ),
  );

  server.tool(
    'library_take',
    "Copy an entry or a group from Kho chung into the learner's library, only after they agree.",
    { entryId: z.string() },
    guard('library_take', async ({ entryId }: { entryId: string }, extra: ToolExtra) => {
      const db = learnerDb(extra);
      const entry = await prisma.libraryEntry.findFirst({
        where: { id: entryId, ...VISIBLE },
        select: { type: true, name: true, expression: true },
      });
      if (!entry) return mcpError('Unknown entryId. Call library_search for a current one.');
      if (entry.type === SCRIPT_TYPE) {
        const res = await takeScript(db, entryId);
        if (!res.ok) return mcpError(res.error);
        return text([
          `${res.data.already ? 'already had' : 'took'} script "${entry.name}" as scriptId ${res.data.scriptId}`,
          `view: ${scriptLink(res.data.scriptId)}`,
          "next: kaiwa_roleplay with that scriptId and the learner's part practises it now.",
        ]);
      }
      if (entry.type === GROUP_TYPE) {
        const res = await takeGroup(db, entryId);
        if (!res.ok) return mcpError(res.error);
        return text([
          `took group "${entry.name}" as groupId ${res.data.groupId}: ${res.data.added} new, ${res.data.already} already in library`,
          'next: next_turn practises what is due.',
        ]);
      }
      const res = await takeEntry(db, entryId);
      if (!res.ok) return mcpError(res.error);
      return text([
        `${res.data.already ? 'already had' : 'took'} ${entry.expression} as itemId ${res.data.itemId}`,
        'next: next_turn with that itemId practises it now.',
      ]);
    }),
  );
}
