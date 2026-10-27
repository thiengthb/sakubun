import { z } from 'zod';
import { appLink } from '@/lib/core/app-url';
import { parseScript } from '@/lib/kaiwa/parse';
import { getScript, listScripts, saveScript } from '@/lib/kaiwa/scripts';
import { guard, learnerDb, mcpError, type McpServer, type ToolExtra } from '@/lib/mcp/tool-kit';

// Kaiwa over MCP (phase 8, K2): the learner and their AI draft a script on the AI's own canvas,
// then the AI saves it here, so nothing is copied by hand. The format check and the guard against
// overwriting newer work live in lib/kaiwa/scripts.ts, not in these descriptions.

function text(lines: (string | null | false)[]) {
  return { content: [{ type: 'text' as const, text: lines.filter(Boolean).join('\n') }] };
}

const day = (d: Date) => d.toISOString().slice(0, 10);

export const scriptLink = (id: string) => appLink(`/kaiwa/${id}`);

export function registerKaiwaTools(server: McpServer): void {
  server.tool(
    'kaiwa_list',
    "List the learner's Kaiwa scripts, titles only.",
    {},
    guard('kaiwa_list', async (_args: Record<string, never>, extra: ToolExtra) => {
      const scripts = await listScripts(learnerDb(extra));
      if (scripts.length === 0) {
        return text(['No scripts yet.', 'next: draft one with the learner, then kaiwa_save.']);
      }
      return text([
        ...scripts.map(
          (s) => `scriptId ${s.id} · version ${s.version} · ${day(s.updatedAt)} · ${s.title}`,
        ),
        'next: kaiwa_get reads one.',
      ]);
    }),
  );

  server.tool(
    'kaiwa_get',
    'Read one Kaiwa script with its version, before changing it.',
    { scriptId: z.string() },
    guard('kaiwa_get', async ({ scriptId }: { scriptId: string }, extra: ToolExtra) => {
      const script = await getScript(learnerDb(extra), scriptId);
      if (!script) return mcpError('Unknown scriptId. Call kaiwa_list for a current one.');
      return text([
        `scriptId ${script.id} · version ${script.version} · ${script.title}`,
        script.body,
        `next: edit with the learner, then kaiwa_save with scriptId and version ${script.version}.`,
      ]);
    }),
  );

  server.tool(
    'kaiwa_save',
    'Save a Kaiwa script, only after the learner approves the draft. No scriptId: a new script.',
    {
      title: z.string(),
      body: z
        .string()
        .describe(
          'One line each: "A: 日本語 | tiếng Việt", or "日本語 | tiếng Việt" for monologue',
        ),
      scriptId: z.string().optional(),
      version: z.number().int().optional().describe('From kaiwa_get; required with scriptId'),
    },
    guard(
      'kaiwa_save',
      async (
        args: { title: string; body: string; scriptId?: string; version?: number },
        extra: ToolExtra,
      ) => {
        const saved = await saveScript(learnerDb(extra), {
          id: args.scriptId,
          version: args.version,
          title: args.title,
          body: args.body,
        });
        if (!saved.ok) return mcpError(saved.error);
        const lines = parseScript(args.body).length;
        return text([
          `saved scriptId ${saved.data.id} · version ${saved.data.version} · ${lines} lines`,
          `view: ${scriptLink(saved.data.id)}`,
          'next: give the learner the view link.',
        ]);
      },
    ),
  );
}
