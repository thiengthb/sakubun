import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '@/lib/db/test-db';

createTestDb('sakubun-registration-');

type Registration = typeof import('@/lib/auth/registration');
type Db = typeof import('@/lib/db/db');
let R: Registration;
let prisma: Db['prisma'];

beforeAll(async () => {
  R = await import('@/lib/auth/registration');
  ({ prisma } = await import('@/lib/db/db'));
});

beforeEach(async () => {
  await prisma.user.deleteMany({});
});

describe('isRegistrationOpen', () => {
  it('mở khi DB chưa có user nào', async () => {
    expect(await R.isRegistrationOpen()).toBe(true);
  });

  it('đóng ngay khi đã có một user', async () => {
    await prisma.user.create({
      data: { id: 'u1', name: 'Thiên', email: 'thien@example.test' },
    });
    expect(await R.isRegistrationOpen()).toBe(false);
  });

  it('vẫn đóng khi có nhiều user (dữ liệu cũ từ thời multi-user)', async () => {
    await prisma.user.createMany({
      data: [
        { id: 'u1', name: 'A', email: 'a@example.test' },
        { id: 'u2', name: 'B', email: 'b@example.test' },
      ],
    });
    expect(await R.isRegistrationOpen()).toBe(false);
  });
});

describe('cổng đăng ký ở tầng auth (user.create before-hook)', () => {
  it('cho tạo tài khoản ĐẦU TIÊN, rồi từ chối tài khoản thứ hai', { timeout: 30_000 }, async () => {
    const { auth } = await import('@/lib/auth/auth');

    const first = await auth.api.signUpEmail({
      body: { name: 'Thiên', email: 'thien@example.test', password: 'mat-khau-du-dai-123' },
    });
    expect(first.user.email).toBe('thien@example.test');
    expect(await prisma.user.count()).toBe(1);

    await expect(
      auth.api.signUpEmail({
        body: { name: 'Người lạ', email: 'stranger@example.test', password: 'mat-khau-du-dai-456' },
      }),
    ).rejects.toThrow();

    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.user.findFirst({ where: { email: 'stranger@example.test' } })).toBeNull();
  });
});
