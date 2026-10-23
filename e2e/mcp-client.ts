import { createHash } from 'node:crypto';
import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, type APIRequestContext } from '@playwright/test';
import { E2E_BASE_URL, E2E_DB_FILE, E2E_EMAIL, seedE2eAccount } from './fixtures';

export const MCP_TOKEN = ['e2e', 'mcp', 'client', '0123456789'].join('-');
export const MCP_URL = `${E2E_BASE_URL}/api/mcp`;

export const MCP_HEADERS = {
  'content-type': 'application/json',
  accept: 'application/json, text/event-stream',
  authorization: `Bearer ${MCP_TOKEN}`,
};

export const LEARNING_TABLES = [
  'ReviewLog',
  'Turn',
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

export async function seedMcpAccount({ resetLearningTables = true } = {}): Promise<void> {
  await seedE2eAccount();
  const db = openE2eDb();
  try {
    const user = db.prepare('SELECT id FROM user WHERE email = ?').get(E2E_EMAIL) as
      { id: string } | undefined;
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

export function parseRpc(body: string): Record<string, unknown> {
  const line = body.split('\n').find((l) => l.startsWith('data:'));
  return JSON.parse(line ? line.slice(5).trim() : body) as Record<string, unknown>;
}

let rpcId = 1000;

export async function rpc(
  api: APIRequestContext,
  method: string,
  params: unknown,
  url: string = MCP_URL,
): Promise<Record<string, unknown>> {
  const res = await api.post(url, {
    headers: MCP_HEADERS,
    data: { jsonrpc: '2.0', id: ++rpcId, method, params },
  });
  expect(res.status(), `${method} phải trả 200: ${await res.text()}`).toBe(200);
  return parseRpc(await res.text());
}

export async function initializeMcp(api: APIRequestContext, url: string = MCP_URL): Promise<void> {
  const body = await rpc(
    api,
    'initialize',
    {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'e2e', version: '0' },
    },
    url,
  );
  expect(body.result, 'initialize phải trả result').toBeTruthy();
}

export interface ToolResult {
  text: string;
  isError: boolean;
}

export async function callTool(
  api: APIRequestContext,
  name: string,
  args: Record<string, unknown>,
  url: string = MCP_URL,
): Promise<ToolResult> {
  const body = await rpc(api, 'tools/call', { name, arguments: args }, url);
  const result = (body.result ?? {}) as { content?: { text?: string }[]; isError?: boolean };
  return { text: result.content?.[0]?.text ?? '', isError: result.isError === true };
}

export async function callToolOk(
  api: APIRequestContext,
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await callTool(api, name, args);
  expect(res.isError, `tool ${name} trả lỗi: ${res.text}`).toBe(false);
  return toolJson(res.text);
}

export function toolJson(text: string): Record<string, unknown> {
  const fence = text.match(/```json\n([\s\S]*?)\n```/);
  try {
    return JSON.parse(fence ? fence[1] : text) as Record<string, unknown>;
  } catch {
    return {};
  }
}
