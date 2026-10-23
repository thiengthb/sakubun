import { expect, test, type APIRequestContext } from '@playwright/test';
import { E2E_EMAIL, E2E_LOGIN } from './fixtures';
import {
  callTool,
  initializeMcp,
  MCP_HEADERS,
  MCP_URL,
  openE2eDb,
  rpc,
  seedMcpAccount,
} from './mcp-client';

// The MCP route over real HTTP with a real key (roadmap 3.2): the default surface is the v2 set, old
// profile names still in client configs land on it too, the planner profile stays counts-only, and
// only grade_turn moves the FSRS schedule.

const V2_TOOLS = [
  'add_items',
  'grade_turn',
  'lookup',
  'next_turn',
  'skip_turn',
  'stage_turn',
  'status',
];

async function toolNames(api: APIRequestContext, url = MCP_URL): Promise<string[]> {
  const listed = await rpc(api, 'tools/list', {}, url);
  return ((listed.result as { tools: { name: string }[] }).tools ?? []).map((t) => t.name).sort();
}

function line(text: string, key: string): string {
  const found = text.split('\n').find((l) => l.startsWith(`${key} `));
  expect(found, `no "${key}" line in:\n${text}`).toBeTruthy();
  return found!.slice(key.length + 1).trim();
}

function srsRow(itemId: string): Record<string, unknown> | undefined {
  const db = openE2eDb();
  try {
    return db
      .prepare(
        `SELECT due, stability, difficulty, scheduledDays, learningSteps, reps, lapses, state, lastReview
         FROM "SrsState" WHERE itemId = ?`,
      )
      .get(itemId) as Record<string, unknown> | undefined;
  } finally {
    db.close();
  }
}

async function addPattern(api: APIRequestContext, expression: string): Promise<string> {
  const added = await callTool(api, 'add_items', {
    kind: 'GRAMMAR',
    items: [{ expression, meaningVi: 'vừa... vừa...', level: 'N5' }],
  });
  expect(added.text).toMatch(/^added 1/);
  const db = openE2eDb();
  try {
    return (
      db.prepare('SELECT id FROM Item WHERE expression = ?').get(expression) as { id: string }
    ).id;
  } finally {
    db.close();
  }
}

test('MCP từ chối request không có token, và token sai', async ({ request }) => {
  await seedMcpAccount();
  const data = { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} };
  const { authorization: _, ...noAuth } = MCP_HEADERS;

  const noToken = await request.post(MCP_URL, { headers: noAuth, data });
  expect(noToken.status(), 'không token phải 401').toBe(401);

  const badToken = await request.post(MCP_URL, {
    headers: { ...noAuth, authorization: 'Bearer khong-phai-token-that' },
    data,
  });
  expect(badToken.status(), 'token lạ phải 401').toBe(401);
});

test('mặc định là bộ v2, tên profile cũ cũng về v2, planner chỉ đọc số liệu', async ({
  request,
}) => {
  await seedMcpAccount();
  await initializeMcp(request);
  expect(await toolNames(request)).toEqual(V2_TOOLS);
  const prompts = await rpc(request, 'prompts/list', {});
  expect((prompts.result as { prompts: { name: string }[] }).prompts.map((p) => p.name)).toEqual([
    'hoc',
  ]);

  for (const old of ['full', 'tutor']) {
    const url = `${MCP_URL}?profile=${old}`;
    await initializeMcp(request, url);
    expect(await toolNames(request, url), `?profile=${old}`).toEqual(V2_TOOLS);
  }

  const planner = `${MCP_URL}?profile=planner`;
  await initializeMcp(request, planner);
  expect(await toolNames(request, planner)).toEqual(['get_review_load', 'ping']);
  const ping = await callTool(request, 'ping', {}, planner);
  expect(ping.text).toContain('"ok":true');

  const unknown = await request.post(`${MCP_URL}?profile=admin`, {
    headers: MCP_HEADERS,
    data: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
  });
  expect(unknown.status()).toBe(400);
});

test('chỉ grade_turn đẩy được lịch FSRS (bất biến 1)', async ({ request }) => {
  await seedMcpAccount();
  await initializeMcp(request);
  const itemId = await addPattern(request, '〜ながら');
  const before = srsRow(itemId);

  const next = await callTool(request, 'next_turn', { itemId });
  expect(next.isError, next.text).toBe(false);
  const staged = await callTool(request, 'stage_turn', {
    itemId,
    ja: '音楽を聞きながら勉強します。',
    vi: 'Tôi vừa nghe nhạc vừa học.',
  });
  expect(staged.isError, staged.text).toBe(false);
  const skipped = await callTool(request, 'skip_turn', { turnId: line(staged.text, 'turnId') });
  expect(skipped.isError, skipped.text).toBe(false);
  for (const [name, args] of [
    ['lookup', { query: 'ながら' }],
    ['status', {}],
    [
      'add_items',
      { kind: 'VOCAB', items: [{ expression: '急ぐ', meaningVi: 'vội', level: 'N4' }] },
    ],
  ] as const) {
    const res = await callTool(request, name, args);
    expect(srsRow(itemId), `${name} đã đẩy lịch FSRS: ${res.text.slice(0, 160)}`).toEqual(before);
  }

  const again = await callTool(request, 'stage_turn', {
    itemId,
    ja: '歩きながら話しましょう。',
    vi: 'Vừa đi vừa nói chuyện nhé.',
  });
  const graded = await callTool(request, 'grade_turn', {
    turnId: line(again.text, 'turnId'),
    answer: 'Vừa đi vừa nói chuyện.',
    rating: 3,
  });
  expect(graded.isError, graded.text).toBe(false);
  expect(srsRow(itemId)!.reps, 'grade_turn phải đẩy được lịch').toBe(1);
});

test('next_turn không bao giờ đưa ra mục bị treo', async ({ request }) => {
  await seedMcpAccount();
  await initializeMcp(request);
  const suspended = await addPattern(request, '〜ながら');
  await addPattern(request, '〜てから');
  const db = openE2eDb();
  db.prepare('UPDATE Item SET suspended = 1 WHERE id = ?').run(suspended);
  db.close();

  const next = await callTool(request, 'next_turn', {});
  expect(next.isError, next.text).toBe(false);
  expect(next.text).toContain('item 〜てから');
  expect(next.text).not.toContain('〜ながら');
});

test('bảng đếm tool ghi lời gọi v2 và hiện trên /settings', async ({ page, request }) => {
  await seedMcpAccount();
  const reset = openE2eDb();
  reset.prepare('DELETE FROM mcp_tool_call').run();
  reset.close();

  await initializeMcp(request);
  expect((await callTool(request, 'status', {})).isError).toBe(false);

  const db = openE2eDb();
  const rows = db.prepare('SELECT name, calls, errors FROM mcp_tool_call').all();
  db.close();
  expect(rows).toEqual([{ name: 'status', calls: 1, errors: 0 }]);

  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

  await page.goto('/settings');
  await expect(async () => {
    await page.getByRole('tab', { name: 'Tài khoản' }).click();
    await expect(page.getByRole('tabpanel', { name: 'Tài khoản' })).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30_000 });
  await expect(page.getByRole('cell', { name: 'status', exact: true })).toBeVisible();
  await expect(page.getByText(/tool CHƯA BAO GIỜ được gọi/)).toBeVisible();
  await expect(page.getByText('next_turn', { exact: false })).toBeVisible();
});
