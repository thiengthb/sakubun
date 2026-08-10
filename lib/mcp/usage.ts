import { prisma } from '@/lib/db';
import { MCP_CATALOG } from '@/lib/mcp/catalog';

// Which MCP tools get used, and which of them fail — persisted, because the log is not.
//
// `guard()` (lib/mcp/tool-kit.ts) has always printed `[mcp] tool=<name> ms=<n>` per call and
// `[mcp] tool=<name> error` per failure. Both go to stdout, so both are gone the next time the
// container restarts. That left two questions unanswerable: what does Claude actually call (issue #20
// argues about trimming 31 tools on 12 calls of evidence), and what is quietly broken (a throwing tool
// still answers HTTP 200 — see McpToolCall in schema.prisma).
//
// This module is the only writer and the only reader of that table. `guard()` does NOT import it:
// it takes a recorder through `setToolCallRecorder`, which is what keeps tool-kit.ts free of Prisma.

/** Enough of a message to recognise the failure; the full stack is still in the container log. */
const MAX_ERROR_CHARS = 400;

/**
 * Count one finished tool call. `error` is the raw error message when the call failed, null when it
 * succeeded.
 *
 * Throws if the write fails — deliberately. The caller that must not fail is `guard()`, and it
 * swallows this on purpose (a diagnostic must never turn a good tool call into a bad one). Making the
 * failure invisible HERE too would mean nothing could ever test that the write happens at all.
 */
export async function recordToolCall(
  name: string,
  ms: number,
  error: string | null = null,
): Promise<void> {
  const now = new Date();
  const failed = error !== null;
  const message = failed ? error.slice(0, MAX_ERROR_CHARS) : null;

  await prisma.mcpToolCall.upsert({
    where: { name },
    create: {
      name,
      calls: 1,
      errors: failed ? 1 : 0,
      lastMs: ms,
      lastError: message,
      lastErrorAt: failed ? now : null,
      firstCalledAt: now,
      lastCalledAt: now,
    },
    update: {
      calls: { increment: 1 },
      // `undefined` means "leave alone" in Prisma, so a successful call keeps the previous failure
      // count AND the previous message: the last error is worth more than the fact it has stopped
      // being the most recent event.
      errors: failed ? { increment: 1 } : undefined,
      lastMs: ms,
      lastError: failed ? message : undefined,
      lastErrorAt: failed ? now : undefined,
      lastCalledAt: now,
    },
  });
}

export interface ToolUsageRow {
  name: string;
  calls: number;
  errors: number;
  lastMs: number | null;
  lastError: string | null;
  lastCalledAt: string;
  /** False for a row left behind by a tool that has since been renamed or removed. */
  inCatalog: boolean;
}

export interface ToolUsageReport {
  /** Tools that have been called at least once, busiest first. */
  rows: ToolUsageRow[];
  /** Catalog tools with no row at all — the answer to "what is Claude never reaching for". */
  neverCalled: string[];
  /** How many tools the catalog advertises, so `neverCalled.length` has a denominator. */
  toolCount: number;
}

/** All tool names the app advertises (prompts are not tools and are not counted). */
function catalogToolNames(): string[] {
  return MCP_CATALOG.filter((e) => e.kind === 'tool').map((e) => e.name);
}

export async function readToolUsage(): Promise<ToolUsageReport> {
  const recorded = await prisma.mcpToolCall.findMany({
    orderBy: [{ calls: 'desc' }, { name: 'asc' }],
  });
  const seen = new Set(recorded.map((r) => r.name));
  const names = catalogToolNames();

  return {
    rows: recorded.map((r) => ({
      name: r.name,
      calls: r.calls,
      errors: r.errors,
      lastMs: r.lastMs,
      lastError: r.lastError,
      lastCalledAt: r.lastCalledAt.toISOString(),
      inCatalog: names.includes(r.name),
    })),
    neverCalled: names.filter((n) => !seen.has(n)),
    toolCount: names.length,
  };
}
