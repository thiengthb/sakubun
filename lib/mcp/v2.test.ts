import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createTestDb, resetLearningData } from '@/lib/db/test-db';

// The v2 tools over the real MCP protocol (an in-memory client reads exactly what Claude reads):
// one whole turn, the errors a model hits, and the library and status tools.

createTestDb('sakubun-mcp-v2-');

type Db = typeof import('@/lib/db/db');
let prisma: Db['prisma'];
let client: Client;

async function call(name: string, args: Record<string, unknown> = {}) {
  const result = (await client.callTool({ name, arguments: args })) as {
    content: { text: string }[];
    isError?: boolean;
  };
  return { text: result.content.map((c) => c.text).join('\n'), isError: result.isError === true };
}

function field(text: string, key: string): string {
  const line = text.split('\n').find((l) => l.startsWith(`${key} `));
  if (!line) throw new Error(`no "${key}" line in:\n${text}`);
  return line.slice(key.length + 1).trim();
}

beforeAll(async () => {
  ({ prisma } = await import('@/lib/db/db'));
  const { registerAll } = await import('@/lib/mcp/server');
  const server = new McpServer({ name: 'sakubun-mcp', version: '0.1.0' });
  registerAll(server, 'v2');
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  client = new Client({ name: 'v2-test', version: '0.0.0' });
  await client.connect(clientSide);
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await resetLearningData(prisma);
  const P = await import('@/lib/library/practice');
  await P.saveSettings({ grammarLevels: ['N2'], dailyNewGrammar: 2, dailyNewVocab: 0 });
  await P.addItems(
    [{ expression: '〜ばかりに', meaningVi: 'chỉ vì... (kết quả xấu)', level: 'N2' }],
    'MCP',
    'GRAMMAR',
  );
});

describe('MCP v2', () => {
  it('lists exactly the seven tools and the hoc prompt', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      [
        'add_items',
        'grade_turn',
        'lookup',
        'next_turn',
        'skip_turn',
        'stage_turn',
        'status',
      ].sort(),
    );
    const { prompts } = await client.listPrompts();
    expect(prompts.map((p) => p.name)).toEqual(['hoc']);
  });

  it('runs one whole turn and each result names the next call', async () => {
    const next = await call('next_turn');
    expect(next.isError).toBe(false);
    expect(next.text).toContain('item 〜ばかりに');
    expect(next.text).toContain('write JA_VI');
    expect(next.text).toMatch(/next: .*stage_turn/);
    const itemId = field(next.text, 'item').split('itemId ')[1];

    const staged = await call('stage_turn', {
      itemId,
      ja: '少し遅れたばかりに、電車に乗れなかった。',
      vi: 'Chỉ vì trễ một chút mà không lên được tàu.',
    });
    expect(staged.isError).toBe(false);
    expect(field(staged.text, 'show:')).toBe('少し遅れたばかりに、電車に乗れなかった。');
    expect(staged.text).toMatch(/next: .*grade_turn/);

    const graded = await call('grade_turn', {
      turnId: field(staged.text, 'turnId'),
      answer: 'Chỉ vì trễ nên lỡ tàu.',
      rating: 3,
    });
    expect(graded.isError).toBe(false);
    expect(graded.text).toMatch(/^graded 3 \(Good\) · next review in /);
    expect(graded.text).toMatch(/next: .*next_turn/);
    expect(await prisma.reviewLog.count({ where: { channel: 'mcp' } })).toBe(1);
  });

  it('returns a rule break as a tool error naming the fix, and writes nothing', async () => {
    const next = await call('next_turn');
    const itemId = field(next.text, 'item').split('itemId ')[1];
    const staged = await call('stage_turn', {
      itemId,
      ja: '少し遅れたせいで、電車に乗れなかった。',
      vi: 'Vì trễ một chút mà không lên được tàu.',
    });
    expect(staged).toEqual({
      isError: true,
      text: 'ja does not use 〜ばかりに. Rewrite it around 〜ばかりに, or pass uses: the exact words in ja that use it.',
    });
    expect(await prisma.turn.count()).toBe(0);

    const graded = await call('grade_turn', { turnId: 'nope', answer: 'x', rating: 3 });
    expect(graded).toEqual({
      isError: true,
      text: 'Unknown turnId. Call next_turn, then stage_turn.',
    });
  });

  it('skips a turn without touching the schedule', async () => {
    const next = await call('next_turn');
    const itemId = field(next.text, 'item').split('itemId ')[1];
    const staged = await call('stage_turn', {
      itemId,
      ja: '少し遅れたばかりに、電車に乗れなかった。',
      vi: 'Chỉ vì trễ một chút mà không lên được tàu.',
    });
    const skipped = await call('skip_turn', { turnId: field(staged.text, 'turnId') });
    expect(skipped).toEqual({
      isError: false,
      text: 'skipped, schedule unchanged.\nnext: call next_turn.',
    });
    expect(await prisma.reviewLog.count()).toBe(0);
  });

  it('says when nothing is left today', async () => {
    const P = await import('@/lib/library/practice');
    await P.saveSettings({ dailyNewGrammar: 0 });
    const next = await call('next_turn');
    expect(next.isError).toBe(false);
    expect(next.text).toMatch(/^Nothing to study now\./);
  });

  it('finds items, adds new ones, and reports status', async () => {
    const found = await call('lookup', { query: '「〜ばかりに」' });
    expect(found.text).toMatch(/· 〜ばかりに · grammar N2 · new · chỉ vì/);
    const none = await call('lookup', { query: '〜わけがない' });
    expect(none.text).toContain('No item matches');

    const added = await call('add_items', {
      kind: 'VOCAB',
      items: [{ expression: '急ぐ', reading: 'いそぐ', meaningVi: 'vội', level: 'N4' }],
    });
    expect(added.text).toMatch(/^added 1/);
    expect((await call('lookup', { query: 'いそぐ', kind: 'VOCAB' })).text).toContain(
      '急ぐ (いそぐ)',
    );

    const status = await call('status');
    expect(status.text).toMatch(
      /^ready now 1 · left today: 2 new grammar, 0 new vocab, \d+ reviews/,
    );
    expect(status.text).toContain('streak 0 days');
  });
});
