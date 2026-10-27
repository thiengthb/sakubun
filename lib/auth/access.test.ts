import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accountAccess, refuseAccess } from './access';

describe('accountAccess', () => {
  beforeEach(() => vi.stubEnv('ALLOWED_EMAIL', 'owner@example.test'));
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    [{ role: 'admin', email: 'a@example.test' }, 'admin'],
    [{ role: 'user', email: 'Owner@example.test' }, 'admin'],
    [{ role: null, email: 'owner@example.test' }, 'admin'],
    [{ role: 'user', email: 'b@example.test' }, 'learner'],
    [{ role: 'user', banned: false, email: 'b@example.test' }, 'learner'],
    [{ role: 'user', banned: true, email: 'b@example.test' }, 'none'],
    [{ role: 'admin', banned: true, email: 'owner@example.test' }, 'none'],
    [{ role: null, email: 'b@example.test' }, 'none'],
    [{ role: 'pending', email: 'b@example.test' }, 'none'],
    [{ role: 'Admin', email: 'b@example.test' }, 'none'],
    [{}, 'none'],
  ] as const)('%o → %s', (user, want) => {
    expect(accountAccess(user)).toBe(want);
  });

  it('không có tài khoản thì không có quyền', () => {
    expect(accountAccess(null)).toBe('none');
    expect(accountAccess(undefined)).toBe('none');
  });

  it('chưa đặt ALLOWED_EMAIL thì chỉ role quyết định', () => {
    vi.stubEnv('ALLOWED_EMAIL', '');
    expect(accountAccess({ role: null, email: 'owner@example.test' })).toBe('none');
    expect(accountAccess({ role: 'admin', email: 'owner@example.test' })).toBe('admin');
  });
});

describe('refuseAccess', () => {
  it('401 khi không có quyền, 403 khi người học gọi việc của quản trị', async () => {
    expect(refuseAccess('none', 'learner')?.status).toBe(401);
    expect(refuseAccess('none', 'admin')?.status).toBe(401);
    const forbidden = refuseAccess('learner', 'admin');
    expect(forbidden?.status).toBe(403);
    expect(await forbidden?.json()).toEqual({ ok: false, error: 'Chỉ quản trị dùng được.' });
  });

  it('cho qua khi đủ quyền', () => {
    expect(refuseAccess('learner', 'learner')).toBeNull();
    expect(refuseAccess('admin', 'learner')).toBeNull();
    expect(refuseAccess('admin', 'admin')).toBeNull();
  });
});
