import { expect, test } from '@playwright/test';
import { callTool, initializeMcp, MCP_URL, openE2eDb, rpc, seedMcpAccount } from './mcp-client';

// MCP v2 over the real HTTP route with a real key: one whole turn lands in Turn and ReviewLog.
// `?profile=v2` is the explicit name of the default set (e2e/mcp.spec.ts covers the default URL).

const V2_URL = `${MCP_URL}?profile=v2`;

function line(text: string, key: string): string {
  const found = text.split('\n').find((l) => l.startsWith(`${key} `));
  expect(found, `no "${key}" line in:\n${text}`).toBeTruthy();
  return found!.slice(key.length + 1).trim();
}

test('MCP v2: one whole turn through the v2 profile', async ({ request }) => {
  await seedMcpAccount();
  await initializeMcp(request, V2_URL);

  const listed = await rpc(request, 'tools/list', {}, V2_URL);
  const names = ((listed.result as { tools: { name: string }[] }).tools ?? []).map((t) => t.name);
  expect(names.sort()).toEqual(
    ['add_items', 'grade_turn', 'lookup', 'next_turn', 'skip_turn', 'stage_turn', 'status'].sort(),
  );

  const added = await callTool(
    request,
    'add_items',
    {
      kind: 'GRAMMAR',
      items: [{ expression: '〜ながら', meaningVi: 'vừa... vừa...', level: 'N5' }],
    },
    V2_URL,
  );
  expect(added.text).toMatch(/^added 1/);

  const next = await callTool(request, 'next_turn', {}, V2_URL);
  expect(next.isError, next.text).toBe(false);
  const itemId = line(next.text, 'item').split('itemId ')[1];
  expect(next.text).toContain('item 〜ながら');

  const refused = await callTool(
    request,
    'stage_turn',
    { itemId, ja: '音楽を聞いて勉強します。', vi: 'Tôi nghe nhạc rồi học.' },
    V2_URL,
  );
  expect(refused).toEqual({
    isError: true,
    text: 'ja does not use 〜ながら. Rewrite it around 〜ながら, or pass uses: the exact words in ja that use it.',
  });

  const staged = await callTool(
    request,
    'stage_turn',
    { itemId, ja: '音楽を聞きながら勉強します。', vi: 'Tôi vừa nghe nhạc vừa học.' },
    V2_URL,
  );
  expect(staged.isError, staged.text).toBe(false);
  expect(line(staged.text, 'show:')).toBe('音楽を聞きながら勉強します。');
  const turnId = line(staged.text, 'turnId');

  const graded = await callTool(
    request,
    'grade_turn',
    { turnId, answer: 'Tôi vừa nghe nhạc vừa học bài.', rating: 3 },
    V2_URL,
  );
  expect(graded.text).toMatch(/^graded 3 \(Good\)/);
  const again = await callTool(request, 'grade_turn', { turnId, answer: 'x', rating: 4 }, V2_URL);
  expect(again).toEqual({
    isError: true,
    text: 'Turn already graded. Call next_turn for a new one.',
  });

  const db = openE2eDb();
  try {
    expect(db.prepare('SELECT status, rating FROM Turn WHERE id = ?').get(turnId)).toEqual({
      status: 'graded',
      rating: 3,
    });
    expect(
      db
        .prepare('SELECT COUNT(*) AS n FROM ReviewLog WHERE turnId = ? AND channel = ?')
        .get(turnId, 'mcp'),
    ).toEqual({ n: 1 });
  } finally {
    db.close();
  }
});
