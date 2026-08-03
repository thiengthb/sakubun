// Shared-feed + comments test (Phase 4). Real throwaway SQLite (same harness as library/tenancy tests).
// Proves: share/unshare scoped to the owner; the feed shows SHARED attempts only (content columns, never
// a private one or a schedule); comments only on a visible sentence; delete allowed for the comment
// author OR the sentence owner, nobody else. DATABASE_URL is set BEFORE lib/db imports.

import { execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const projectRoot = path.resolve(import.meta.dirname, '..');
const dbFile = path.join(mkdtempSync(path.join(os.tmpdir(), 'sakubun-feed-')), 'test.db');
const url = `file:${dbFile.replace(/\\/g, '/')}`;
process.env.DATABASE_URL = url;
execSync('npx prisma db push --accept-data-loss', {
  cwd: projectRoot,
  env: { ...process.env, DATABASE_URL: url },
  stdio: 'ignore',
});

type Feed = typeof import('@/lib/feed');
type Db = typeof import('@/lib/db');
let F: Feed;
let prisma: Db['prisma'];

const USER_A = 'user-a';
const USER_B = 'user-b';
const USER_C = 'user-c';

let sharedId = ''; // A's shared graded attempt
let privateId = ''; // A's private graded attempt

async function makeSentence(userId: string, sourceText: string): Promise<string> {
  const s = await prisma.sentence.create({
    data: {
      userId,
      direction: 'JA_VI',
      sourceText,
      userAnswer: 'câu trả lời',
      suggested: 'bản tham khảo',
      feedback: 'nhận xét',
      score: 80,
      status: 'GRADED',
    },
    select: { id: true },
  });
  return s.id;
}

beforeAll(async () => {
  F = await import('@/lib/feed');
  ({ prisma } = await import('@/lib/db'));
  await prisma.user.create({ data: { id: USER_A, name: 'Akira', email: 'a@example.test' } });
  await prisma.user.create({ data: { id: USER_B, name: 'Bình', email: 'b@example.test' } });
  await prisma.user.create({ data: { id: USER_C, name: 'Chi', email: 'c@example.test' } });
  sharedId = await makeSentence(USER_A, '共有された文');
  privateId = await makeSentence(USER_A, '非公開の文');
});

describe('shared feed — share boundary', () => {
  it('share is scoped to the owner + only a graded attempt', async () => {
    expect(await F.shareSentence(USER_B, sharedId)).toBe(false); // not B's
    expect(await F.shareSentence(USER_A, sharedId)).toBe(true); // owner shares
  });

  it('the feed shows SHARED attempts (content only), never a private one or a schedule field', async () => {
    const feedForB = await F.listSharedFeed(USER_B);
    expect(feedForB.map((e) => e.sourceText)).toEqual(['共有された文']);
    const e = feedForB[0];
    expect(e.authorName).toBe('Akira');
    expect(e.isMine).toBe(false);
    expect(e.commentCount).toBe(0);
    for (const leak of ['userId', 'srs', 'due', 'stability', 'reps', 'stagedItems']) {
      expect(e).not.toHaveProperty(leak);
    }
    // A sees the same attempt flagged as theirs.
    expect((await F.listSharedFeed(USER_A))[0].isMine).toBe(true);
  });

  it('unshare removes it from the feed', async () => {
    expect(await F.unshareSentence(USER_A, sharedId)).toBe(true);
    expect(await F.listSharedFeed(USER_B)).toHaveLength(0);
    await F.shareSentence(USER_A, sharedId); // restore
  });
});

describe('shared feed — comments + authz', () => {
  it('a member comments on a shared attempt; empty is rejected; a private one is not visible', async () => {
    expect(await F.addComment(USER_B, sharedId, '   ')).toEqual({ ok: false, reason: 'empty' });
    expect(await F.addComment(USER_B, privateId, 'hi')).toEqual({
      ok: false,
      reason: 'not-visible',
    }); // B can't see A's private attempt
    const r = await F.addComment(USER_B, sharedId, 'Câu này hay!');
    expect(r.ok).toBe(true);
    expect((await F.listSharedFeed(USER_B))[0].commentCount).toBe(1);
  });

  it('listComments gates by visibility and flags who can delete', async () => {
    expect(await F.listComments(USER_C, privateId)).toBeNull(); // C can't see A's private attempt
    expect(await F.listComments(USER_A, privateId)).toEqual([]); // owner sees it, no comments

    const forC = await F.listComments(USER_C, sharedId); // C can see the shared attempt
    expect(forC).not.toBeNull();
    expect(forC!).toHaveLength(1);
    expect(forC![0].canDelete).toBe(false); // C is neither author nor owner

    const forB = await F.listComments(USER_B, sharedId);
    expect(forB![0].canDelete).toBe(true); // B authored it
    const forA = await F.listComments(USER_A, sharedId);
    expect(forA![0].canDelete).toBe(true); // A owns the sentence
  });

  it('delete allowed for author or sentence owner, nobody else', async () => {
    const mk = async () =>
      (await F.addComment(USER_B, sharedId, 'tạm')) as { ok: true; id: string };

    // A third party cannot delete.
    const c1 = await mk();
    expect(await F.deleteComment(USER_C, c1.id)).toBe(false);
    // The author can.
    expect(await F.deleteComment(USER_B, c1.id)).toBe(true);
    // The sentence owner can delete someone else's comment.
    const c2 = await mk();
    expect(await F.deleteComment(USER_A, c2.id)).toBe(true);
  });
});

describe('shared feed — likes (Phase 5)', () => {
  it('like only on a shared attempt; count + likedByMe reflect it across viewers', async () => {
    expect(await F.toggleSentenceLike(USER_B, privateId)).toBeNull(); // a private attempt can't be liked
    expect(await F.toggleSentenceLike(USER_B, sharedId)).toEqual({ liked: true, count: 1 });

    const forB = await F.listSharedFeed(USER_B);
    expect(forB[0].likeCount).toBe(1);
    expect(forB[0].likedByMe).toBe(true);
    expect((await F.listSharedFeed(USER_C))[0].likedByMe).toBe(false); // C hasn't liked it

    expect(await F.toggleSentenceLike(USER_C, sharedId)).toEqual({ liked: true, count: 2 }); // 2nd liker
    expect(await F.toggleSentenceLike(USER_B, sharedId)).toEqual({ liked: false, count: 1 }); // B un-likes
    expect(await F.toggleSentenceLike(USER_C, sharedId)).toEqual({ liked: false, count: 0 }); // clean up
  });
});

describe('shared feed — comment votes (Phase 5)', () => {
  it('up/down toggles + flips; score + myVote reflect it, only on a visible comment', async () => {
    const c = (await F.addComment(USER_B, sharedId, 'để vote')) as { ok: true; id: string };
    expect(await F.voteComment(USER_C, c.id, 1)).toEqual({ score: 1, myVote: 1 }); // C upvotes
    expect(await F.voteComment(USER_A, c.id, 1)).toEqual({ score: 2, myVote: 1 }); // A upvotes too
    expect(await F.voteComment(USER_C, c.id, -1)).toEqual({ score: 0, myVote: -1 }); // C flips to down
    expect(await F.voteComment(USER_C, c.id, -1)).toEqual({ score: 1, myVote: 0 }); // C clears (toggle off)

    const forA = await F.listComments(USER_A, sharedId);
    const voted = forA!.find((x) => x.id === c.id)!;
    expect(voted.score).toBe(1);
    expect(voted.myVote).toBe(1); // A's own upvote surfaces to A
  });
});
