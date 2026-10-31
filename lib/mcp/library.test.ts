import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { UserDb } from '@/lib/db/user-db';
import type { StarterItem } from '@/lib/import/starter-deck';
import { signInTransport } from '@/lib/mcp/test-auth';
import { createTestUser, createTestDb, resetLearningData } from '@/lib/db/test-db';

// Kho chung over the real MCP protocol (phase 8, L5): lookup says when only the shared library has
// something, library_search finds entries and groups, library_take copies them in.

createTestDb('sakubun-mcp-library-');

type Db = typeof import('@/lib/db/db');
let prisma: Db['prisma'];
let db: UserDb;
let client: Client;

const item = (kind: string, expression: string, meaningVi: string, level = 'N5'): StarterItem => ({
  id: `${kind}-${expression}`,
  kind,
  expression,
  reading: kind === 'VOCAB' ? 'みせ' : null,
  hanviet: null,
  meaningVi,
  level,
  notes: '',
  tags: '[]',
  source: 'OPENJLPT',
  suspended: false,
  starred: false,
});
const DECK = [
  item('VOCAB', '店', 'cửa hàng'),
  item('GRAMMAR', '〜わけがない', 'không thể nào', 'N3'),
  item('GRAMMAR', '〜ながら', 'vừa... vừa...'),
];

async function call(name: string, args: Record<string, unknown> = {}) {
  const result = (await client.callTool({ name, arguments: args })) as {
    content: { text: string }[];
    isError?: boolean;
  };
  return { text: result.content.map((c) => c.text).join('\n'), isError: result.isError === true };
}
const entryIdOf = (text: string, what: string) =>
  text
    .split('\n')
    .find((l) => l.includes(what))
    ?.match(/entryId (\S+)/)?.[1] ?? '';

beforeAll(async () => {
  ({ prisma } = await import('@/lib/db/db'));
  db = (await import('@/lib/db/user-db')).userDb(await createTestUser(prisma, 'learner'));
  const { registerAll } = await import('@/lib/mcp/server');
  const server = new McpServer({ name: 'sakubun-mcp', version: '0.1.0' });
  registerAll(server, 'v2');
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  signInTransport(clientSide, 'learner');
  await server.connect(serverSide);
  client = new Client({ name: 'library-test', version: '0.0.0' });
  await client.connect(clientSide);
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await resetLearningData(prisma);
  await prisma.libraryEntry.deleteMany();
  const S = await import('@/lib/library/shared');
  await S.seedOpenJlpt(prisma, DECK);
});

describe('MCP Kho chung', () => {
  it('lookup points to Kho chung when the learner does not have the pattern', async () => {
    const found = await call('lookup', { query: 'わけがない' });
    expect(found.isError).toBe(false);
    expect(found.text).toMatch(
      /^No item in the learner's library matches "わけがない"\. In Kho chung:/,
    );
    expect(found.text).toMatch(
      /entryId \S+ · 〜わけがない · grammar N3 · OpenJLPT · không thể nào/,
    );
    expect(found.text).toContain('offer library_take');

    const none = await call('lookup', { query: '〜ざるを得ない' });
    expect(none.text).toContain('No item matches');
  });

  it('searches entries and groups, and marks what the learner has', async () => {
    const P = await import('@/lib/library/practice');
    await P.addItems(db, [{ expression: '店', meaningVi: 'tiệm' }], 'MANUAL', 'VOCAB');
    const shop = await call('library_search', { query: 'cửa hàng' });
    expect(shop.text).toContain('店 (みせ) · vocab N5 · OpenJLPT · cửa hàng · already in library');

    const groups = await call('library_search', { query: 'N5', kind: 'GRAMMAR' });
    expect(groups.text).toMatch(/entryId \S+ · group "N5 · Ngữ pháp" · 1 items/);

    const none = await call('library_search', { query: 'không có đâu' });
    expect(none.text).toContain('Nothing in Kho chung matches');
  });

  it('takes an entry, then a whole group, into the learner library', async () => {
    const search = await call('library_search', { query: 'わけがない' });
    const took = await call('library_take', { entryId: entryIdOf(search.text, '〜わけがない') });
    expect(took.text).toMatch(/^took 〜わけがない as itemId \S+/);
    expect(await db.item.count({ where: { expression: '〜わけがない', source: 'LIBRARY' } })).toBe(
      1,
    );
    const again = await call('library_take', { entryId: entryIdOf(search.text, '〜わけがない') });
    expect(again.text).toMatch(/^already had 〜わけがない/);

    const groups = await call('library_search', { query: 'N5 · Ngữ pháp' });
    const group = await call('library_take', { entryId: entryIdOf(groups.text, 'group') });
    expect(group.text).toMatch(
      /^took group "N5 · Ngữ pháp" as groupId \S+: 1 new, 0 already in library/,
    );
    expect(await db.group.count()).toBe(1);

    expect((await call('library_take', { entryId: 'nope' })).isError).toBe(true);
  });

  it('sends a shared Kaiwa script to the web instead of taking it', async () => {
    const script = await prisma.libraryEntry.create({
      data: { type: 'SCRIPT', name: 'Ở quán', body: 'A: どうぞ。 | Mời.', origin: 'LEARNER' },
    });
    const took = await call('library_take', { entryId: script.id });
    expect(took.isError).toBe(true);
    expect(took.text).toContain('on the web, in Kho chung');
    expect(await db.script.count()).toBe(0);
  });
});
