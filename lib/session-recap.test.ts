// DB harness for the derived session recap (plan step 5.5 — shipped WITHOUT the storage §9 specified;
// the reasoning is in lib/session-recap.ts's header).
//
// The properties that matter: it reconstructs the last STUDY day (not a raw 24h window, or a learner
// whose day starts at 04:00 gets a different session boundary from their own streak), it names what
// went wrong in that session rather than all-time leeches, and it says nothing at all for a learner
// with no history.

import { execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const projectRoot = path.resolve(import.meta.dirname, '..');
const dbFile = path.join(mkdtempSync(path.join(os.tmpdir(), 'sakubun-recap-')), 'test.db');
const url = `file:${dbFile.replace(/\\/g, '/')}`;
process.env.DATABASE_URL = url;
execSync('npx prisma db push --accept-data-loss', {
  cwd: projectRoot,
  env: { ...process.env, DATABASE_URL: url },
  stdio: 'ignore',
});

type Recap = typeof import('@/lib/session-recap');
type Db = typeof import('@/lib/db');

let R: Recap;
let prisma: Db['prisma'];

/** Local noon, so a 4am cutoff never lands the fixture on the previous study day by accident. */
const NOW = new Date(2026, 6, 27, 12, 0, 0);
const HOUR = 3600000;
const DAY = 24 * HOUR;
const CUTOFF = 4;

let seq = 0;
async function freshUser(): Promise<string> {
  const id = `r${seq++}`;
  await prisma.user.create({ data: { id, name: id, email: `${id}@example.test` } });
  return id;
}

async function addItem(userId: string, expression: string): Promise<string> {
  const row = await prisma.item.create({
    data: { userId, kind: 'GRAMMAR', expression, meaningVi: 'nghĩa', level: 'N3' },
  });
  return row.id;
}

/** A real Sentence row — reviewLog.sentenceId is a foreign key, so a made-up id is rejected. */
async function aSentence(userId: string, at: Date): Promise<string> {
  const row = await prisma.sentence.create({
    data: {
      userId,
      direction: 'VI_JA',
      sourceText: 'nguồn',
      userAnswer: 'đáp',
      status: 'GRADED',
      createdAt: at,
    },
  });
  return row.id;
}

async function review(
  userId: string,
  o: { itemId?: string | null; rating: number; at: Date; sentenceId?: string },
): Promise<void> {
  await prisma.reviewLog.create({
    data: {
      userId,
      itemId: o.itemId ?? null,
      rating: o.rating,
      state: 2,
      due: NOW,
      stability: 1,
      difficulty: 5,
      reviewedAt: o.at,
      sentenceId: o.sentenceId ?? null,
    },
  });
}

beforeAll(async () => {
  R = await import('@/lib/session-recap');
  ({ prisma } = await import('@/lib/db'));
});

describe('no history, no claim about where they left off', () => {
  it('returns null for a learner who has never reviewed anything', async () => {
    const user = await freshUser();
    expect(await R.getSessionRecap(user, CUTOFF, NOW)).toBeNull();
  });
});

describe('it reconstructs the last STUDY day', () => {
  it('counts only the most recent session, not the one before it', async () => {
    const user = await freshUser();
    const a = await addItem(user, '〜ざるを得ない');
    const b = await addItem(user, '〜つつある');
    // Yesterday's session: 2 reviews on ONE sentence, one miss.
    const yesterday = new Date(NOW.getTime() - DAY);
    const s1 = await aSentence(user, yesterday);
    await review(user, { itemId: a, rating: 1, at: yesterday, sentenceId: s1 });
    await review(user, { itemId: b, rating: 3, at: yesterday, sentenceId: s1 });
    // The session BEFORE that must not leak in.
    const older = new Date(NOW.getTime() - 3 * DAY);
    await review(user, {
      itemId: b,
      rating: 1,
      at: older,
      sentenceId: await aSentence(user, older),
    });

    const recap = await R.getSessionRecap(user, CUTOFF, NOW);
    expect(recap).not.toBeNull();
    expect(recap!.daysAgo).toBe(1);
    expect(recap!.reviews).toBe(2);
    expect(recap!.sentences).toBe(1);
    expect(recap!.shaky.map((s) => s.expression)).toEqual(['〜ざるを得ない']);
  });

  it('uses the learner day-cutoff, not midnight — a 01:00 review belongs to the PREVIOUS study day', async () => {
    const user = await freshUser();
    const a = await addItem(user, '〜ばかりに');
    // 01:00 today and 23:00 yesterday are ONE study day when the cutoff is 04:00. Splitting them at
    // midnight would report two sessions and disagree with the streak, which uses the same key.
    const lateNight = new Date(2026, 6, 27, 1, 0, 0);
    const evening = new Date(2026, 6, 26, 23, 0, 0);
    await review(user, {
      itemId: a,
      rating: 2,
      at: lateNight,
      sentenceId: await aSentence(user, lateNight),
    });
    await review(user, {
      itemId: a,
      rating: 1,
      at: evening,
      sentenceId: await aSentence(user, evening),
    });

    const recap = await R.getSessionRecap(user, CUTOFF, NOW);
    expect(recap!.reviews).toBe(2);
    expect(recap!.sentences).toBe(2);
    expect(recap!.shaky[0].misses).toBe(2);
    // NOW is 27 July noon → study day 27 July; the session's key is 26 July → one day ago.
    expect(recap!.daysAgo).toBe(1);
  });

  it('reports 0 days ago while the learner is still in today session', async () => {
    const user = await freshUser();
    const a = await addItem(user, '〜わけにはいかない');
    await review(user, { itemId: a, rating: 3, at: new Date(NOW.getTime() - 2 * HOUR) });
    expect((await R.getSessionRecap(user, CUTOFF, NOW))!.daysAgo).toBe(0);
  });
});

describe('it names what went wrong THEN, not the all-time weak list', () => {
  it('says nothing was missed when the session was clean', async () => {
    const user = await freshUser();
    const a = await addItem(user, '〜に限る');
    await review(user, { itemId: a, rating: 4, at: new Date(NOW.getTime() - DAY) });
    const recap = await R.getSessionRecap(user, CUTOFF, NOW);
    expect(recap!.shaky).toEqual([]);
    expect(recap!.reviews).toBe(1);
  });

  it('caps the named patterns and orders them worst-first', async () => {
    const user = await freshUser();
    const at = new Date(NOW.getTime() - DAY);
    for (let n = 0; n < R.MAX_SHAKY + 2; n++) {
      const id = await addItem(user, `pattern-${n}`);
      // pattern-0 missed most, pattern-N least — so the cap must keep the worst ones.
      for (let m = 0; m <= R.MAX_SHAKY + 2 - n; m++)
        await review(user, { itemId: id, rating: 1, at });
    }
    const recap = await R.getSessionRecap(user, CUTOFF, NOW);
    expect(recap!.shaky).toHaveLength(R.MAX_SHAKY);
    expect(recap!.shaky[0].expression).toBe('pattern-0');
    expect(recap!.shaky.map((s) => s.misses)).toEqual(
      [...recap!.shaky.map((s) => s.misses)].sort((x, y) => y - x),
    );
  });

  it('counts a miss on a DELETED item in the totals but cannot name it', async () => {
    const user = await freshUser();
    const at = new Date(NOW.getTime() - DAY);
    // Invariant #2: deleting an item SET-NULLs its logs, it never deletes them.
    await review(user, { itemId: null, rating: 1, at });
    const recap = await R.getSessionRecap(user, CUTOFF, NOW);
    expect(recap!.reviews).toBe(1);
    expect(recap!.shaky).toEqual([]);
  });
});

describe('the rendered line is a STATEMENT, never a second thing to say yes to', () => {
  it('names the patterns without offering an action', async () => {
    const Render = await import('@/lib/mcp/render');
    const user = await freshUser();
    const a = await addItem(user, '〜ざるを得ない');
    const yesterday = new Date(NOW.getTime() - DAY);
    await review(user, {
      itemId: a,
      rating: 1,
      at: yesterday,
      sentenceId: await aSentence(user, yesterday),
    });
    const recap = await R.getSessionRecap(user, CUTOFF, NOW);

    const stats = {
      totalItems: 1,
      newItems: 0,
      dueNow: 0,
      today: { reviews: 0, newGrammar: 0, sentences: 0 },
      streak: { current: 1, longest: 1 },
      reviewsLast7Days: 1,
      dueForecast7Days: {},
      reviewsByDay: [],
      mastery: { new: 0, learning: 0, review: 1, relearning: 0, suspended: 0 },
      weakItems: [],
      settings: {},
    } as unknown as Parameters<typeof Render.renderStats>[0];

    const block = Render.renderStats(stats, undefined, recap);
    expect(block).toContain('Buổi trước');
    expect(block).toContain('〜ざるを得ない');
    // §6, one control surface per message: MODE_DISPATCH prints a NUMBERED focus menu straight after
    // this block, so a numbered item here would make "1" ambiguous.
    expect(block).not.toMatch(/^\d+\. /m);
    // And the whole recap is ONE line — the digest that plan §9 capped at three.
    expect(block.split('\n').filter((l) => l.includes('Buổi trước'))).toHaveLength(1);
  });

  it('is absent entirely when there is no previous session', async () => {
    const Render = await import('@/lib/mcp/render');
    const stats = {
      totalItems: 0,
      newItems: 0,
      dueNow: 0,
      today: { reviews: 0, newGrammar: 0, sentences: 0 },
      streak: { current: 0, longest: 0 },
      reviewsLast7Days: 0,
      dueForecast7Days: {},
      reviewsByDay: [],
      mastery: { new: 0, learning: 0, review: 0, relearning: 0, suspended: 0 },
      weakItems: [],
      settings: {},
    } as unknown as Parameters<typeof Render.renderStats>[0];
    expect(Render.renderStats(stats, undefined, null)).not.toContain('Buổi trước');
  });
});
