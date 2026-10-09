import { lengthBucket } from '@/lib/format';
import { JLPT_LEVELS } from '@/lib/settings-schema';

export const MAX_ANSWER_SEC = 3600;

export interface PerfBreakdown {
  label: string;
  count: number;
  avgScore: number | null;
  avgSec: number;
}

export const answerDurationSec = (s: { createdAt: Date; answeredAt: Date | null }): number =>
  s.answeredAt ? (s.answeredAt.getTime() - s.createdAt.getTime()) / 1000 : -1;

export const validAnswerSec = (s: { createdAt: Date; answeredAt: Date | null }): number | null => {
  const sec = answerDurationSec(s);
  return sec >= 0 && sec <= MAX_ANSWER_SEC ? sec : null;
};

export interface BreakdownSentence {
  createdAt: Date;
  answeredAt: Date | null;
  score: number | null;
  sourceText: string;
  reviews: { role: string; item: { level: string } | null }[];
}

interface Agg {
  label: string;
  order: number;
  scores: number[];
  secs: number[];
  count: number;
}

const summarize = (a: Agg): PerfBreakdown => ({
  label: a.label,
  count: a.count,
  avgScore: a.scores.length
    ? Math.round(a.scores.reduce((x, y) => x + y, 0) / a.scores.length)
    : null,
  avgSec: a.secs.length ? Math.round(a.secs.reduce((x, y) => x + y, 0) / a.secs.length) : 0,
});

export function breakdownByLevelAndLength(sentences: readonly BreakdownSentence[]): {
  scoreByLevel: PerfBreakdown[];
  scoreByLength: PerfBreakdown[];
} {
  const byLevel = new Map<string, Agg>();
  const byLength = new Map<string, Agg>();

  for (const s of sentences) {
    const validSec = validAnswerSec(s);
    const target =
      s.reviews.find((r) => r.role === 'TARGET' && r.item) ?? s.reviews.find((r) => r.item);
    const level = target?.item?.level ?? null;
    if (level) {
      const g = byLevel.get(level) ?? {
        label: level,
        order: JLPT_LEVELS.indexOf(level as (typeof JLPT_LEVELS)[number]),
        scores: [],
        secs: [],
        count: 0,
      };
      g.count += 1;
      if (typeof s.score === 'number') g.scores.push(s.score);
      if (validSec !== null) g.secs.push(validSec);
      byLevel.set(level, g);
    }
    const bucket = lengthBucket(s.sourceText.length);
    const gl = byLength.get(bucket.key) ?? {
      label: bucket.label,
      order: bucket.order,
      scores: [],
      secs: [],
      count: 0,
    };
    gl.count += 1;
    if (typeof s.score === 'number') gl.scores.push(s.score);
    if (validSec !== null) gl.secs.push(validSec);
    byLength.set(bucket.key, gl);
  }

  return {
    scoreByLevel: [...byLevel.values()].sort((a, b) => a.order - b.order).map(summarize),
    scoreByLength: [...byLength.values()].sort((a, b) => a.order - b.order).map(summarize),
  };
}
