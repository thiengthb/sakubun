import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { UserDb } from '@/lib/db/user-db';
import { signInTransport } from '@/lib/mcp/test-auth';
import { createTestUser, createTestDb, resetLearningData } from '@/lib/db/test-db';
import type { McpProfile } from '@/lib/mcp/profiles';
import { estimateTokens } from '@/lib/mcp/token-estimate';

// What the MCP server costs a client in tokens, measured on the real protocol: a client connects
// in memory and reads exactly what Claude would read. The numbers are printed on every run so CI
// logs show them. The targets come from docs/roadmap.md (phase 3): tool definitions under 2,000, the
// opening protocol under 1,500, each tool result under 300. Before v2 the default surface cost
// ~14,300 tokens of definitions plus a ~7,900-token practice prompt (baseline 2026-10-23).

createTestDb('sakubun-tokens-');

// The v2 targets from docs/roadmap.md, enforced on the default profile.
const V2_TARGET = {
  toolDefinitions: 2_000,
  protocol: 1_500,
  result: 300,
};

// One sentence per seeded item that passes stage_turn's checks.
const V2_SENTENCES: Record<string, { ja: string; vi: string }> = {
  '〜ばかりに': {
    ja: '少し遅れたばかりに、電車に乗れなかった。',
    vi: 'Chỉ vì trễ một chút mà lỡ tàu.',
  },
  '〜ながら': { ja: '音楽を聞きながら勉強します。', vi: 'Tôi vừa nghe nhạc vừa học.' },
  '〜てしまう': { ja: '財布を忘れてしまいました。', vi: 'Tôi lỡ quên mất ví.' },
  約束: { ja: '友達と約束をしました。', vi: 'Tôi đã hứa với bạn.' },
  急ぐ: { ja: '急いで駅へ行きました。', vi: 'Tôi vội đi ra ga.' },
};

type Db = typeof import('@/lib/db/db');
let prisma: Db['prisma'];
let db: UserDb;
const clients: Client[] = [];

async function connect(profile: McpProfile): Promise<Client> {
  const { registerAll } = await import('@/lib/mcp/server');
  const server = new McpServer({ name: 'sakubun-mcp', version: '0.1.0' });
  registerAll(server, profile);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  signInTransport(clientSide, 'learner');
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
  db = (await import('@/lib/db/user-db')).userDb(await createTestUser(prisma, 'learner'));
  await resetLearningData(prisma);
  const P = await import('@/lib/library/practice');
  await P.addItems(
    db,
    [
      { expression: '〜ばかりに', meaningVi: 'chỉ vì... (dẫn đến kết quả xấu)', level: 'N2' },
      { expression: '〜ながら', meaningVi: 'vừa... vừa...', level: 'N5' },
      { expression: '〜てしまう', meaningVi: 'lỡ, xong mất', level: 'N4' },
    ],
    'MCP',
    'GRAMMAR',
  );
  await P.addItems(
    db,
    [
      { expression: '約束', reading: 'やくそく', meaningVi: 'hứa; lời hứa', level: 'N4' },
      { expression: '急ぐ', reading: 'いそぐ', meaningVi: 'vội, khẩn trương', level: 'N4' },
    ],
    'MCP',
    'VOCAB',
  );
  // A small Kho chung (phase 8), so library_search is measured without seeding all of OpenJLPT.
  await (
    await import('@/lib/library/shared')
  ).seedOpenJlpt(
    prisma,
    ['〜ながら', '〜ために', '〜ばかり'].map((expression) => ({
      id: `GRAMMAR-${expression}`,
      kind: 'GRAMMAR',
      expression,
      reading: null,
      hanviet: null,
      meaningVi: `nghĩa của ${expression}`,
      level: 'N5',
      notes: '',
      tags: '[]',
      source: 'OPENJLPT' as const,
      suspended: false,
      starred: false,
    })),
  );
});

afterAll(async () => {
  process.stdout.write(
    `\nMCP token estimate (lib/mcp/token-estimate.ts)\n${report.join('\n')}\n\n`,
  );
  await Promise.all(clients.map((c) => c.close()));
});

describe('MCP v2 token targets', () => {
  it('tool definitions', async () => {
    const { count, tokens } = await toolDefinitionTokens('v2');
    report.push(`  v2 tool definitions:     ${count} tools, ~${tokens} tokens`);
    expect(tokens).toBeLessThanOrEqual(V2_TARGET.toolDefinitions);
  });

  it.each(['hoc', 'kaiwa'])('protocol (the %s prompt)', async (name) => {
    const client = await connect('v2');
    const prompt = await client.getPrompt({ name });
    const text = prompt.messages
      .map((m) => (m.content.type === 'text' ? m.content.text : ''))
      .join('\n');
    const tokens = estimateTokens(text);
    report.push(
      `  v2 prompt "${name}":${' '.repeat(14 - name.length)}${text.length} chars, ~${tokens} tokens`,
    );
    expect(tokens).toBeLessThanOrEqual(V2_TARGET.protocol);
  });

  it('every result of a ten-turn session', async () => {
    const client = await connect('v2');
    const sizes = new Map<string, number>();
    const call = async (name: string, args: Record<string, unknown> = {}) => {
      const result = await client.callTool({ name, arguments: args });
      const text = resultText(result);
      expect(result.isError, `${name}: ${text}`).not.toBe(true);
      sizes.set(name, Math.max(sizes.get(name) ?? 0, estimateTokens(text)));
      return text;
    };

    const items = await db.item.findMany({ select: { id: true, expression: true } });
    for (let turn = 0; turn < 10; turn++) {
      const item = items[turn % items.length];
      await call('next_turn', { itemId: item.id, hint: turn === 0 ? 'chủ đề du lịch' : undefined });
      const staged = await call('stage_turn', {
        itemId: item.id,
        ...V2_SENTENCES[item.expression],
      });
      const turnId = staged.split('\n')[0].replace('turnId ', '');
      await call('grade_turn', {
        turnId,
        answer: 'Câu trả lời của người học.',
        rating: turn % 3 === 0 ? 2 : 3,
        errorTags: turn % 3 === 0 ? ['particle'] : undefined,
        feedback: 'Đúng ý, nhưng trợ từ に dùng chưa chuẩn.',
      });
    }
    await call('lookup', { query: 'ながら' });
    await call('status');
    await call('next_turn');
    // kaiwa_get is left out: it returns the script itself, as long as the learner made it.
    await call('kaiwa_save', { title: 'Ở ga', body: 'A: 駅はどこですか。 | Nhà ga ở đâu?' });
    await call('kaiwa_list');
    await call('library_search', { query: 'N5' });
    await call('lookup', { query: 'ために' });

    const largest = Math.max(...sizes.values());
    report.push(
      `  v2 results (max):        ${[...sizes].map(([n, t]) => `${n} ~${t}`).join(', ')}`,
    );
    expect(largest).toBeLessThanOrEqual(V2_TARGET.result);
  });
});
