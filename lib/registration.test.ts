// The registration gate: this app is single-user and internet-reachable, so account creation must be
// open exactly until the one account exists and closed forever after. That is the whole reason a
// stranger cannot get in, so it is tested against a REAL database rather than by reading the code.
//
// Two layers, both covered here:
//   1. isRegistrationOpen()  — the READ that renders /register and the login page's sign-up link.
//   2. the `user.create` before-hook in lib/auth.ts — the ENFORCEMENT every sign-up path funnels
//      through. Layer 1 alone would leave the Google OAuth callback as an open side door.
//
// Throwaway DB built by applying the committed migrations (lib/test-db.ts): DATABASE_URL is set
// BEFORE lib/db is imported so the Prisma singleton binds to the temp file, never dev.db.

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '@/lib/test-db';

createTestDb('sakubun-registration-');

type Registration = typeof import('@/lib/registration');
type Db = typeof import('@/lib/db');
let R: Registration;
let prisma: Db['prisma'];

beforeAll(async () => {
  R = await import('@/lib/registration');
  ({ prisma } = await import('@/lib/db'));
});

// Each case states its own starting user count, so the door's state is never inherited.
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
  // This case runs the REAL sign-up path twice, so it pays for scrypt twice — a KDF that is slow on
  // purpose. Measured 2026-08-06: the file alone finishes in 1.36s of test time, but inside a full
  // `npm test` (51 files, vitest forking workers that compete for CPU) the same case blows the 5s
  // default and fails as a timeout. It has flaked that way since before the mobile work existed.
  //
  // Raising the budget rather than mocking the hash: what makes this test worth having is that the
  // door is tested through the door — auth.api.signUpEmail, hashing and all. A faster fake would gate
  // a code path nobody uses.
  it('cho tạo tài khoản ĐẦU TIÊN, rồi từ chối tài khoản thứ hai', { timeout: 30_000 }, async () => {
    const { auth } = await import('@/lib/auth');

    const first = await auth.api.signUpEmail({
      body: { name: 'Thiên', email: 'thien@example.test', password: 'mat-khau-du-dai-123' },
    });
    expect(first.user.email).toBe('thien@example.test');
    expect(await prisma.user.count()).toBe(1);

    // The door is now shut. A second sign-up must be REFUSED, not silently accepted.
    await expect(
      auth.api.signUpEmail({
        body: { name: 'Người lạ', email: 'stranger@example.test', password: 'mat-khau-du-dai-456' },
      }),
    ).rejects.toThrow();

    // The decisive assertion: no row was written. An error message alone would not prove the
    // stranger failed to get an account.
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.user.findFirst({ where: { email: 'stranger@example.test' } })).toBeNull();
  });
});
