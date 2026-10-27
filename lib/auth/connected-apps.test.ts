import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, createTestUser } from '@/lib/db/test-db';

createTestDb('sakubun-connected-apps-');

type Apps = typeof import('./connected-apps');
let A: Apps;
let prisma: typeof import('@/lib/db/db').prisma;

beforeAll(async () => {
  A = await import('./connected-apps');
  ({ prisma } = await import('@/lib/db/db'));
});

const T0 = new Date('2026-10-20T00:00:00Z');

async function client(clientId: string, name: string | null) {
  await prisma.oauthClient.create({
    data: { id: clientId, clientId, name, uri: 'https://claude.ai', redirectUris: '[]' },
  });
}

async function connect(userId: string, clientId: string, at: Date) {
  await prisma.oauthConsent.create({
    data: {
      id: `${userId}-${clientId}`,
      clientId,
      userId,
      scopes: 'openid offline_access',
      createdAt: at,
      updatedAt: at,
    },
  });
  await prisma.oauthRefreshToken.create({
    data: {
      id: `${userId}-${clientId}-r`,
      token: `${userId}-${clientId}-rt`,
      clientId,
      userId,
      expiresAt: new Date('2027-01-01'),
      createdAt: new Date(at.getTime() + 3_600_000),
      scopes: 'openid offline_access',
    },
  });
  await prisma.oauthAccessToken.create({
    data: {
      id: `${userId}-${clientId}-a`,
      token: `${userId}-${clientId}-at`,
      clientId,
      userId,
      expiresAt: new Date('2027-01-01'),
      createdAt: at,
      scopes: 'openid',
    },
  });
}

describe('connected apps', () => {
  beforeEach(async () => {
    await prisma.oauthClient.deleteMany({});
    await prisma.user.deleteMany({});
    await createTestUser(prisma, 'lan');
    await createTestUser(prisma, 'minh');
    await client('claude', 'Claude');
    await client('nameless', null);
  });

  it('liệt kê ứng dụng của riêng người học, kèm lần lấy token gần nhất', async () => {
    await connect('lan', 'claude', T0);
    await connect('lan', 'nameless', new Date('2026-10-21T00:00:00Z'));
    await connect('minh', 'claude', T0);

    const apps = await A.listConnectedApps('lan');
    expect(apps.map((a) => a.name)).toEqual(['Claude', 'Ứng dụng không tên']);
    expect(apps[0]).toMatchObject({
      clientId: 'claude',
      uri: 'https://claude.ai',
      connectedAt: T0,
    });
    expect(apps[0].lastUsedAt?.toISOString()).toBe('2026-10-20T01:00:00.000Z');
    expect(await A.listConnectedApps('nobody')).toEqual([]);
  });

  it('thu hồi thì mất đồng ý và token của người đó, người khác dùng cùng app vẫn giữ', async () => {
    await connect('lan', 'claude', T0);
    await connect('minh', 'claude', T0);
    const now = new Date('2026-10-27T00:00:00Z');

    expect(await A.revokeConnectedApp('lan', 'claude', now)).toBe(true);
    expect(await A.hasConsent('lan', 'claude')).toBe(false);
    expect(await A.listConnectedApps('lan')).toEqual([]);
    const lanRefresh = await prisma.oauthRefreshToken.findUnique({ where: { id: 'lan-claude-r' } });
    expect(lanRefresh?.revoked).toEqual(now);
    const lanAccess = await prisma.oauthAccessToken.findUnique({ where: { id: 'lan-claude-a' } });
    expect(lanAccess?.revoked).toEqual(now);

    expect(await A.hasConsent('minh', 'claude')).toBe(true);
    const minhRefresh = await prisma.oauthRefreshToken.findUnique({
      where: { id: 'minh-claude-r' },
    });
    expect(minhRefresh?.revoked).toBeNull();
  });

  it('thu hồi app chưa kết nối thì báo false, không đụng gì', async () => {
    await connect('minh', 'claude', T0);
    expect(await A.revokeConnectedApp('lan', 'claude')).toBe(false);
    expect(await A.hasConsent('minh', 'claude')).toBe(true);
  });

  it('có kết nối AI khi có đồng ý OAuth hoặc token MCP đầy đủ, không tính token planner', async () => {
    expect(await A.hasAiConnection('lan')).toBe(false);

    await prisma.mcpKey.create({
      data: { userId: 'lan', name: 'hermes', tokenHash: 'h-planner', scope: 'planner' },
    });
    expect(await A.hasAiConnection('lan')).toBe(false);

    await prisma.mcpKey.create({ data: { userId: 'lan', name: 'desktop', tokenHash: 'h-full' } });
    expect(await A.hasAiConnection('lan')).toBe(true);

    await connect('minh', 'claude', T0);
    expect(await A.hasAiConnection('minh')).toBe(true);
  });
});
