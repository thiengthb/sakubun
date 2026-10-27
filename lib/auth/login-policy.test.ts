import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb } from '@/lib/db/test-db';

createTestDb('sakubun-login-policy-');

const OWNER = 'owner@example.test';

type Policy = typeof import('@/lib/auth/login-policy');
type Db = typeof import('@/lib/db/db');
let P: Policy;
let prisma: Db['prisma'];

beforeAll(async () => {
  P = await import('@/lib/auth/login-policy');
  ({ prisma } = await import('@/lib/db/db'));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('isAllowedEmail', () => {
  it('chặn hết khi chưa đặt ALLOWED_EMAIL', () => {
    vi.stubEnv('ALLOWED_EMAIL', '');
    expect(P.isAllowedEmail(OWNER)).toBe(false);
  });

  it('chỉ nhận đúng email đã đặt, không phân biệt hoa thường và khoảng trắng', () => {
    vi.stubEnv('ALLOWED_EMAIL', ' Owner@Example.test ');
    expect(P.isAllowedEmail('OWNER@example.TEST')).toBe(true);
    expect(P.isAllowedEmail('owner@example.test.evil')).toBe(false);
    expect(P.isAllowedEmail('stranger@example.test')).toBe(false);
    expect(P.isAllowedEmail(null)).toBe(false);
  });
});

describe('isPasswordLoginEnabled', () => {
  it('không bao giờ bật trong bản production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('TEST_PASSWORD_LOGIN', '1');
    expect(P.isPasswordLoginEnabled()).toBe(false);
  });

  it('tắt mặc định, chỉ bật khi test đặt TEST_PASSWORD_LOGIN=1', () => {
    vi.stubEnv('TEST_PASSWORD_LOGIN', '');
    expect(P.isPasswordLoginEnabled()).toBe(false);
    vi.stubEnv('TEST_PASSWORD_LOGIN', '1');
    expect(P.isPasswordLoginEnabled()).toBe(true);
  });
});

describe('maxAccounts', () => {
  it('mặc định 50, đọc MAX_ACCOUNTS khi là số nguyên dương', () => {
    vi.stubEnv('MAX_ACCOUNTS', '');
    expect(P.maxAccounts()).toBe(50);
    vi.stubEnv('MAX_ACCOUNTS', '3');
    expect(P.maxAccounts()).toBe(3);
    for (const bad of ['0', '-2', '2.5', 'abc']) {
      vi.stubEnv('MAX_ACCOUNTS', bad);
      expect(P.maxAccounts()).toBe(50);
    }
  });
});

describe('cổng ở tầng auth (hook tạo user và tạo phiên)', () => {
  // Password login is the test door into the same hooks Google sign-in goes through.
  beforeEach(async () => {
    vi.stubEnv('TEST_PASSWORD_LOGIN', '1');
    vi.stubEnv('ALLOWED_EMAIL', OWNER);
    await prisma.session.deleteMany({});
    await prisma.account.deleteMany({});
    await prisma.user.deleteMany({});
  });

  it('ai cũng đăng ký được: email lạ thành người học và nhận kho OpenJLPT riêng', { timeout: 60_000 }, async () => {
    const { auth } = await import('@/lib/auth/auth');
    const { userDb } = await import('@/lib/db/user-db');
    const res = await auth.api.signUpEmail({
      body: { name: 'Người lạ', email: 'stranger@example.test', password: 'mat-khau-du-dai-456' },
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: res.user.id } });
    expect(user.role).toBe('user');
    expect(await userDb(user.id).item.count({ where: { source: 'OPENJLPT' } })).toBeGreaterThan(7000);
  });

  it('ALLOWED_EMAIL thành quản trị và không nhận thêm kho', { timeout: 30_000 }, async () => {
    const { auth } = await import('@/lib/auth/auth');
    const { userDb } = await import('@/lib/db/user-db');
    const res = await auth.api.signUpEmail({
      body: { name: 'Thiên', email: OWNER, password: 'mat-khau-du-dai-123' },
    });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: res.user.id } })).role).toBe('admin');
    expect(await userDb(res.user.id).item.count()).toBe(0);
  });

  it('đóng đăng ký khi đã đủ MAX_ACCOUNTS', { timeout: 30_000 }, async () => {
    const { auth } = await import('@/lib/auth/auth');
    vi.stubEnv('MAX_ACCOUNTS', '1');
    await auth.api.signUpEmail({
      body: { name: 'Thiên', email: OWNER, password: 'mat-khau-du-dai-123' },
    });
    await expect(
      auth.api.signUpEmail({
        body: { name: 'B', email: 'second@example.test', password: 'mat-khau-du-dai-456' },
      }),
    ).rejects.toThrow();
    expect(await prisma.user.count()).toBe(1);
  });

  it('tài khoản bị chặn không được cấp phiên', { timeout: 30_000 }, async () => {
    const { auth } = await import('@/lib/auth/auth');
    await auth.api.signUpEmail({
      body: { name: 'Thiên', email: OWNER, password: 'mat-khau-du-dai-123' },
    });
    await prisma.user.update({ where: { email: OWNER }, data: { banned: true } });
    const before = await prisma.session.count();

    await expect(
      auth.api.signInEmail({ body: { email: OWNER, password: 'mat-khau-du-dai-123' } }),
    ).rejects.toThrow();
    expect(await prisma.session.count()).toBe(before);
  });
});
