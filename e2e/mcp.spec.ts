// Bề mặt MCP — chỗ Claude Desktop nối vào, và cho tới hôm nay KHÔNG có một dòng test browser nào.
//
// Vì sao viết bây giờ: đợt rà soát phát hiện `mcp-handler@1.1.0` ghim peer `@modelcontextprotocol/sdk`
// ở ĐÚNG `1.26.0` trong khi project khai `^1.30.0`, và `.npmrc` bật `legacy-peer-deps=true` nên
// `npm install` không kêu một tiếng. Muốn chỉnh version đó thì phải có cái gì đó chứng minh tầng MCP
// còn sống trước và sau — nếu không thì đấy là đổi mù. Unit test của `lib/mcp/**` kiểm phần render và
// phần thuần, không kiểm việc handler thật có nói được giao thức JSON-RPC qua HTTP hay không.
//
// Ba điều được chốt, và cả ba đều là ranh giới chứ không phải đường hạnh phúc:
//   1. KHÔNG token → 401. Đây là toàn bộ biên giới của bề mặt máy (`withMcpAuth({required:true})`).
//   2. Token SAI → 401. Khác (1): chứng minh server thật sự TRA token chứ không chỉ kiểm có header.
//   3. Token ĐÚNG → initialize + tools/list + gọi `ping` chạy hết một vòng JSON-RPC.
import path from 'node:path';
import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { E2E_BASE_URL, E2E_DB_FILE, E2E_EMAIL, seedE2eAccount } from './fixtures';

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
