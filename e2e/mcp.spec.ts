import path from 'node:path';
import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { E2E_BASE_URL, E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

const MCP_TOKEN = ['e2e', 'mcp', 'token', '0123456789'].join('-');
const MCP_URL = `${E2E_BASE_URL}/api/mcp`;

const MCP_HEADERS = {
  'content-type': 'application/json',
  accept: 'application/json, text/event-stream',
};

function parseRpc(body: string): Record<string, unknown> {
  const line = body.split('\n').find((l) => l.startsWith('data:'));
  return JSON.parse(line ? line.slice(5).trim() : body) as Record<string, unknown>;
}

async function seed() {
  await seedE2eAccount();
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  const user = db.prepare('SELECT id FROM user WHERE email = ?').get(E2E_EMAIL) as
    | { id: string }
    | undefined;
  if (!user) throw new Error('chưa seed được tài khoản e2e');
  db.prepare('DELETE FROM mcp_key').run();
  db.prepare(
    `INSERT INTO mcp_key (id, userId, name, tokenHash, lastUsedAt, createdAt)
     VALUES ('mcpk-e2e', ?, 'e2e', ?, NULL, ?)`,
  ).run(user.id, createHash('sha256').update(MCP_TOKEN).digest('hex'), new Date().toISOString());
  db.close();
}

async function initialize(api: APIRequestContext): Promise<void> {
  const res = await api.post(MCP_URL, {
    headers: { ...MCP_HEADERS, authorization: `Bearer ${MCP_TOKEN}` },
    data: {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'e2e', version: '0' },
      },
    },
  });
  expect(res.status(), await res.text()).toBe(200);
  const body = parseRpc(await res.text());
  expect(body.result, 'initialize phải trả result').toBeTruthy();
}

test('MCP từ chối request không có token, và token sai', async ({ request }) => {
  await seed();

  const noToken = await request.post(MCP_URL, { headers: MCP_HEADERS, data: { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} } });
  expect(noToken.status(), 'không token phải 401').toBe(401);

  const badToken = await request.post(MCP_URL, {
    headers: { ...MCP_HEADERS, authorization: 'Bearer khong-phai-token-that' },
    data: { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
  });
  expect(badToken.status(), 'token lạ phải 401').toBe(401);
});

test('MCP với token hợp lệ: initialize, liệt kê tool, và gọi được ping', async ({ request }) => {
  await seed();
  await initialize(request);
  const authed = { ...MCP_HEADERS, authorization: `Bearer ${MCP_TOKEN}` };

  await request.post(MCP_URL, {
    headers: authed,
    data: { jsonrpc: '2.0', method: 'notifications/initialized' },
  });

  const listRes = await request.post(MCP_URL, {
    headers: authed,
    data: { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
  });
  expect(listRes.status(), await listRes.text()).toBe(200);
  const list = parseRpc(await listRes.text());
  const tools = (list.result as { tools?: { name: string }[] })?.tools ?? [];
  const names = tools.map((t) => t.name);
  expect(names.length, `phải có tool, nhận được: ${names.join(', ')}`).toBeGreaterThan(5);
  for (const must of ['ping', 'get_protocol']) expect(names).toContain(must);
  for (const must of ['list_calibration_proposals', 'set_proposal_verdict'])
    expect(names, 'nửa duyệt của calibration phải với tới được').toContain(must);

  const callRes = await request.post(MCP_URL, {
    headers: authed,
    data: { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'ping', arguments: {} } },
  });
  expect(callRes.status(), await callRes.text()).toBe(200);
  const call = parseRpc(await callRes.text());
  const content = (call.result as { content?: { text?: string }[] })?.content ?? [];
  expect(content[0]?.text, 'ping phải trả JSON có ok:true').toContain('"ok":true');

  const propRes = await request.post(MCP_URL, {
    headers: authed,
    data: {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'list_calibration_proposals', arguments: {} },
    },
  });
  expect(propRes.status(), await propRes.text()).toBe(200);
  const prop = parseRpc(await propRes.text());
  const propText =
    (prop.result as { content?: { text?: string }[] })?.content?.[0]?.text ?? '';
  expect(JSON.parse(propText)).toMatchObject({ total: 0, unreviewed: 0, proposals: [] });
});

const AUTHED = { ...MCP_HEADERS, authorization: `Bearer ${MCP_TOKEN}` };

function toolJson(text: string): Record<string, unknown> {
  const fence = text.match(/```json\n([\s\S]*?)\n```/);
  return JSON.parse(fence ? fence[1] : text) as Record<string, unknown>;
}

let rpcId = 100;

async function callTool(
  api: APIRequestContext,
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await api.post(MCP_URL, {
    headers: AUTHED,
    data: { jsonrpc: '2.0', id: ++rpcId, method: 'tools/call', params: { name, arguments: args } },
  });
  expect(res.status(), await res.text()).toBe(200);
  const body = parseRpc(await res.text());
  const result = (body.result ?? {}) as { content?: { text?: string }[]; isError?: boolean };
  const text = result.content?.[0]?.text ?? '';
  expect(result.isError, `tool ${name} trả lỗi: ${text}`).toBeFalsy();
  return toolJson(text);
}

async function practiseOneTurn(
  api: APIRequestContext,
  itemId: string,
  rating = 3,
): Promise<Record<string, unknown>> {
  const staged = await callTool(api, 'stage_sentence', {
    direction: 'JA_VI',
    sourceText: '彼は疲れているばかりに、約束を忘れた。',
    suggested: 'Chỉ vì anh ấy mệt mà đã quên lời hẹn.',
    items: [{ itemId, role: 'TARGET' }],
  });
  const sentenceId = staged.sentenceId as string;
  expect(sentenceId, 'stage_sentence phải trả sentenceId').toBeTruthy();

  return callTool(api, 'submit_review', {
    sentenceId,
    userAnswer: 'Chỉ vì mệt nên anh ấy quên mất lời hẹn.',
    ratings: [{ itemId, rating, role: 'TARGET' }],
    score: 80,
  });
}

function openE2eDb() {
  return new Database(path.join(process.cwd(), E2E_DB_FILE));
}

test('MCP chấm được một lượt thật, kể cả khi hàng ability mang id từ thời nhiều người dùng', async ({
  request,
}) => {
  await seed();
  const reset = openE2eDb();
  reset.prepare('DELETE FROM "LearnerAbility"').run();
  reset.close();

  await initialize(request);

  await callTool(request, 'add_grammar', {
    grammar: [
      {
        expression: 'E2E〜ばかりに',
        reading: 'ばかりに',
        meaningVi: 'chỉ vì (mà sinh hậu quả xấu)',
        level: 'N2',
        notes: '動詞た形 + ばかりに',
      },
    ],
  });
  const listed = await callTool(request, 'list_grammar', {});
  const rows = (listed.items ?? listed) as { itemId: string; expression: string }[];
  const itemId = rows.find((r) => r.expression === 'E2E〜ばかりに')?.itemId;
  expect(itemId, `list_grammar phải thấy mẫu vừa thêm, nhận được: ${JSON.stringify(rows)}`).toBeTruthy();

  const first = await practiseOneTurn(request, itemId!, 3);
  expect((first.items as { itemId: string }[])[0]?.itemId).toBe(itemId);

  const rename = openE2eDb();
  const legacyId = 'clz0legacyabilityrow0004';
  const renamed = rename
    .prepare(`UPDATE "LearnerAbility" SET "id" = ? WHERE "id" = 'singleton'`)
    .run(legacyId);
  rename.close();
  expect(renamed.changes, 'lượt đầu phải tạo hàng ability id singleton để đổi tên').toBe(1);

  const second = await practiseOneTurn(request, itemId!, 4);
  expect((second.items as { itemId: string }[])[0]?.itemId).toBe(itemId);

  const check = openE2eDb();
  const logs = check
    .prepare('SELECT COUNT(*) AS c FROM "ReviewLog" WHERE "itemId" = ?')
    .get(itemId) as { c: number };
  const ability = check
    .prepare('SELECT "id", "receptiveObservations" FROM "LearnerAbility"')
    .all() as { id: string; receptiveObservations: number }[];
  check.close();

  expect(logs.c, 'hai lượt đã chấm phải để lại hai ReviewLog').toBe(2);
  expect(ability, 'không được sinh hàng ability thứ hai bên cạnh hàng cũ').toHaveLength(1);
  expect(ability[0].id, 'ghi phải vào hàng đang tồn tại, không tạo hàng mới').toBe(legacyId);
  expect(ability[0].receptiveObservations, 'cả hai lượt đều là bằng chứng receptive').toBe(2);
});

test('bảng đếm tool: một lời gọi chạy và một lời gọi HỎNG đều nằm lại, rồi hiện trên /settings', async ({
  page,
  request,
}) => {
  await seed();
  const reset = openE2eDb();
  reset.prepare('DELETE FROM mcp_tool_call').run();
  reset.close();

  await initialize(request);
  await callTool(request, 'ping', {});

  const failing = await request.post(MCP_URL, {
    headers: AUTHED,
    data: {
      jsonrpc: '2.0',
      id: 900,
      method: 'tools/call',
      params: { name: 'update_grammar', arguments: { itemId: 'khong-ton-tai-that', level: 'N1' } },
    },
  });
  expect(failing.status(), 'tool hỏng vẫn là HTTP 200 — đó chính là vấn đề').toBe(200);
  const failedResult = (parseRpc(await failing.text()).result ?? {}) as { isError?: boolean };
  expect(failedResult.isError, 'lời gọi này phải hỏng, nếu không thì ca dưới đo nhầm thứ').toBe(true);

  const db = openE2eDb();
  const rows = db
    .prepare('SELECT name, calls, errors, lastMs, lastError FROM mcp_tool_call ORDER BY name')
    .all() as { name: string; calls: number; errors: number; lastMs: number; lastError: string }[];
  db.close();

  expect(
    rows.map((r) => r.name),
    'đúng hai tool được gọi trong ca này, không nhiều hơn',
  ).toEqual(['ping', 'update_grammar']);

  const ping = rows.find((r) => r.name === 'ping')!;
  expect(ping.calls).toBe(1);
  expect(ping.errors, 'ping chạy được thì không được tính là lỗi').toBe(0);
  expect(ping.lastMs, 'thời gian có thể là 0 ms, nhưng phải được ghi').toBeGreaterThanOrEqual(0);

  const failed = rows.find((r) => r.name === 'update_grammar')!;
  expect(failed.calls, 'một lời gọi hỏng vẫn LÀ một lời gọi').toBe(1);
  expect(failed.errors).toBe(1);
  expect(failed.lastError, `lastError: ${failed.lastError}`).toContain('[P2025 Item]');
  expect(failed.lastError, `lastError: ${failed.lastError}`).toContain('required but not found');
  expect(failed.lastError, 'không lưu đường dẫn chunk của bundler').not.toContain('TURBOPACK');

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

  await expect(page.getByRole('cell', { name: 'ping', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'update_grammar' })).toBeVisible();
  await expect(page.getByText('1 tool có lỗi')).toBeVisible();
  await expect(page.getByText(/lỗi gần nhất/)).toBeVisible();
  await expect(page.getByText(/tool CHƯA BAO GIỜ được gọi/)).toBeVisible();
  await expect(page.getByText('get_stats', { exact: false })).toBeVisible();
});

test('update_settings: dạng phẳng và dạng nested cũ đều chạy, dạng nested sai vẫn bị từ chối', async ({
  request,
}) => {
  await seed();
  await initialize(request);

  const flat = await callTool(request, 'update_settings', { register: 'keigo' });
  expect(flat.register, 'dạng phẳng — dạng Claude dùng').toBe('keigo');

  const nested = await callTool(request, 'update_settings', { patch: { register: 'casual' } });
  expect(nested.register, 'dạng nested cũ vẫn phải được áp dụng, không bị bỏ qua').toBe('casual');

  const bad = await request.post(MCP_URL, {
    headers: AUTHED,
    data: {
      jsonrpc: '2.0',
      id: 950,
      method: 'tools/call',
      params: { name: 'update_settings', arguments: { patch: { register: 'khong-ton-tai' } } },
    },
  });
  expect(bad.status()).toBe(200);
  const badResult = (parseRpc(await bad.text()).result ?? {}) as {
    isError?: boolean;
    content?: { text?: string }[];
  };
  expect(badResult.isError, 'giá trị enum sai trong dạng nested phải bị từ chối').toBe(true);
  expect(badResult.content?.[0]?.text).toContain('Tham số không hợp lệ');

  const after = await callTool(request, 'get_settings', {});
  expect(after.register, 'lời gọi bị từ chối không được ghi gì').toBe('casual');
});

test('điểm của lượt vừa chấm đọc được ở LỊCH SỬ, không phụ thuộc Claude có chép khối ra hay không', async ({
  page,
  request,
}) => {
  await seed();
  await initialize(request);

  const expression = 'HOME〜ばかりに';
  await callTool(request, 'add_grammar', {
    grammar: [{ expression, meaningVi: 'chỉ vì', level: 'N5' }],
  });
  const listed = await callTool(request, 'list_grammar', {});
  const rows = ((listed.items ?? listed) as { itemId: string; expression: string }[]) ?? [];
  const itemId = rows.find((r) => r.expression === expression)?.itemId;
  expect(itemId, 'add_grammar phải vào được kho').toBeTruthy();

  const sourceText = '疲れていたばかりに、約束を忘れた。';
  const staged = await callTool(request, 'stage_sentence', {
    direction: 'JA_VI',
    sourceText,
    suggested: 'Chỉ vì mệt mà tôi quên lời hẹn.',
    items: [{ itemId, role: 'TARGET' }],
  });
  await callTool(request, 'submit_review', {
    sentenceId: staged.sentenceId as string,
    userAnswer: 'Chỉ vì mệt nên tôi đã quên mất lời hẹn.',
    ratings: [{ itemId, rating: 3, role: 'TARGET' }],
    score: 82,
  });

  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

  await page.goto('/history');
  await expect(page.getByText('82/100').first()).toBeVisible();
  await expect(page.getByText(sourceText, { exact: false }).first()).toBeVisible();
});

test('lượt được chấm mà Claude KHÔNG gửi score thì UI phải nói ra, không im lặng', async ({
  page,
  request,
}) => {
  await seed();
  await initialize(request);

  const expression = 'HOME〜どころか';
  await callTool(request, 'add_grammar', {
    grammar: [{ expression, meaningVi: 'nói gì đến', level: 'N5' }],
  });
  const listed = await callTool(request, 'list_grammar', {});
  const rows = ((listed.items ?? listed) as { itemId: string; expression: string }[]) ?? [];
  const itemId = rows.find((r) => r.expression === expression)?.itemId;
  expect(itemId, 'add_grammar phải vào được kho').toBeTruthy();

  const sourceText = '漢字どころか、ひらがなも読めない。';
  const staged = await callTool(request, 'stage_sentence', {
    direction: 'JA_VI',
    sourceText,
    suggested: 'Nói gì đến kanji, hiragana cũng không đọc được.',
    items: [{ itemId, role: 'TARGET' }],
  });
  const sentenceId = staged.sentenceId as string;

  const missing = await request.post(MCP_URL, {
    headers: AUTHED,
    data: {
      jsonrpc: '2.0',
      id: 960,
      method: 'tools/call',
      params: {
        name: 'submit_review',
        arguments: {
          sentenceId,
          userAnswer: 'Nói gì kanji, hiragana cũng chịu.',
          ratings: [{ itemId, rating: 3, role: 'TARGET' }],
        },
      },
    },
  });
  expect(missing.status()).toBe(200);
  const missingResult = (parseRpc(await missing.text()).result ?? {}) as {
    isError?: boolean;
    content?: { text?: string }[];
  };
  expect(
    missingResult.isError,
    'chấm mà không gửi điểm phải bị TỪ CHỐI, không được ghi im lặng',
  ).toBe(true);
  expect(missingResult.content?.[0]?.text, 'lời từ chối phải chỉ đúng trường thiếu').toMatch(
    /score/,
  );

  const retried = await callTool(request, 'submit_review', {
    sentenceId,
    userAnswer: 'Nói gì kanji, hiragana cũng chịu.',
    ratings: [{ itemId, rating: 3, role: 'TARGET' }],
    score: 64,
  });
  expect(retried.sentenceId ?? sentenceId, 'chấm lại phải áp vào đúng câu đó').toBe(sentenceId);

  const db = openE2eDb();
  try {
    const changed = db.prepare('UPDATE Sentence SET score = NULL WHERE id = ?').run(sentenceId);
    expect(changed.changes, 'phải bỏ được điểm của đúng một hàng').toBe(1);
  } finally {
    db.close();
  }

  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

  await page.goto('/history');
  await expect(page.getByText(sourceText, { exact: false }).first()).toBeVisible();
  await expect(page.getByText('Chưa có điểm').first()).toBeVisible();
});
