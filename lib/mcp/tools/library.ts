import { z } from 'zod';
import { prisma } from '@/lib/db/db';
import type { UserDb } from '@/lib/db/user-db';
import { stripDecoration } from '@/lib/core/normalize';
import { ensureOpenJlptLibrary } from '@/lib/library/seed';
import {
  GROUP_TYPE,
  listGroupEntries,
  OPENJLPT_ORIGIN,
  PUBLIC,
  searchEntries,
} from '@/lib/library/shared';
import { ownedItems, takeEntry, takeGroup } from '@/lib/library/take';
import { guard, learnerDb, mcpError, type McpServer, type ToolExtra } from '@/lib/mcp/tool-kit';
import { JLPT_LEVELS } from '@/lib/settings/schema';

// Kho chung over MCP (phase 8, L5; plan rule 11): the AI searches the shared library with the learner
// and takes from it when they agree. Publishing stays on the web (rule 4), so there is no tool for it.

function text(lines: (string | null | false)[]) {
  return { content: [{ type: 'text' as const, text: lines.filter(Boolean).join('\n') }] };
}

const MAX_SHOWN = 6;

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

export function registerLibraryTools(server: McpServer): void {
  server.tool(
    'library_search',
    'Search Kho chung, the shared library anyone can take from: patterns, words, ready-made groups.',
    {
      query: z
        .string()
        .min(1)
        .describe('Japanese, reading, Vietnamese meaning, or a group name like N5'),
      kind: z.enum(['GRAMMAR', 'VOCAB']).optional(),
      level: z.enum(JLPT_LEVELS).optional(),
    },
    guard(
      'library_search',
      async (
        args: { query: string; kind?: 'GRAMMAR' | 'VOCAB'; level?: string },
        extra: ToolExtra,
      ) => {
        const db = learnerDb(extra);
        const lines = await findShared(db, args.query, args);
        const q = args.query.trim().toLowerCase();
        const groups = (await listGroupEntries(prisma, { level: args.level }))
          .filter((g) => g.name?.toLowerCase().includes(q))
          .slice(0, 3)
          .map((g) => `entryId ${g.id} · group "${g.name}" · ${g.size} items`);
        if (lines.length + groups.length === 0) {
          return text([`Nothing in Kho chung matches "${args.query}".`, 'next: offer add_items.']);
        }
        return text([
          ...groups,
          ...lines,
          'next: library_take with an entryId, only after the learner agrees.',
        ]);
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
        where: { id: entryId, status: PUBLIC },
        select: { type: true, name: true, expression: true },
      });
      if (!entry) return mcpError('Unknown entryId. Call library_search for a current one.');
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
