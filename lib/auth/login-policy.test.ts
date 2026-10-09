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

describe('cổng ở tầng auth (hook tạo user và tạo phiên)', () => {
  // Password login is the test door into the same hooks Google sign-in goes through.
  beforeEach(async () => {
    vi.stubEnv('TEST_PASSWORD_LOGIN', '1');
    vi.stubEnv('ALLOWED_EMAIL', OWNER);
    await prisma.session.deleteMany({});
    await prisma.account.deleteMany({});
    await prisma.user.deleteMany({});
  });

  it('từ chối email lạ ngay cả khi DB còn trống', { timeout: 30_000 }, async () => {
    const { auth } = await import('@/lib/auth/auth');
    await expect(
      auth.api.signUpEmail({
        body: { name: 'Người lạ', email: 'stranger@example.test', password: 'mat-khau-du-dai-456' },
      }),
    ).rejects.toThrow();
    expect(await prisma.user.count()).toBe(0);
  });

  it('cho tạo đúng tài khoản được phép, rồi đóng đăng ký', { timeout: 30_000 }, async () => {
    const { auth } = await import('@/lib/auth/auth');
    const first = await auth.api.signUpEmail({
      body: { name: 'Thiên', email: OWNER, password: 'mat-khau-du-dai-123' },
    });
    expect(first.user.email).toBe(OWNER);
    expect((await prisma.user.findFirst())?.role).toBe('admin');

    vi.stubEnv('ALLOWED_EMAIL', 'second@example.test');
    await expect(
      auth.api.signUpEmail({
        body: { name: 'B', email: 'second@example.test', password: 'mat-khau-du-dai-456' },
      }),
    ).rejects.toThrow();
    expect(await prisma.user.count()).toBe(1);
  });

  it('không cấp phiên cho tài khoản có sẵn trong DB nhưng không phải ALLOWED_EMAIL', { timeout: 30_000 }, async () => {
    const { auth } = await import('@/lib/auth/auth');
    await auth.api.signUpEmail({
      body: { name: 'Thiên', email: OWNER, password: 'mat-khau-du-dai-123' },
    });
    const before = await prisma.session.count();

    vi.stubEnv('ALLOWED_EMAIL', 'someone-else@example.test');
    await expect(
      auth.api.signInEmail({ body: { email: OWNER, password: 'mat-khau-du-dai-123' } }),
    ).rejects.toThrow();
    expect(await prisma.session.count()).toBe(before);
  });
});
