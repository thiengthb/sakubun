// Shared-history feed + comments (Phase 4, plan 2026-07-21-multi-user-deploy-sharing). A member can
// SHARE a practiced attempt to a members-only feed, where other logged-in members read it and comment.
//
// Tenancy: `Sentence` is a fail-closed TENANT_MODEL (lib/db.ts), so the CROSS-TENANT reads (feed + a
// shared attempt) are RAW SQL selecting the attempt's own columns — the guard stays intact and a
// private attempt can never leak. share/unshare are guarded Prisma (scoped to the owner's userId).
// `Comment` is deliberately NOT a tenant model (a social object read across authors by sentenceId);
// its access control lives HERE: you may comment only on a SHARED sentence, and delete a comment only
// if you are its author OR the sentence's owner.

import { prisma } from '@/lib/db';
import { notify } from '@/lib/notifications';
import { cleanText } from '@/lib/text';

const MAX_COMMENT_LEN = 2000;

/**
 * Tell the OWNER of something that someone else acted on it — a like, a comment, a vote.
 *
 * Three rules live here rather than at each call site, because each of them is easy to forget once and
 * then wrong forever: you are never notified about your own action; the notification is a PASSENGER, so
 * a failure here can never fail the like/comment that caused it; and the actor's display name is
 * resolved here so no caller has to thread it through.
 */
async function notifyOwner(
  ownerId: string,
  actorId: string,
  build: (actorName: string) => Parameters<typeof notify>[1],
): Promise<void> {
  if (ownerId === actorId) return;
  try {
    const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { name: true } });
    await notify(ownerId, build(actor?.name ?? 'Một thành viên'));
  } catch {
    // Passenger: the social action already succeeded and must stay succeeded.
  }
}

export interface FeedEntry {
  id: string;
  direction: string;
  sourceText: string;
  userAnswer: string;
  suggested: string | null;
  // `漢字[かな]` furigana markup for the JA side, carried so the feed renders the SAME three signals as
  // the owner's own card (furigana + audio + karaoke — invariant #9). Without these the feed's
  // SpokenLines silently degrade to audio only, which is exactly what happened until 2026-07-23.
  sourceRuby: string | null;
  suggestedRuby: string | null;
  feedback: string | null;
  score: number | null;
  authorId: string;
  authorName: string;
  /** Author's account photo (e.g. Google), so the feed avatar matches the sidebar. Null = fallback. */
  authorImage: string | null;
  sharedAt: string;
  commentCount: number;
  isMine: boolean;
  // Public like/upvote (Phase 5): total likes + whether the viewer has liked it.
  likeCount: number;
  likedByMe: boolean;
  // Meta for the compact card (parity with the "Của tôi" card): độ khó = the TARGET pattern's JLPT
  // level, chủ đề = the sentence's context tag. Content only — no schedule.
  level: string | null;
  context: string | null;
}

export interface CommentEntry {
  id: string;
  authorId: string;
  authorName: string;
  /** Author's account photo (e.g. Google) so a comment's avatar matches the sidebar. Null = fallback. */
  authorImage: string | null;
  body: string;
  createdAt: string;
  canDelete: boolean;
  // Up/down votes (Phase 5): net score = sum(±1); myVote = the viewer's own vote (-1 | 0 | 1).
  score: number;
  myVote: number;
}

interface FeedRow {
  id: string;
  direction: string;
  sourceText: string;
  userAnswer: string;
  suggested: string | null;
  sourceRuby: string | null;
  suggestedRuby: string | null;
  feedback: string | null;
  score: number | null;
  authorId: string;
  authorName: string;
  authorImage: string | null;
  sharedAt: string;
  commentCount: number | bigint;
  likeCount: number | bigint;
  likedByMe: number | bigint;
  level: string | null;
  context: string | null;
}

/**
 * The members' feed: every SHARED graded attempt (yours + others'), newest first. Raw SQL cross-tenant
 * — content columns only (source/answer/reference/feedback/score) + author name + comment count. Never
 * exposes a private attempt or anyone's FSRS schedule.
 */
export async function listSharedFeed(
  viewerId: string,
  opts: { limit?: number } = {},
): Promise<FeedEntry[]> {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 300);
  const rows = await prisma.$queryRaw<FeedRow[]>`
    SELECT s.id, s.direction, s.sourceText, s.userAnswer, s.suggested,
           s.sourceRuby, s.suggestedRuby, s.feedback, s.score,
           s.context AS context,
           s.userId AS authorId, u.name AS authorName, u.image AS authorImage, s.sharedAt AS sharedAt,
           (SELECT COUNT(*) FROM "Comment" c WHERE c.sentenceId = s.id) AS commentCount,
           (SELECT COUNT(*) FROM "SentenceLike" sl WHERE sl.sentenceId = s.id) AS likeCount,
           (SELECT COUNT(*) FROM "SentenceLike" sl
              WHERE sl.sentenceId = s.id AND sl.userId = ${viewerId}) AS likedByMe,
           (SELECT it.level FROM "ReviewLog" rl JOIN "Item" it ON it.id = rl.itemId
              WHERE rl.sentenceId = s.id AND rl.role = 'TARGET' LIMIT 1) AS level
    FROM "Sentence" s
    JOIN "user" u ON u.id = s.userId
    WHERE s.visibility = 'shared'
    ORDER BY s.sharedAt DESC
    LIMIT ${limit}`;
  return rows.map((r) => ({
    id: r.id,
    direction: r.direction,
    sourceText: r.sourceText,
    userAnswer: r.userAnswer,
    suggested: r.suggested,
    sourceRuby: r.sourceRuby,
    suggestedRuby: r.suggestedRuby,
    feedback: r.feedback,
    score: r.score,
    authorId: r.authorId,
    authorName: r.authorName,
    authorImage: r.authorImage,
    sharedAt: r.sharedAt,
    commentCount: Number(r.commentCount),
    isMine: r.authorId === viewerId,
    likeCount: Number(r.likeCount),
    likedByMe: Number(r.likedByMe) > 0,
    level: r.level,
    context: r.context,
  }));
}

/** True if `sentenceId` is readable by `viewerId` in the feed: it is shared, OR the viewer owns it. */
async function canView(viewerId: string, sentenceId: string): Promise<{ ownerId: string } | null> {
  const rows = await prisma.$queryRaw<{ userId: string; visibility: string }[]>`
    SELECT s.userId AS userId, s.visibility AS visibility FROM "Sentence" s WHERE s.id = ${sentenceId} LIMIT 1`;
  const row = rows[0];
  if (!row) return null;
  if (row.visibility !== 'shared' && row.userId !== viewerId) return null;
  return { ownerId: row.userId };
}

/** Comments on a sentence the viewer may see (shared, or owned by them). Null if they may not. */
export async function listComments(
  viewerId: string,
  sentenceId: string,
): Promise<CommentEntry[] | null> {
  const view = await canView(viewerId, sentenceId);
  if (!view) return null;
  const comments = await prisma.comment.findMany({
    where: { sentenceId },
    orderBy: { createdAt: 'asc' },
    include: {
      author: { select: { id: true, name: true, image: true } },
      votes: { select: { userId: true, value: true } },
    },
  });
  return comments.map((c) => ({
    id: c.id,
    authorId: c.authorId,
    authorName: c.author.name,
    authorImage: c.author.image,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
    // Deletable by the comment's author OR the sentence's owner.
    canDelete: c.authorId === viewerId || view.ownerId === viewerId,
    score: c.votes.reduce((n, v) => n + v.value, 0),
    myVote: c.votes.find((v) => v.userId === viewerId)?.value ?? 0,
  }));
}

/** Share one of the viewer's OWN graded attempts to the feed. False if not theirs. Guard-safe. */
export async function shareSentence(userId: string, sentenceId: string): Promise<boolean> {
  const res = await prisma.sentence.updateMany({
    where: { id: sentenceId, userId, status: 'GRADED' },
    data: { visibility: 'shared', sharedAt: new Date() },
  });
  return res.count > 0;
}

/** Unshare (back to private). Keeps sharedAt for audit; the feed filters on visibility. Guard-safe. */
export async function unshareSentence(userId: string, sentenceId: string): Promise<boolean> {
  const res = await prisma.sentence.updateMany({
    where: { id: sentenceId, userId },
    data: { visibility: 'private' },
  });
  return res.count > 0;
}

export type AddCommentResult =
  { ok: true; id: string } | { ok: false; reason: 'not-visible' | 'empty' | 'too-long' };

/** Add a comment — ONLY on a SHARED sentence (or the viewer's own). Author = the current user. */
export async function addComment(
  authorId: string,
  sentenceId: string,
  body: string,
): Promise<AddCommentResult> {
  const text = cleanText(body);
  if (!text) return { ok: false, reason: 'empty' };
  if (text.length > MAX_COMMENT_LEN) return { ok: false, reason: 'too-long' };
  if (!(await canView(authorId, sentenceId))) return { ok: false, reason: 'not-visible' };
  const c = await prisma.comment.create({
    data: { sentenceId, authorId, body: text },
    select: { id: true },
  });
  const view = await canView(authorId, sentenceId);
  if (view) {
    await notifyOwner(view.ownerId, authorId, (actorName) => ({
      kind: 'SENTENCE_COMMENTED',
      title: `${actorName} đã bình luận về câu của bạn`,
      pluralTitle: (n) => `${n} bình luận mới về câu của bạn`,
      body: text.length > 120 ? `${text.slice(0, 120)}…` : text,
      href: `/history?open=${sentenceId}`,
      entityId: sentenceId,
      actorName,
    }));
  }
  return { ok: true, id: c.id };
}

/** Delete a comment if the user is its AUTHOR or the SENTENCE OWNER. Returns false otherwise. */
export async function deleteComment(userId: string, commentId: string): Promise<boolean> {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { authorId: true, sentenceId: true },
  });
  if (!comment) return false;
  let allowed = comment.authorId === userId;
  if (!allowed) {
    // Sentence owner? A guarded lookup (userId scoped) — found ⇒ this user owns the sentence.
    const owned = await prisma.sentence.findFirst({
      where: { id: comment.sentenceId, userId },
      select: { id: true },
    });
    allowed = !!owned;
  }
  if (!allowed) return false;
  await prisma.comment.delete({ where: { id: commentId } });
  return true;
}

export interface LikeResult {
  liked: boolean;
  count: number;
}

/**
 * Toggle the viewer's like on a SHARED sentence (Phase 5). Returns the new state + fresh total, or null
 * if the sentence isn't shared (you can't like a private attempt). Not tenant-scoped — a social object.
 */
export async function toggleSentenceLike(
  userId: string,
  sentenceId: string,
): Promise<LikeResult | null> {
  const rows = await prisma.$queryRaw<{ visibility: string }[]>`
    SELECT s.visibility AS visibility FROM "Sentence" s WHERE s.id = ${sentenceId} LIMIT 1`;
  if (rows[0]?.visibility !== 'shared') return null;
  const existing = await prisma.sentenceLike.findUnique({
    where: { sentenceId_userId: { sentenceId, userId } },
    select: { id: true },
  });
  if (existing) await prisma.sentenceLike.delete({ where: { id: existing.id } });
  else await prisma.sentenceLike.create({ data: { sentenceId, userId } });
  const count = await prisma.sentenceLike.count({ where: { sentenceId } });
  // Only a NEW like is an event. Un-liking is not news, and notifying on both would let one person
  // ring the bell repeatedly by toggling.
  if (!existing) {
    const owner = await canView(userId, sentenceId);
    if (owner) {
      await notifyOwner(owner.ownerId, userId, (actorName) => ({
        kind: 'SENTENCE_LIKED',
        title: `${actorName} đã thích câu của bạn`,
        pluralTitle: (n) => `${actorName} và ${n - 1} người khác đã thích câu của bạn`,
        href: `/history?open=${sentenceId}`,
        entityId: sentenceId,
        actorName,
      }));
    }
  }
  return { liked: !existing, count };
}

export interface VoteResult {
  score: number;
  myVote: number;
}

/**
 * Cast (or toggle off) an up/down vote on a comment (Phase 5). `value` = 1 (up) | -1 (down); voting the
 * same direction again clears it, the opposite flips it. Only on a comment whose sentence the viewer may
 * see. Returns the fresh net score + the viewer's vote, or null if not allowed.
 */
export async function voteComment(
  userId: string,
  commentId: string,
  value: 1 | -1,
): Promise<VoteResult | null> {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { sentenceId: true, authorId: true },
  });
  if (!comment) return null;
  if (!(await canView(userId, comment.sentenceId))) return null;

  const existing = await prisma.commentVote.findUnique({
    where: { commentId_userId: { commentId, userId } },
    select: { id: true, value: true },
  });
  if (existing?.value === value) {
    await prisma.commentVote.delete({ where: { id: existing.id } }); // same direction → toggle off
  } else if (existing) {
    await prisma.commentVote.update({ where: { id: existing.id }, data: { value } }); // flip
  } else {
    await prisma.commentVote.create({ data: { commentId, userId, value } });
  }
  // A vote that was just CLEARED (same direction twice) is not an event; only a set vote is. Downvotes
  // notify too — being told only about approval would make the signal flattering rather than useful.
  if (existing?.value !== value) {
    const up = value === 1;
    await notifyOwner(comment.authorId, userId, (actorName) => ({
      kind: 'COMMENT_VOTED',
      title: `${actorName} đã ${up ? 'tán thành' : 'phản đối'} bình luận của bạn`,
      pluralTitle: (n) => `${n} lượt bình chọn mới cho bình luận của bạn`,
      href: `/history?open=${comment.sentenceId}`,
      entityId: commentId,
      actorName,
    }));
  }
  const votes = await prisma.commentVote.findMany({
    where: { commentId },
    select: { userId: true, value: true },
  });
  return {
    score: votes.reduce((n, v) => n + v.value, 0),
    myVote: votes.find((v) => v.userId === userId)?.value ?? 0,
  };
}
