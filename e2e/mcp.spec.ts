// Bề mặt MCP — chỗ Claude Desktop nối vào, và cho tới hôm nay KHÔNG có một dòng test browser nào.
//
// Vì sao viết bây giờ: đợt rà soát phát hiện `mcp-handler@1.1.0` ghim peer `@modelcontextprotocol/sdk`
// ở ĐÚNG `1.26.0` trong khi project khai `^1.30.0`, và `.npmrc` bật `legacy-peer-deps=true` nên
// `npm install` không kêu một tiếng. Muốn chỉnh version đó thì phải có cái gì đó chứng minh tầng MCP
// còn sống trước và sau — nếu không thì đấy là đổi mù. Unit test của `lib/mcp/**` kiểm phần render và
// phần thuần, không kiểm việc handler thật có nói được giao thức JSON-RPC qua HTTP hay không.
//
// Bốn điều được chốt, và cả bốn đều là ranh giới chứ không phải đường hạnh phúc:
//   1. KHÔNG token → 401. Đây là toàn bộ biên giới của bề mặt máy (`withMcpAuth({required:true})`).
//   2. Token SAI → 401. Khác (1): chứng minh server thật sự TRA token chứ không chỉ kiểm có header.
//   3. Token ĐÚNG → initialize + tools/list + gọi `ping` chạy hết một vòng JSON-RPC.
//   4. Một LƯỢT LUYỆN THẬT chạy hết vòng qua chính bề mặt này: add_grammar → stage_sentence →
//      submit_review, và điểm FSRS phải NẰM LẠI trong DB. Thêm 2026-08-10, sau khi bản deploy không
//      chấm nổi một lượt nào trong suốt buổi 2026-08-08 mà cả 671 unit test lẫn ba ca trên đều xanh:
//      `submit_review` — tool duy nhất ghi lịch FSRS, tool người học chạm mỗi lượt — chưa từng được
//      gọi qua HTTP trong bất cứ test nào. `ping` chứng minh giao thức sống, không chứng minh app làm
//      được việc của nó.
import path from 'node:path';
import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { E2E_BASE_URL, E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

// Token thật của một máy khách; DB chỉ giữ SHA-256 của nó (lib/mcp-key.ts). Test dựng hash bằng chính
// thuật toán đó thay vì gọi `createMcpKey`, để không phải nạp tầng Prisma vào process của Playwright.
const MCP_TOKEN = ['e2e', 'mcp', 'token', '0123456789'].join('-');
const MCP_URL = `${E2E_BASE_URL}/api/mcp`;

/** MCP nói JSON-RPC qua Streamable HTTP; server trả `text/event-stream` nên phải nhận cả hai kiểu. */
const MCP_HEADERS = {
  'content-type': 'application/json',
  accept: 'application/json, text/event-stream',
};

/** Một frame SSE bọc JSON-RPC: `event: message\ndata: {...}`. Lấy JSON ra, hoặc parse thẳng nếu là JSON. */
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

/**
 * `initialize` — bắt tay giao thức, bắt buộc trước mọi lời gọi khác.
 *
 * KHÔNG có `mcp-session-id`: `lib/mcp/server.ts` dựng handler với `disableSse: true`, tức chế độ
 * STATELESS, nên server không cấp session và các request sau cũng không cần gửi kèm. (Bản đầu của test
 * này đòi header đó và đỏ — nó đòi một thứ của chế độ khác.)
 */
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

  // Token đúng ĐỊNH DẠNG nhưng không có trong DB. Khác hẳn ca trên: nó chứng minh server TRA token,
  // chứ không chỉ kiểm sự tồn tại của header Authorization.
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
  // Không chốt con số chính xác — thêm/bớt một tool là việc bình thường, và một test đỏ vì điều đó là
  // test bắt nhầm. Chốt rằng bộ tool có mặt và những cái xương sống nằm trong đó.
  expect(names.length, `phải có tool, nhận được: ${names.join(', ')}`).toBeGreaterThan(5);
  for (const must of ['ping', 'get_protocol']) expect(names).toContain(must);
  // Nửa ĐỌC của calibration shadow. Trước 2026-08-07 các proposal được GHI vào DB mà không có đường
  // nào lấy ra — không UI, không tool — nên cái gate mà chúng sinh ra để phục vụ không bao giờ đáp
  // được. Chốt ở đây vì "đọc được" phải là phép đo, không phải lời hứa trong changelog.
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

  // Và gọi thật nửa đọc đó: DB e2e không có proposal nào, nên phong bì phải là "rỗng hợp lệ"
  // ({total:0, unreviewed:0, proposals:[]}) chứ không phải lỗi. Một tool chỉ chạy được khi CÓ dữ liệu
  // thì chưa gọi là với tới được.
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

/** Mọi lời gọi tool dùng chung một bộ header đã kèm token. */
const AUTHED = { ...MCP_HEADERS, authorization: `Bearer ${MCP_TOKEN}` };

/**
 * Payload JSON của một tool result.
 *
 * Hai hình dạng cùng tồn tại và cả hai đều hợp lệ: `ok()` trả JSON trần, còn các tool người học đọc
 * (`stage_sentence`, `submit_review`) trả markdown rồi kèm khối ```json — vì phần markdown là hợp đồng
 * hiển thị, Claude đọc nguyên văn. Lấy khối fence khi có, không thì parse cả chuỗi.
 */
function toolJson(text: string): Record<string, unknown> {
  const fence = text.match(/```json\n([\s\S]*?)\n```/);
  return JSON.parse(fence ? fence[1] : text) as Record<string, unknown>;
}

let rpcId = 100;

/**
 * Một `tools/call`, và nó ĐỎ khi tool trả lỗi.
 *
 * `guard()` trong lib/mcp/tool-kit.ts bắt mọi exception và trả về `isError: true` với HTTP **200** —
 * cố ý, để Claude đọc được lời lỗi thay vì một -32603 trần. Nghĩa là chốt `status() === 200` là chưa
 * đủ: đúng cái bug 2026-08-08 đi qua đường đó, HTTP 200 kèm một câu tiếng Việt sai địa chỉ. Phải soi
 * `isError`, và in cả text ra khi đỏ để lần sau đọc log là biết ngay.
 */
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

/** Dựng một câu rồi chấm nó — đúng cặp lời gọi Claude thực hiện mỗi lượt. */
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
  });
}

/** Mở DB e2e ra đọc/ghi thẳng — cùng cách seed token ở trên. */
function openE2eDb() {
  return new Database(path.join(process.cwd(), E2E_DB_FILE));
}

test('MCP chấm được một lượt thật, kể cả khi hàng ability mang id từ thời nhiều người dùng', async ({
  request,
}) => {
  await seed();
  // DB e2e dùng chung cho cả bộ spec, và spec chạy trước có thể đã tạo hàng ability. Xoá để trạng thái
  // ở đây là do test này quyết, không phải do thứ tự file.
  const reset = openE2eDb();
  reset.prepare('DELETE FROM "LearnerAbility"').run();
  reset.close();

  await initialize(request);

  // Một mẫu ngữ pháp, vào kho qua đúng tool Claude dùng. Item unique là [kind, expression], nên nếu
  // spec khác đã thêm mẫu này thì add_grammar bỏ qua như trùng lặp — list_grammar vẫn trả về hàng đó,
  // nên cả hai lối đều dẫn tới cùng một itemId.
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

  // ── Lượt 1: đường hạnh phúc. Nó cũng là thứ TẠO hàng ability, với id mặc định 'singleton'.
  const first = await practiseOneTurn(request, itemId!, 3);
  expect((first.items as { itemId: string }[])[0]?.itemId).toBe(itemId);

  // ── Biến DB thành đúng bản deploy: đổi DUY NHẤT chuỗi id.
  //
  // Vì sao đổi id thay vì INSERT một hàng: hàng ability có cột DateTime, và định dạng datetime của
  // Prisma trên SQLite là chuyện của tầng adapter, không phải của test này. Để lượt 1 tạo hàng bằng
  // chính app rồi chỉ đổi khoá chính, ta có một hàng HỢP LỆ tuyệt đối mang id không phải 'singleton'
  // — chính xác trạng thái mà migration 2026-08-03 để lại trên máy đã học từ trước.
  const rename = openE2eDb();
  const legacyId = 'clz0legacyabilityrow0004';
  const renamed = rename
    .prepare(`UPDATE "LearnerAbility" SET "id" = ? WHERE "id" = 'singleton'`)
    .run(legacyId);
  rename.close();
  expect(renamed.changes, 'lượt đầu phải tạo hàng ability id singleton để đổi tên').toBe(1);

  // ── Lượt 2: chỗ bug sống. Trước bản sửa, đây là P2025 → cả $transaction rollback → HTTP 200 kèm
  // "Không tìm thấy item với id đó", và lượt luyện bay mất.
  const second = await practiseOneTurn(request, itemId!, 4);
  expect((second.items as { itemId: string }[])[0]?.itemId).toBe(itemId);

  // Bằng chứng nó NẰM LẠI, không phải chỉ trả về đẹp: hai lượt, hai ReviewLog, và ability đếm đủ hai
  // lần quan sát trên đúng hàng cũ. Chốt ở DB vì rollback vẫn có thể trả về một phong bì trông ổn.
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
  // Vì sao ca này tồn tại (2026-08-11): `guard()` đã in `[mcp] tool=<name> ms=<n>` từ đầu, nhưng in ra
  // stdout — nên sau một lần khởi động lại container, câu "Claude gọi tool nào" và câu "tool nào đang
  // hỏng" đều không trả lời được. Đúng cặp câu đó là thứ để bug 2026-08-08 sống trọn một buổi. Bảng
  // `mcp_tool_call` là nơi chúng nằm lại; ca này chốt cả hai nửa của nó: ghi được, và ĐỌC ĐƯỢC.
  await seed();
  const reset = openE2eDb();
  reset.prepare('DELETE FROM mcp_tool_call').run();
  reset.close();

  await initialize(request);
  await callTool(request, 'ping', {});

  // Một lời gọi HỎNG, gọi thẳng (không qua callTool — hàm đó cố ý đỏ khi isError). itemId không tồn
  // tại → Prisma P2025 → guard() trả HTTP 200 kèm isError, đúng cái hình dạng khiến một tool hỏng vô
  // hình với máy khách, với `npm run verify`, và với người học.
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
  // Lời của lỗi phải là lời của Prisma, không phải câu tiếng Việt đã dịch cho Claude: câu kia là lời
  // KHUYÊN, nó đã mất mã lỗi lẫn tên bảng — tức mất đúng phần dùng để gỡ lỗi. Và nó phải là phần CÓ
  // NGHĨA của dump: lần chạy đầu của ca này lưu 400 ký tự đường dẫn chunk Turbopack rồi hết chỗ, đúng
  // lý do `errorDigest` giữ phần đuôi (lib/mcp/tool-kit.ts).
  expect(failed.lastError, `lastError: ${failed.lastError}`).toContain('[P2025 Item]');
  expect(failed.lastError, `lastError: ${failed.lastError}`).toContain('required but not found');
  expect(failed.lastError, 'không lưu đường dẫn chunk của bundler').not.toContain('TURBOPACK');

  // ── Nửa ĐỌC. Một bộ đếm không ai đọc được thì vẫn là log, chỉ chậm hơn. ──────────────────────
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

  await page.goto('/settings');
  // Bấm rồi thử lại tới khi tabpanel thật sự mở: một cú click vào tab Radix TRƯỚC lúc React hydrate
  // xong sẽ trôi mất trong im lặng — Playwright thấy phần tử, còn handler thì chưa gắn. Lần chạy đầu
  // của ca này đỏ đúng như vậy: snapshot lúc thất bại cho thấy tab "Nội dung" vẫn đang được chọn.
  await expect(async () => {
    await page.getByRole('tab', { name: 'Tài khoản' }).click();
    await expect(page.getByRole('tabpanel', { name: 'Tài khoản' })).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30_000 });

  await expect(page.getByRole('cell', { name: 'ping', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'update_grammar' })).toBeVisible();
  await expect(page.getByText('1 tool có lỗi')).toBeVisible();
  await expect(page.getByText(/lỗi gần nhất/)).toBeVisible();
  // Và vế quan trọng nhất với issue #20: những tool KHÔNG được gọi phải được nêu tên, chứ không im
  // lặng — "không có dòng nào" và "chưa bao giờ được gọi" là hai kết luận khác nhau.
  await expect(page.getByText(/tool CHƯA BAO GIỜ được gọi/)).toBeVisible();
  await expect(page.getByText('get_stats', { exact: false })).toBeVisible();
});
