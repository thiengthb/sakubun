import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { UserDb } from '@/lib/db/user-db';
import { signInTransport } from '@/lib/mcp/test-auth';
import { createTestUser, createTestDb, resetLearningData } from '@/lib/db/test-db';

// The Kaiwa tools over the real MCP protocol (phase 8, K2): the AI saves a draft the learner
// approved, reads it back, and cannot overwrite an edit made after it read.

createTestDb('sakubun-mcp-kaiwa-');

type Db = typeof import('@/lib/db/db');
let prisma: Db['prisma'];
let db: UserDb;
let client: Client;

const BODY = 'A: いらっしゃいませ。 | Xin mời vào.\nB: 二人です。 | Hai người.';

async function call(name: string, args: Record<string, unknown> = {}) {
  const result = (await client.callTool({ name, arguments: args })) as {
    content: { text: string }[];
    isError?: boolean;
  };
  return { text: result.content.map((c) => c.text).join('\n'), isError: result.isError === true };
}

const scriptIdIn = (text: string) => text.match(/scriptId (\S+)/)?.[1] ?? '';

beforeAll(async () => {
  ({ prisma } = await import('@/lib/db/db'));
  db = (await import('@/lib/db/user-db')).userDb(await createTestUser(prisma, 'learner'));
  await createTestUser(prisma, 'other');
  const { registerAll } = await import('@/lib/mcp/server');
  const server = new McpServer({ name: 'sakubun-mcp', version: '0.1.0' });
  registerAll(server, 'v2');
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  signInTransport(clientSide, 'learner');
  await server.connect(serverSide);
  client = new Client({ name: 'kaiwa-test', version: '0.0.0' });
  await client.connect(clientSide);
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await resetLearningData(prisma);
});

describe('MCP Kaiwa', () => {
  it('saves a new script and hands back the view link', async () => {
    const saved = await call('kaiwa_save', { title: 'Ở nhà hàng', body: BODY });
    expect(saved.isError).toBe(false);
    const id = scriptIdIn(saved.text);
    expect(saved.text).toContain('version 1 · 2 lines');
    expect(saved.text).toContain(`view: http://localhost:3789/kaiwa/${id}`);
    expect(await db.script.count()).toBe(1);
  });

  it('returns the format errors and saves nothing', async () => {
    const saved = await call('kaiwa_save', { title: 'Ở nhà hàng', body: `## Cảnh 1\n${BODY}` });
    expect(saved).toEqual({ isError: true, text: expect.stringMatching(/^Dòng 1: /) });
    expect(await db.script.count()).toBe(0);
  });

  it('lists titles, reads a script with its version, and replaces it with that version', async () => {
    const id = scriptIdIn((await call('kaiwa_save', { title: 'Ở nhà hàng', body: BODY })).text);
    const list = await call('kaiwa_list');
    expect(list.text).toContain(`scriptId ${id} · version 1`);
    expect(list.text).not.toContain('いらっしゃいませ');

    const read = await call('kaiwa_get', { scriptId: id });
    expect(read.text).toContain(BODY);
    expect(read.text).toContain('kaiwa_save with scriptId and version 1');

    const saved = await call('kaiwa_save', {
      scriptId: id,
      version: 1,
      title: 'Ở nhà hàng',
      body: `${BODY}\nA: かしこまりました。 | Vâng ạ.`,
    });
    expect(saved.text).toContain('version 2 · 3 lines');
  });

  it('refuses a save from a stale read, so the learner’s web edit is kept', async () => {
    const id = scriptIdIn((await call('kaiwa_save', { title: 'Ở nhà hàng', body: BODY })).text);
    const { saveScript } = await import('@/lib/kaiwa/scripts');
    await saveScript(db, { id, version: 1, title: 'Sửa trên web', body: BODY });

    const stale = await call('kaiwa_save', { scriptId: id, version: 1, title: 'AI', body: BODY });
    expect(stale).toEqual({ isError: true, text: expect.stringContaining('Đọc lại bản mới') });
    expect((await db.script.findFirst({ where: { id } }))?.title).toBe('Sửa trên web');
  });

  it('does not read another learner’s script', async () => {
    const { userDb } = await import('@/lib/db/user-db');
    const { saveScript } = await import('@/lib/kaiwa/scripts');
    const theirs = await saveScript(userDb('other'), { title: 'Riêng', body: BODY });
    if (!theirs.ok) throw new Error(theirs.error);
    const read = await call('kaiwa_get', { scriptId: theirs.data.id });
    expect(read).toEqual({ isError: true, text: expect.stringContaining('Unknown scriptId') });
    expect((await call('kaiwa_list')).text).toContain('No scripts yet.');
  });
});
