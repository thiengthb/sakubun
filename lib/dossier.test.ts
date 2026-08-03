// DB harness for the STUDENT MODEL (plan 2026-07-26-agentic-tutor-loop step 5.1).
//
// The property under test is not "the numbers are right" — it is that the module REFUSES to speak
// under its support floors. A tutor confidently wrong about a person is worse than one with no model
// (plan risk 6), so every aggregate here is checked twice: once just below its threshold (silent) and
// once at it (emitted). The empty-history case is the headline assertion.
//
// Same throwaway-DB harness as practice.test.ts: DATABASE_URL is set BEFORE lib/db is imported.

import { execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const projectRoot = path.resolve(import.meta.dirname, '..');
const dbFile = path.join(mkdtempSync(path.join(os.tmpdir(), 'sakubun-dossier-')), 'test.db');
const url = `file:${dbFile.replace(/\\/g, '/')}`;
process.env.DATABASE_URL = url;
execSync('npx prisma db push --accept-data-loss', {
  cwd: projectRoot,
  env: { ...process.env, DATABASE_URL: url },
  stdio: 'ignore',
});

type DossierMod = typeof import('@/lib/dossier');
type Db = typeof import('@/lib/db');
type Render = typeof import('@/lib/mcp/render');

let D: DossierMod;
let R: Render;
let prisma: Db['prisma'];

const NOW = new Date('2026-07-27T10:00:00Z');
const DAY = 86_400_000;
const ago = (days: number): Date => new Date(NOW.getTime() - days * DAY);

/**
 * Per-case isolation. Each test used to take a `freshUser()` and lean on the tenancy filter to keep its
 * rows apart; with one learner and no tenant column, isolation has to come from an empty DB instead.
 * Children before parents (SQLite FK).
 */
async function resetData(): Promise<void> {
  await prisma.reviewLog.deleteMany({});
  await prisma.sentence.deleteMany({});
  await prisma.srsState.deleteMany({});
  await prisma.item.deleteMany({});
  await prisma.calibrationProposal.deleteMany({});
  await prisma.learnerNote.deleteMany({});
  await prisma.learnerAbility.deleteMany({});
  await prisma.settings.deleteMany({});
}

async function addItem(expression: string): Promise<string> {
  const item = await prisma.item.create({
    data: { kind: 'GRAMMAR', expression, meaningVi: 'nghĩa', level: 'N3' },
  });
  return item.id;
}

interface ReviewSeed {
  itemId?: string | null;
  rating: number;
  state?: number;
  daysAgo: number;
  errorTags?: string[];
  errorDetail?: { tag?: string; used: string; required: string }[];
  sentenceId?: string;
}

async function review(seed: ReviewSeed): Promise<void> {
  await prisma.reviewLog.create({
    data: {
      itemId: seed.itemId ?? null,
      rating: seed.rating,
      state: seed.state ?? 2,
      due: NOW,
      stability: 1,
      difficulty: 5,
      reviewedAt: ago(seed.daysAgo),
      errorTags: seed.errorTags ? JSON.stringify(seed.errorTags) : null,
      errorDetail: seed.errorDetail ? JSON.stringify(seed.errorDetail) : null,
      sentenceId: seed.sentenceId ?? null,
    },
  });
}

async function sentence(
  over: { exerciseType?: string; context?: string; score?: number; daysAgo?: number } = {},
): Promise<string> {
  const row = await prisma.sentence.create({
    data: {
      direction: 'VI_JA',
      exerciseType: over.exerciseType ?? 'TRANSLATION',
      sourceText: 'nguồn',
      userAnswer: 'đáp',
      status: 'GRADED',
      context: over.context ?? null,
      score: over.score ?? null,
      createdAt: ago(over.daysAgo ?? 1),
    },
  });
  return row.id;
}

beforeAll(async () => {
  D = await import('@/lib/dossier');
  R = await import('@/lib/mcp/render');
  ({ prisma } = await import('@/lib/db'));
});

describe('an empty history yields an EMPTY dossier', () => {
  it('invents nothing for a learner with no reviews', async () => {
    await resetData();
    const dossier = await D.computeDossier(NOW);
    expect(D.isEmptyDossier(dossier)).toBe(true);
    expect(dossier.confusions).toEqual([]);
    expect(dossier.strong).toEqual([]);
    expect(dossier.exposures).toBeNull();
    expect(dossier.register).toBeNull();
    expect(dossier.topics).toEqual([]);
    expect(dossier.tagTrend).toEqual([]);
  });

  it('renders NOTHING rather than an empty header', async () => {
    await resetData();
    expect(R.renderDossier(await D.computeDossier(NOW))).toBeNull();
    expect(R.renderDossier(null)).toBeNull();
  });
});

describe('strong patterns — never missed, mostly Easy', () => {
  it('stays silent one review below the floor', async () => {
    await resetData();
    const itemId = await addItem('〜ばかりに');
    for (let i = 0; i < D.MIN_STRONG_REVIEWS - 1; i++) {
      await review({ itemId, rating: 4, daysAgo: i + 1 });
    }
    expect((await D.computeDossier(NOW)).strong).toEqual([]);
  });

  it('emits at the floor, with the Easy count', async () => {
    await resetData();
    const itemId = await addItem('〜ばかりに');
    for (let i = 0; i < D.MIN_STRONG_REVIEWS; i++) {
      await review({ itemId, rating: 4, daysAgo: i + 1 });
    }
    const [strong] = (await D.computeDossier(NOW)).strong;
    expect(strong.expression).toBe('〜ばかりに');
    expect(strong.reviews).toBe(D.MIN_STRONG_REVIEWS);
    expect(strong.easy).toBe(D.MIN_STRONG_REVIEWS);
  });

  it('disqualifies a pattern with ANY miss, however many Easy ratings it has', async () => {
    await resetData();
    const itemId = await addItem('〜どころか');
    for (let i = 0; i < D.MIN_STRONG_REVIEWS + 3; i++) {
      await review({ itemId, rating: 4, daysAgo: i + 2 });
    }
    await review({ itemId, rating: 1, daysAgo: 1 });
    expect((await D.computeDossier(NOW)).strong).toEqual([]);
  });

  it('does not count "Good every time" as a strength', async () => {
    await resetData();
    const itemId = await addItem('〜わけにはいかない');
    for (let i = 0; i < D.MIN_STRONG_REVIEWS + 2; i++) {
      await review({ itemId, rating: 3, daysAgo: i + 1 });
    }
    expect((await D.computeDossier(NOW)).strong).toEqual([]);
  });
});

describe('exposures to graduation — measured, not assumed', () => {
  /** One item: `before` learning reviews (state 0 then 1), then it appears in review state. */
  async function graduate(expression: string, before: number, base: number) {
    const itemId = await addItem(expression);
    for (let i = 0; i < before; i++) {
      await review({ itemId, rating: 3, state: i === 0 ? 0 : 1, daysAgo: base - i });
    }
    await review({ itemId, rating: 3, state: 2, daysAgo: base - before });
    return itemId;
  }

  it('needs a minimum number of graduated patterns before claiming a median', async () => {
    await resetData();
    for (let n = 0; n < D.MIN_GRADUATED_ITEMS - 1; n++) {
      await graduate(`pattern-${n}`, 3, 40);
    }
    expect((await D.computeDossier(NOW)).exposures).toBeNull();
  });

  it('reports the median once enough patterns graduated', async () => {
    await resetData();
    for (let n = 0; n < D.MIN_GRADUATED_ITEMS; n++) {
      await graduate(`pattern-${n}`, 3, 40);
    }
    const { exposures } = await D.computeDossier(NOW);
    expect(exposures).toEqual({ median: 3, sample: D.MIN_GRADUATED_ITEMS });
  });

  it('IGNORES a pattern whose first review predates the window (a truncated window is not a fast learner)', async () => {
    await resetData();
    for (let n = 0; n < D.MIN_GRADUATED_ITEMS; n++) {
      await graduate(`pattern-${n}`, 3, 40);
    }
    // An old-timer: every in-window row is already in review state, so it would otherwise read as
    // "graduated in 0 exposures" and drag the median down.
    const veteran = await addItem('〜にすぎない');
    for (let i = 0; i < 6; i++) await review({ itemId: veteran, rating: 3, daysAgo: 10 + i });
    const { exposures } = await D.computeDossier(NOW);
    expect(exposures).toEqual({ median: 3, sample: D.MIN_GRADUATED_ITEMS });
  });
});

describe('register rate — per conversation TURN, not per review', () => {
  it('stays silent under the turn floor', async () => {
    await resetData();
    const itemId = await addItem('〜ていただけませんか');
    for (let i = 0; i < D.MIN_CONVERSATION_TURNS - 1; i++) {
      const sid = await sentence({ exerciseType: 'CONVERSATION', daysAgo: i + 1 });
      await review({
        itemId,
        rating: 2,
        daysAgo: i + 1,
        errorTags: ['register'],
        sentenceId: sid,
      });
    }
    expect((await D.computeDossier(NOW)).register).toBeNull();
  });

  it('counts a turn once even when it graded several items', async () => {
    await resetData();
    const a = await addItem('〜ていただけませんか');
    const b = await addItem('〜させていただく');
    for (let i = 0; i < D.MIN_CONVERSATION_TURNS; i++) {
      const sid = await sentence({ exerciseType: 'CONVERSATION', daysAgo: i + 1 });
      // Half the turns slip on register; BOTH items are graded on every turn.
      const tags = i % 2 === 0 ? ['register'] : undefined;
      await review({
        itemId: a,
        rating: 2,
        daysAgo: i + 1,
        errorTags: tags,
        sentenceId: sid,
      });
      await review({
        itemId: b,
        rating: 2,
        daysAgo: i + 1,
        errorTags: tags,
        sentenceId: sid,
      });
    }
    const { register } = await D.computeDossier(NOW);
    expect(register).toEqual({ rate: 0.5, turns: D.MIN_CONVERSATION_TURNS });
  });

  it('ignores TRANSLATION turns entirely', async () => {
    await resetData();
    const itemId = await addItem('〜ばかりに');
    for (let i = 0; i < D.MIN_CONVERSATION_TURNS + 5; i++) {
      const sid = await sentence({ daysAgo: i + 1 });
      await review({
        itemId,
        rating: 2,
        daysAgo: i + 1,
        errorTags: ['register'],
        sentenceId: sid,
      });
    }
    expect((await D.computeDossier(NOW)).register).toBeNull();
  });
});

describe('best topics — relative to the learner, never absolute', () => {
  it('says nothing when every topic scores the same', async () => {
    await resetData();
    for (const context of ['công việc', 'du lịch', 'gia đình']) {
      for (let i = 0; i < D.MIN_TOPIC_SENTENCES; i++) {
        await sentence({ context, score: 80, daysAgo: i + 1 });
      }
    }
    expect((await D.computeDossier(NOW)).topics).toEqual([]);
  });

  it('names a topic that beats the learner own average by the margin', async () => {
    await resetData();
    for (let i = 0; i < D.MIN_TOPIC_SENTENCES; i++) {
      await sentence({ context: 'công việc', score: 95, daysAgo: i + 1 });
      await sentence({ context: 'du lịch', score: 60, daysAgo: i + 1 });
    }
    const { topics } = await D.computeDossier(NOW);
    expect(topics.map((t) => t.context)).toEqual(['công việc']);
    expect(topics[0].sentences).toBe(D.MIN_TOPIC_SENTENCES);
  });

  it('refuses to name a "best" topic when there is only ONE topic to compare', async () => {
    await resetData();
    for (let i = 0; i < D.MIN_TOPIC_SENTENCES + 2; i++) {
      await sentence({ context: 'công việc', score: 95, daysAgo: i + 1 });
    }
    // A single qualifying topic is trivially the best one — that is a tautology, not a measurement.
    expect((await D.computeDossier(NOW)).topics).toEqual([]);
  });

  it('ignores a high-scoring topic with too few sentences', async () => {
    await resetData();
    await sentence({ context: 'may mắn', score: 100, daysAgo: 1 });
    for (let i = 0; i < D.MIN_TOPIC_SENTENCES; i++) {
      await sentence({ context: 'du lịch', score: 60, daysAgo: i + 1 });
    }
    expect((await D.computeDossier(NOW)).topics).toEqual([]);
  });
});

describe('error-tag trend — a SHARE of misses, so practising less is not "improving"', () => {
  /** `n` misses tagged `tag`, plus `filler` misses tagged something else, in the given window. */
  async function misses(itemId: string, daysAgo: number, tag: string, n: number) {
    for (let i = 0; i < n; i++)
      await review({ itemId, rating: 1, daysAgo, errorTags: [tag] });
  }

  it('claims nothing when either window is too thin', async () => {
    await resetData();
    const itemId = await addItem('〜ばかりに');
    await misses(itemId, 5, 'particle', D.MIN_TREND_MISSES);
    await misses(itemId, 40, 'particle', D.MIN_TREND_MISSES - 1);
    expect((await D.computeDossier(NOW)).tagTrend).toEqual([]);
  });

  it('reports improving when the tag SHARE of misses fell', async () => {
    await resetData();
    const itemId = await addItem('〜ばかりに');
    // Prior window: 8 misses, all particle. Recent: 8 misses, 1 particle.
    await misses(itemId, 40, 'particle', 8);
    await misses(itemId, 5, 'particle', 1);
    await misses(itemId, 5, 'word-choice', 7);
    const trend = (await D.computeDossier(NOW)).tagTrend;
    expect(trend.find((t) => t.tag === 'particle')?.direction).toBe('improving');
  });

  it('does NOT report improvement when the learner simply practised less', async () => {
    await resetData();
    const itemId = await addItem('〜ばかりに');
    // Same SHARE (100% particle) in both windows, a third of the volume — that is less practice.
    await misses(itemId, 40, 'particle', 18);
    await misses(itemId, 5, 'particle', 6);
    const trend = (await D.computeDossier(NOW)).tagTrend;
    expect(trend.find((t) => t.tag === 'particle')?.direction).toBe('stuck');
  });
});

describe('confusion pairs come from the SAME aggregate the coach proposes from', () => {
  it('surfaces a recurring pair once it clears the mining threshold', async () => {
    await resetData();
    const itemId = await addItem('〜ざるを得ない');
    for (let i = 0; i < 3; i++) {
      const sid = await sentence({ daysAgo: i + 1 });
      await review({
        itemId,
        rating: 1,
        daysAgo: i + 1,
        errorTags: ['word-choice'],
        errorDetail: [{ tag: 'word-choice', used: '〜しかない', required: '〜ざるを得ない' }],
        sentenceId: sid,
      });
    }
    const { confusions } = await D.computeDossier(NOW);
    expect(confusions).toHaveLength(1);
    expect(confusions[0].used).toBe('〜しかない');
    expect(confusions[0].required).toBe('〜ざるを得ない');
    expect(confusions[0].evidence.length).toBeGreaterThan(0);
  });
});

describe('the digest rides EVERY sentence, so its size is a gate not a hope', () => {
  it('never exceeds the line budget even with every aggregate populated', async () => {
    await resetData();
    const target = await addItem('〜ざるを得ない');

    // Confusions (2 distinct pairs, so the cap has something to cut).
    for (const [used, required] of [
      ['〜しかない', '〜ざるを得ない'],
      ['ほかに', '〜どころか'],
      ['〜ため', '〜せいで'],
    ]) {
      for (let i = 0; i < 3; i++) {
        const sid = await sentence({ daysAgo: i + 1 });
        await review({
          itemId: target,
          rating: 1,
          daysAgo: i + 1,
          errorTags: ['word-choice'],
          errorDetail: [{ used, required }],
          sentenceId: sid,
        });
      }
    }
    // Strong patterns.
    for (let n = 0; n < D.MAX_STRONG + 2; n++) {
      const id = await addItem(`strong-${n}`);
      for (let i = 0; i < D.MIN_STRONG_REVIEWS; i++) {
        await review({ itemId: id, rating: 4, daysAgo: i + 1 });
      }
    }
    // Graduations.
    for (let n = 0; n < D.MIN_GRADUATED_ITEMS; n++) {
      const id = await addItem(`grad-${n}`);
      for (let i = 0; i < 3; i++) {
        await review({ itemId: id, rating: 3, state: i === 0 ? 0 : 1, daysAgo: 40 - i });
      }
      await review({ itemId: id, rating: 3, state: 2, daysAgo: 36 });
    }
    // Conversation register + topics.
    for (let i = 0; i < D.MIN_CONVERSATION_TURNS; i++) {
      const sid = await sentence({
        exerciseType: 'CONVERSATION',
        context: 'công việc',
        score: 95,
        daysAgo: i + 1,
      });
      await review({
        itemId: target,
        rating: 2,
        daysAgo: i + 1,
        errorTags: ['register'],
        sentenceId: sid,
      });
    }
    for (let i = 0; i < D.MIN_TOPIC_SENTENCES; i++) {
      await sentence({ context: 'du lịch', score: 50, daysAgo: i + 1 });
    }
    // Trend.
    const trendItem = await addItem('trend');
    for (let i = 0; i < 8; i++)
      await review({ itemId: trendItem, rating: 1, daysAgo: 40, errorTags: ['particle'] });
    for (let i = 0; i < 7; i++)
      await review({ itemId: trendItem, rating: 1, daysAgo: 5, errorTags: ['conjugation'] });

    const dossier = await D.computeDossier(NOW);
    expect(D.isEmptyDossier(dossier)).toBe(false);
    expect(dossier.confusions.length).toBeLessThanOrEqual(D.MAX_CONFUSIONS_SHOWN);
    expect(dossier.strong.length).toBeLessThanOrEqual(D.MAX_STRONG);

    const block = R.renderDossier(dossier);
    expect(block).not.toBeNull();
    const rendered = block!.split('\n');
    // Populated on every axis, so this is the WORST case — not a lucky small one.
    expect(rendered.length).toBe(R.MAX_DOSSIER_LINES);
    // Claude-facing English, and it must say out loud that it is not for the learner.
    expect(block).toContain('LEARNER MODEL');
    expect(block).toMatch(/never/i);
  });
});

describe('the digest is a SESSION-OPEN block, never a per-sentence one', () => {
  /** A learner with exactly one mined confusion on a known item. */
  async function withConfusion(): Promise<{ itemId: string }> {
    await resetData();
    const itemId = await addItem('〜ざるを得ない');
    for (let i = 0; i < 3; i++) {
      const sid = await sentence({ daysAgo: i + 1 });
      await review({
        itemId,
        rating: 1,
        daysAgo: i + 1,
        errorTags: ['word-choice'],
        errorDetail: [{ used: '〜しかない', required: '〜ざるを得ない' }],
        sentenceId: sid,
      });
    }
    return { itemId };
  }

  // Eval Scenario G (2026-07-28) measured the digest ON the composition sheet and found it changed no
  // composed sentence across two confusion pairs, so it was cut from `get_due_items` and is now
  // rendered once per session on `get_stats`. These pin that placement: the wording must not ask for a
  // sentence to be composed around anything, because the caller no longer has a batch to compose from.
  it('aims a confusion at the SESSION, never at one exercise', async () => {
    await withConfusion();
    const block = R.renderDossier(await D.computeDossier(NOW));
    expect(block).toContain('worth aiming a session at');
    expect(block).not.toContain('batch');
    expect(block).not.toContain('compose');
  });
});
