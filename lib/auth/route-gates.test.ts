import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb } from '@/lib/db/test-db';

// Who may call which API route (roadmap 7.2a): the whole-database routes are admin only, the rest
// need any account that is not banned.
createTestDb('sakubun-route-gates-');

const session = vi.hoisted(() => ({ user: null as Record<string, unknown> | null }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/auth/auth', () => ({
  auth: { api: { getSession: async () => (session.user ? { user: session.user } : null) } },
}));

const LEARNER = { id: 'b', role: 'user', email: 'b@example.test', banned: false };
const BANNED = { ...LEARNER, banned: true };

type Handler = (req: Request) => Promise<Response>;
const routes: Record<string, Handler> = {};

beforeAll(async () => {
  routes.backup = (await import('@/app/api/backup/route')).GET;
  routes.system = (await import('@/app/api/import/system/route')).POST;
  routes.tts = (await import('@/app/api/tts/route')).GET;
  routes.mine = (await import('@/app/api/export/mine/route')).GET;
});
beforeEach(() => vi.stubEnv('ALLOWED_EMAIL', 'owner@example.test'));
afterEach(() => {
  session.user = null;
  vi.unstubAllEnvs();
});

const call = (name: string) =>
  routes[name](new Request('http://localhost/x?text=a', { method: 'POST', body: 'x' }));

describe('API route gates', () => {
  it.each(['backup', 'system'])('%s: người học bị từ chối 403', async (name) => {
    session.user = LEARNER;
    const res = await call(name);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, error: 'Chỉ quản trị dùng được.' });
  });

  it.each(['backup', 'system', 'tts', 'mine'])(
    '%s: chưa đăng nhập hoặc bị chặn thì 401',
    async (name) => {
      expect((await call(name)).status).toBe(401);
      session.user = BANNED;
      expect((await call(name)).status).toBe(401);
    },
  );

  it('quản trị qua được cửa của backup', async () => {
    session.user = { id: 'a', role: 'admin', email: 'owner@example.test', banned: false };
    expect((await call('backup')).status).not.toBe(403);
    expect((await call('backup')).status).not.toBe(401);
  });
});
