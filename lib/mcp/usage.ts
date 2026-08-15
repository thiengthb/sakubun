import { prisma } from '@/lib/db/db';
import { MCP_CATALOG } from '@/lib/mcp/catalog';

const MAX_ERROR_CHARS = 400;

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
  inCatalog: boolean;
}

export interface ToolUsageReport {
  rows: ToolUsageRow[];
  neverCalled: string[];
  toolCount: number;
}

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
