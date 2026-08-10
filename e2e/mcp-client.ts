// Máy khách MCP cho e2e — JSON-RPC qua HTTP với bearer token, đúng đường Claude Desktop đi.
//
// Tách ra khỏi spec vì đã có HAI spec cần nó (`mcp-tools` gọi cả 31 tool, `mcp-practice-loops` chạy
// bốn kiểu luyện), và bản sao thứ hai của một máy khách là bản sẽ lệch: hai spec sẽ parse SSE khác
// nhau, seed token khác nhau, rồi hỏng vì lý do không liên quan tới thứ chúng đang kiểm.
//
// KHÔNG nằm trong `fixtures.ts`: file đó là DB + tài khoản, dùng bởi mọi spec kể cả spec browser. Bề
// mặt MCP là chuyện của riêng nhóm spec này.

import { createHash } from 'node:crypto';
import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, type APIRequestContext } from '@playwright/test';
import { E2E_BASE_URL, E2E_DB_FILE, E2E_EMAIL, seedE2eAccount } from './fixtures';

/** Token thật của một máy khách; DB chỉ giữ SHA-256 của nó (lib/mcp-key.ts). */
export const MCP_TOKEN = ['e2e', 'mcp', 'client', '0123456789'].join('-');
export const MCP_URL = `${E2E_BASE_URL}/api/mcp`;

export const MCP_HEADERS = {
  'content-type': 'application/json',
  accept: 'application/json, text/event-stream',
  authorization: `Bearer ${MCP_TOKEN}`,
};

/**
 * Bảng dữ liệu học, CON TRƯỚC CHA (khoá ngoại SQLite).
 *
 * Cả bộ e2e dùng chung một DB tạm, nên một spec không dọn là một spec phụ thuộc thứ tự file — và nó sẽ
 * đỏ vì spec chạy trước nó, không vì thứ nó đang kiểm.
 */
export const LEARNING_TABLES = [
  'ReviewLog',
  'Sentence',
  'SrsState',
  'GroupMember',
  'Group',
  'Item',
  'CalibrationProposal',
  'LearnerNote',
  'LearnerAbility',
  'Settings',
] as const;

export function openE2eDb(): Database.Database {
  return new Database(path.join(process.cwd(), E2E_DB_FILE));
}

/** Tài khoản e2e + một McpKey dùng `MCP_TOKEN`, và (mặc định) dọn sạch bảng học. */
export async function seedMcpAccount({ resetLearningTables = true } = {}): Promise<void> {
  await seedE2eAccount();
  const db = openE2eDb();
  try {
    const user = db.prepare('SELECT id FROM user WHERE email = ?').get(E2E_EMAIL) as
      | { id: string }
      | undefined;
    if (!user) throw new Error('chưa seed được tài khoản e2e');

    db.prepare('DELETE FROM mcp_key').run();
    db.prepare(
      `INSERT INTO mcp_key (id, userId, name, tokenHash, lastUsedAt, createdAt)
       VALUES ('mcpk-e2e-client', ?, 'e2e', ?, NULL, ?)`,
    ).run(user.id, createHash('sha256').update(MCP_TOKEN).digest('hex'), new Date().toISOString());

    if (resetLearningTables) {
      for (const table of LEARNING_TABLES) db.prepare(`DELETE FROM "${table}"`).run();
    }
  } finally {
    db.close();
  }
}

/** MCP nói JSON-RPC qua Streamable HTTP; server trả `text/event-stream`, nên nhận cả hai kiểu. */
export function parseRpc(body: string): Record<string, unknown> {
  const line = body.split('\n').find((l) => l.startsWith('data:'));
  return JSON.parse(line ? line.slice(5).trim() : body) as Record<string, unknown>;
}

let rpcId = 1000;

export async function rpc(
  api: APIRequestContext,
  method: string,
  params: unknown,
): Promise<Record<string, unknown>> {
  const res = await api.post(MCP_URL, {
    headers: MCP_HEADERS,
    data: { jsonrpc: '2.0', id: ++rpcId, method, params },
  });
  expect(res.status(), `${method} phải trả 200: ${await res.text()}`).toBe(200);
  return parseRpc(await res.text());
}

/**
 * Bắt tay giao thức. KHÔNG có `mcp-session-id`: `lib/mcp/server.ts` dựng handler với `disableSse: true`
 * (chế độ STATELESS), nên server không cấp session và request sau cũng không cần gửi kèm.
 */
export async function initializeMcp(api: APIRequestContext): Promise<void> {
  const body = await rpc(api, 'initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'e2e', version: '0' },
  });
  expect(body.result, 'initialize phải trả result').toBeTruthy();
}

export interface ToolResult {
  text: string;
  isError: boolean;
}

/**
 * Một `tools/call`.
 *
 * Trả về `isError` chứ không throw, vì `guard()` (lib/mcp/tool-kit.ts) biến MỌI exception thành
 * `isError: true` với HTTP **200** — cố ý, để Claude đọc được lời lỗi thay vì một -32603 trần. Nghĩa
 * là chốt trên status code là chốt vào chỗ không có tín hiệu; người gọi phải soi `isError`.
 */
export async function callTool(
  api: APIRequestContext,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const body = await rpc(api, 'tools/call', { name, arguments: args });
  const result = (body.result ?? {}) as { content?: { text?: string }[]; isError?: boolean };
  return { text: result.content?.[0]?.text ?? '', isError: result.isError === true };
}

/** Như `callTool` nhưng ĐỎ ngay nếu tool trả lỗi, kèm nguyên văn lời lỗi. */
export async function callToolOk(
  api: APIRequestContext,
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await callTool(api, name, args);
  expect(res.isError, `tool ${name} trả lỗi: ${res.text}`).toBe(false);
  return toolJson(res.text);
}

/**
 * JSON trong kết quả tool. `ok()` trả JSON trần; các tool người học ĐỌC (`stage_sentence`,
 * `submit_review`) trả markdown rồi kèm khối ```json — vì phần markdown là hợp đồng hiển thị mà Claude
 * chép nguyên văn.
 */
export function toolJson(text: string): Record<string, unknown> {
  const fence = text.match(/```json\n([\s\S]*?)\n```/);
  try {
    return JSON.parse(fence ? fence[1] : text) as Record<string, unknown>;
  } catch {
    return {};
  }
}
