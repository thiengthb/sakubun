// The registration gate: this app is single-user and internet-reachable, so account creation must be
// open exactly until the one account exists and closed forever after. That is the whole reason a
// stranger cannot get in, so it is tested against a REAL database rather than by reading the code.
//
// Two layers, both covered here:
//   1. isRegistrationOpen()  — the READ that renders /register and the login page's sign-up link.
//   2. the `user.create` before-hook in lib/auth.ts — the ENFORCEMENT every sign-up path funnels
//      through. Layer 1 alone would leave the Google OAuth callback as an open side door.
//
// Same throwaway-DB harness as lib/tenancy.test.ts: DATABASE_URL is set BEFORE lib/db is imported so
// the Prisma singleton binds to the temp file, never dev.db.

import { execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

const projectRoot = path.resolve(import.meta.dirname, '..');
const dbFile = path.join(mkdtempSync(path.join(os.tmpdir(), 'sakubun-registration-')), 'test.db');
const url = `file:${dbFile.replace(/\\/g, '/')}`;
process.env.DATABASE_URL = url;
execSync('npx prisma db push --accept-data-loss', {
  cwd: projectRoot,
  env: { ...process.env, DATABASE_URL: url },
  stdio: 'ignore',
});

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
  it('cho tạo tài khoản ĐẦU TIÊN, rồi từ chối tài khoản thứ hai', async () => {
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
