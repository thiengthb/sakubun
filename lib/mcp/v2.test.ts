import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { UserDb } from '@/lib/db/user-db';
import { signInTransport } from '@/lib/mcp/test-auth';
import { createTestUser, createTestDb, resetLearningData } from '@/lib/db/test-db';

// The v2 tools over the real MCP protocol (an in-memory client reads exactly what Claude reads):
// one whole turn, the errors a model hits, and the library and status tools.

createTestDb('sakubun-mcp-v2-');

type Db = typeof import('@/lib/db/db');
let prisma: Db['prisma'];
let db: UserDb;
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
  db = (await import('@/lib/db/user-db')).userDb(await createTestUser(prisma, 'learner'));
  const { registerAll } = await import('@/lib/mcp/server');
  const server = new McpServer({ name: 'sakubun-mcp', version: '0.1.0' });
  registerAll(server, 'v2');
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  signInTransport(clientSide, 'learner');
  await server.connect(serverSide);
  client = new Client({ name: 'v2-test', version: '0.0.0' });
  await client.connect(clientSide);
  // A small Kho chung, so lookup's fallback (L5) does not seed all of OpenJLPT; its own cases are in
  // lib/mcp/library.test.ts.
  await (
    await import('@/lib/library/shared')
  ).seedOpenJlpt(prisma, [
    {
      id: 'GRAMMAR-〜ている',
      kind: 'GRAMMAR',
      expression: '〜ている',
      reading: null,
      hanviet: null,
      meaningVi: 'đang',
      level: 'N5',
      notes: '',
      tags: '[]',
      source: 'OPENJLPT',
      suspended: false,
      starred: false,
    },
  ]);
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await resetLearningData(prisma);
  const P = await import('@/lib/library/practice');
  await P.saveSettings(db, { grammarLevels: ['N2'], dailyNewGrammar: 2, dailyNewVocab: 0 });
  await P.addItems(
    db,
    [{ expression: '〜ばかりに', meaningVi: 'chỉ vì... (kết quả xấu)', level: 'N2' }],
    'MCP',
    'GRAMMAR',
  );
});

describe('MCP v2', () => {
  it('lists exactly the seven study tools, example_add, three Kaiwa and two Kho chung tools, and two prompts', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      [
        'add_items',
        'example_add',
        'grade_turn',
        'kaiwa_get',
        'kaiwa_list',
        'kaiwa_save',
        'library_search',
        'library_take',
        'lookup',
        'next_turn',
        'skip_turn',
        'stage_turn',
        'status',
      ].sort(),
    );
    const { prompts } = await client.listPrompts();
    expect(prompts.map((p) => p.name)).toEqual(['hoc', 'kaiwa']);
  });

  it('tells Claude that a right answer is a 3 and Easy needs an instant, flawless one', async () => {
    // Claude graded every right answer 4 (Easy) on 2026-10-23, pushing items 84 days out.
    const { tools } = await client.listTools();
    expect(tools.find((t) => t.name === 'grade_turn')?.description).toMatch(
      /3 right \(usual\), 4 instant and flawless/,
    );
    const hoc = await client.getPrompt({ name: 'hoc' });
    const text = (hoc.messages[0].content as { text: string }).text;
    expect(text).toContain('3 right (the usual grade)');
    expect(text).toContain('4 only if instant and flawless');
    // A learner's wish (longer, other direction) must reach stage_turn too, or its checks refuse it.
    expect(text).toContain('Call stage_turn,\n   passing the same hint if there is one.');
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
    expect(await db.reviewLog.count({ where: { channel: 'mcp' } })).toBe(1);
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
    expect(await db.turn.count()).toBe(0);

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
    expect(await db.reviewLog.count()).toBe(0);
  });

  it('says when nothing is left today', async () => {
    const P = await import('@/lib/library/practice');
    await P.saveSettings(db, { dailyNewGrammar: 0 });
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
    // What is waiting comes first; the allowance is labelled as a cap so it never reads as due.
    expect(status.text).toMatch(/^ready now 1: 0 due, 1 new grammar, 0 new vocab\n/);
    expect(status.text).toMatch(
      /\ndaily cap left \(not items waiting\): 2 new grammar, 0 new vocab, \d+ reviews\n/,
    );
    expect(status.text).toContain('streak 0 days');
  });

  it('adds an example sentence to a card, creating one that holds only sentences', async () => {
    const item = await db.item.findFirstOrThrow({ where: { expression: '〜ばかりに' } });
    const ja = '寝坊したばかりに、電車に乗り遅れた。';
    const added = await call('example_add', {
      itemId: item.id,
      ja,
      vi: 'Chỉ vì ngủ quên mà tôi lỡ tàu.',
    });
    expect(added.text).toMatch(/^added to 〜ばかりに: 1 sentence on its card \(new card/);
    const quick = await (await import('@/lib/app/quick-review')).getItemCards(db, [item.id]);
    expect(quick[0].sentence?.translation).toBe('Chỉ vì ngủ quên mà tôi lỡ tàu.');

    const again = await call('example_add', { itemId: item.id, ja, vi: 'x' });
    expect(again).toEqual({ isError: true, text: expect.stringContaining('already has') });
    const off = await call('example_add', { itemId: item.id, ja: '電車に乗り遅れた。', vi: 'x' });
    expect(off.isError).toBe(true);
    expect(off.text).toContain('does not use 〜ばかりに');
  });
});
