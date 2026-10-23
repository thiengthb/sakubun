import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createTestDb, resetLearningData } from '@/lib/db/test-db';
import type { McpProfile } from '@/lib/mcp/profiles';
import { estimateTokens } from '@/lib/mcp/token-estimate';

// What the MCP server costs a client in tokens, measured on the real protocol: a client connects
// in memory and reads exactly what Claude would read. The numbers are printed on every run so CI
// logs show them. Ceilings stop the surface from growing while the rewrite is under way
// (docs/roadmap.md); phase 3 replaces them with the v2 targets (tool definitions under 2,000, the
// opening protocol under 1,500, each tool result under 300).

createTestDb('sakubun-tokens-');

// Baseline measured 2026-10-23: full 14,289 · tutor 8,521 · practice prompt 7,902 · get_due_items 901.
// Each ceiling is that baseline plus about 5%.
const CEILING = {
  fullToolDefinitions: 15_000,
  tutorToolDefinitions: 9_000,
  practicePrompt: 8_300,
  dueItemsResult: 1_000,
};

type Db = typeof import('@/lib/db/db');
let prisma: Db['prisma'];
const clients: Client[] = [];

async function connect(profile: McpProfile): Promise<Client> {
  const { registerAll } = await import('@/lib/mcp/server');
  const server = new McpServer({ name: 'sakubun-mcp', version: '0.1.0' });
  registerAll(server, profile);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client({ name: 'token-budget', version: '0.0.0' });
  await client.connect(clientSide);
  clients.push(client);
  return client;
}

async function toolDefinitionTokens(profile: McpProfile) {
  const client = await connect(profile);
  const { tools } = await client.listTools();
  return { count: tools.length, tokens: estimateTokens(JSON.stringify(tools)) };
}

function resultText(result: unknown): string {
  const content = (result as { content?: { type: string; text?: string }[] }).content ?? [];
  return content.map((c) => c.text ?? '').join('\n');
}

const report: string[] = [];

beforeAll(async () => {
  ({ prisma } = await import('@/lib/db/db'));
  await resetLearningData(prisma);
  const P = await import('@/lib/library/practice');
  await P.addItems(
    [
      { expression: '〜ばかりに', meaningVi: 'chỉ vì... (dẫn đến kết quả xấu)', level: 'N2' },
      { expression: '〜ながら', meaningVi: 'vừa... vừa...', level: 'N5' },
      { expression: '〜てしまう', meaningVi: 'lỡ, xong mất', level: 'N4' },
    ],
    'MCP',
    'GRAMMAR',
  );
  await P.addItems(
    [
      { expression: '約束', reading: 'やくそく', meaningVi: 'hứa; lời hứa', level: 'N4' },
      { expression: '急ぐ', reading: 'いそぐ', meaningVi: 'vội, khẩn trương', level: 'N4' },
    ],
    'MCP',
    'VOCAB',
  );
});

afterAll(async () => {
  process.stdout.write(
    `\nMCP token estimate (lib/mcp/token-estimate.ts)\n${report.join('\n')}\n\n`,
  );
  await Promise.all(clients.map((c) => c.close()));
});

describe('MCP token footprint', () => {
  it('tool definitions, full profile (Claude Desktop)', async () => {
    const { count, tokens } = await toolDefinitionTokens('full');
    report.push(`  tool definitions, full:  ${count} tools, ~${tokens} tokens`);
    expect(tokens).toBeLessThanOrEqual(CEILING.fullToolDefinitions);
  });

  it('tool definitions, tutor profile (Hermes)', async () => {
    const { count, tokens } = await toolDefinitionTokens('tutor');
    report.push(`  tool definitions, tutor: ${count} tools, ~${tokens} tokens`);
    expect(tokens).toBeLessThanOrEqual(CEILING.tutorToolDefinitions);
  });

  it('opening prompt of a translation session', async () => {
    const client = await connect('full');
    const prompt = await client.getPrompt({ name: 'practice' });
    const text = prompt.messages
      .map((m) => (m.content.type === 'text' ? m.content.text : ''))
      .join('\n');
    const tokens = estimateTokens(text);
    report.push(`  prompt "practice":       ${text.length} chars, ~${tokens} tokens`);
    expect(tokens).toBeLessThanOrEqual(CEILING.practicePrompt);
  });

  it('first tool result of a turn (get_due_items)', async () => {
    const client = await connect('full');
    const result = await client.callTool({ name: 'get_due_items', arguments: {} });
    const text = resultText(result);
    expect(result.isError).not.toBe(true);
    const tokens = estimateTokens(text);
    report.push(`  result get_due_items:    ${text.length} chars, ~${tokens} tokens`);
    expect(tokens).toBeLessThanOrEqual(CEILING.dueItemsResult);
  });
});
