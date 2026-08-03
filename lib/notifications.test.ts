// DB harness for the notification feed.
//
// The feature's real failure mode is not a missing row — it is a badge that is permanently non-zero and
// therefore stops being read. So the coalescing rules get more attention here than the happy path: what
// folds, what must NOT fold, and that a folded row stops claiming it stands for one event.

import { execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const projectRoot = path.resolve(import.meta.dirname, '..');
const dbFile = path.join(mkdtempSync(path.join(os.tmpdir(), 'sakubun-notif-')), 'test.db');
const url = `file:${dbFile.replace(/\\/g, '/')}`;
process.env.DATABASE_URL = url;
execSync('npx prisma db push --accept-data-loss', {
  cwd: projectRoot,
  env: { ...process.env, DATABASE_URL: url },
  stdio: 'ignore',
});

type Notifications = typeof import('@/lib/notifications');
type Db = typeof import('@/lib/db');

let N: Notifications;
let prisma: Db['prisma'];

const NOW = new Date('2026-07-28T09:00:00Z');
const later = (min: number) => new Date(NOW.getTime() + min * 60_000);

let seq = 0;
async function freshUser(role?: string): Promise<string> {
  const id = `nu${seq++}`;
  await prisma.user.create({
    data: { id, name: id, email: `${id}@example.test`, ...(role ? { role } : {}) },
  });
  return id;
}

beforeAll(async () => {
  N = await import('@/lib/notifications');
  ({ prisma } = await import('@/lib/db'));
});

describe('a notification is recorded and readable', () => {
  it('stores the pointer, not a copy of the subject', async () => {
    const user = await freshUser();
    await N.notify(
      user,
      {
        kind: 'SENTENCE_GRADED',
        title: 'Claude đã chấm một câu',
        body: '3 Good · mẫu 〜わけにはいかない',
        href: '/history?open=sen-1',
        entityId: 'sen-1',
      },
      NOW,
    );
    const [row] = await N.listNotifications(user);
    expect(row.kind).toBe('SENTENCE_GRADED');
    expect(row.href).toBe('/history?open=sen-1');
    expect(row.entityId).toBe('sen-1');
    expect(row.count).toBe(1);
    expect(row.readAt).toBeNull();
  });

  it('counts unread, and read/unread is the only state', async () => {
    const user = await freshUser();
    for (let i = 0; i < 3; i++) {
      await N.notify(user, { kind: 'SENTENCE_GRADED', title: `câu ${i}` }, later(i));
    }
    expect(await N.unreadCount(user)).toBe(3);
    const rows = await N.listNotifications(user);
    expect(await N.markRead(user, rows[0].id, later(10))).toBe(true);
    expect(await N.unreadCount(user)).toBe(2);
    expect(await N.markAllRead(user, later(11))).toBe(2);
    expect(await N.unreadCount(user)).toBe(0);
    // Already-read rows stay in the list; there is no archive to lose them into.
    expect(await N.listNotifications(user)).toHaveLength(3);
  });

  it('marking an already-read row again is a no-op, not a second write', async () => {
    const user = await freshUser();
    await N.notify(user, { kind: 'SENTENCE_GRADED', title: 'x' }, NOW);
    const [row] = await N.listNotifications(user);
    expect(await N.markRead(user, row.id, later(1))).toBe(true);
    expect(await N.markRead(user, row.id, later(2))).toBe(false);
    const [after] = await N.listNotifications(user);
    expect(after.readAt).toEqual(later(1));
  });
});

describe('coalescing — the rule that keeps the badge worth reading', () => {
  it('folds same-kind events into ONE row that reports the real number', async () => {
    const user = await freshUser();
    for (let i = 0; i < 12; i++) {
      await N.notify(
        user,
        {
          kind: 'ITEMS_ADDED',
          title: 'Claude đã thêm 1 mục vào kho',
          pluralTitle: (n) => `Claude đã thêm ${n} mục vào kho`,
        },
        later(i),
      );
    }
    const rows = await N.listNotifications(user);
    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(12);
    expect(rows[0].title).toBe('Claude đã thêm 12 mục vào kho');
    expect(await N.unreadCount(user)).toBe(1);
  });

  it('NEVER folds a graded sentence — each one points at a different modal', async () => {
    const user = await freshUser();
    for (const id of ['s1', 's2', 's3']) {
      await N.notify(
        user,
        { kind: 'SENTENCE_GRADED', title: 'đã chấm', entityId: id, href: `/history?open=${id}` },
        NOW,
      );
    }
    const rows = await N.listNotifications(user);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.entityId).sort()).toEqual(['s1', 's2', 's3']);
  });

  it('folds per SUBJECT for entity-scoped kinds, so two sentences stay two rows', async () => {
    const user = await freshUser();
    await N.notify(user, { kind: 'SENTENCE_LIKED', title: 'thích', entityId: 'a' }, NOW);
    await N.notify(user, { kind: 'SENTENCE_LIKED', title: 'thích', entityId: 'a' }, later(1));
    await N.notify(user, { kind: 'SENTENCE_LIKED', title: 'thích', entityId: 'b' }, later(2));
    const rows = await N.listNotifications(user);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.entityId === 'a')!.count).toBe(2);
    expect(rows.find((r) => r.entityId === 'b')!.count).toBe(1);
  });

  it('starts a NEW row once the window has passed', async () => {
    const user = await freshUser();
    await N.notify(user, { kind: 'ITEMS_ADDED', title: 'thêm' }, NOW);
    await N.notify(user, { kind: 'ITEMS_ADDED', title: 'thêm' }, later(N.COALESCE_WINDOW_MIN + 1));
    expect(await N.listNotifications(user)).toHaveLength(2);
  });

  it('never folds into a row the learner has already READ', async () => {
    // Folding into a read row would silently resurrect it as unread, or hide the new event entirely.
    const user = await freshUser();
    await N.notify(user, { kind: 'ITEMS_ADDED', title: 'thêm' }, NOW);
    const [first] = await N.listNotifications(user);
    await N.markRead(user, first.id, later(1));
    await N.notify(user, { kind: 'ITEMS_ADDED', title: 'thêm' }, later(2));
    const rows = await N.listNotifications(user);
    expect(rows).toHaveLength(2);
    expect(await N.unreadCount(user)).toBe(1);
  });

  it('a folded row rises back to the top of the list', async () => {
    const user = await freshUser();
    await N.notify(user, { kind: 'ITEMS_ADDED', title: 'thêm' }, NOW);
    await N.notify(user, { kind: 'SENTENCE_GRADED', title: 'chấm' }, later(5));
    await N.notify(user, { kind: 'ITEMS_ADDED', title: 'thêm' }, later(10));
    const rows = await N.listNotifications(user);
    expect(rows[0].kind).toBe('ITEMS_ADDED');
    expect(rows[0].count).toBe(2);
  });
});

describe('tenancy is fail-closed', () => {
  it('never returns or marks another member notification', async () => {
    const owner = await freshUser();
    const stranger = await freshUser();
    await N.notify(owner, { kind: 'SENTENCE_GRADED', title: 'của tôi' }, NOW);
    expect(await N.listNotifications(stranger)).toHaveLength(0);
    expect(await N.unreadCount(stranger)).toBe(0);
    const [row] = await N.listNotifications(owner);
    expect(await N.markRead(stranger, row.id)).toBe(false);
    expect(await N.unreadCount(owner)).toBe(1);
  });

  it('markAllRead touches only the caller', async () => {
    const a = await freshUser();
    const b = await freshUser();
    await N.notify(a, { kind: 'SENTENCE_GRADED', title: 'a' }, NOW);
    await N.notify(b, { kind: 'SENTENCE_GRADED', title: 'b' }, NOW);
    expect(await N.markAllRead(a)).toBe(1);
    expect(await N.unreadCount(b)).toBe(1);
  });
});

describe('admin fan-out', () => {
  it('reaches every admin and nobody else', async () => {
    const admin1 = await freshUser('admin');
    const admin2 = await freshUser('admin');
    const member = await freshUser();
    await N.notifyAdmins({ kind: 'USER_REGISTERED', title: 'có người mới đăng ký' }, NOW);
    expect(await N.unreadCount(admin1)).toBe(1);
    expect(await N.unreadCount(admin2)).toBe(1);
    expect(await N.unreadCount(member)).toBe(0);
  });

  it('skips a banned admin', async () => {
    const banned = await freshUser('admin');
    await prisma.user.update({ where: { id: banned }, data: { banned: true } });
    await N.notifyAdmins({ kind: 'USER_REGISTERED', title: 'x' }, NOW);
    expect(await N.unreadCount(banned)).toBe(0);
  });
});
