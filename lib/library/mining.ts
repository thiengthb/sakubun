import type { Confusion, ErrorTag } from '@/lib/session/error-tags';
import { normalizeExpression, sameExpression } from '@/lib/core/normalize';

export interface ConfusionRow {
  itemId: string | null;
  expression: string | null;
  sentenceId: string | null;
  reviewedAt: Date;
  confusions: Confusion[];
}

export interface MinedPair {
  used: string;
  required: string;
  tag?: ErrorTag;
  count: number;
  weight: number;
  evidence: string[];
  itemIds: string[];
}

export const MIN_OCCURRENCES = 3;

const MIN_WEIGHT = 1.5;

export const HALF_LIFE_DAYS = 21;

export const MAX_EVIDENCE = 3;

const DAY_MS = 86_400_000;

function recencyWeight(reviewedAt: Date, now: Date): number {
  const ageDays = Math.max(0, (now.getTime() - reviewedAt.getTime()) / DAY_MS);
  return 0.5 ** (ageDays / HALF_LIFE_DAYS);
}

interface Bucket {
  used: string;
  required: string;
  tag?: ErrorTag;
  count: number;
  weight: number;
  newest: number;
  evidence: string[];
  itemIds: Set<string>;
}

export function minePairs(rows: readonly ConfusionRow[], now: Date): MinedPair[] {
  const buckets = new Map<string, Bucket>();

  for (const row of rows) {
    const w = recencyWeight(row.reviewedAt, now);
    const at = row.reviewedAt.getTime();
    for (const c of row.confusions) {
      const usedKey = normalizeExpression(c.used);
      const requiredKey = normalizeExpression(c.required);
      if (!usedKey || !requiredKey || usedKey === requiredKey) continue;

      const key = `${usedKey}→${requiredKey}`;
      const bucket = buckets.get(key) ?? {
        used: c.used,
        required: c.required,
        tag: c.tag,
        count: 0,
        weight: 0,
        newest: -Infinity,
        evidence: [],
        itemIds: new Set<string>(),
      };
      bucket.count += 1;
      bucket.weight += w;
      if (at > bucket.newest) {
        bucket.newest = at;
        bucket.used = c.used;
        bucket.required = c.required;
        bucket.tag = c.tag;
      }
      if (row.sentenceId && !bucket.evidence.includes(row.sentenceId)) {
        bucket.evidence.push(row.sentenceId);
      }
      if (row.itemId && row.expression && sameExpression(row.expression, c.required)) {
        bucket.itemIds.add(row.itemId);
      }
      buckets.set(key, bucket);
    }
  }

  return [...buckets.values()]
    .filter((b) => b.count >= MIN_OCCURRENCES && b.weight >= MIN_WEIGHT)
    .map((b) => ({
      used: b.used,
      required: b.required,
      ...(b.tag ? { tag: b.tag } : {}),
      count: b.count,
      weight: Math.round(b.weight * 100) / 100,
      evidence: b.evidence.slice(0, MAX_EVIDENCE),
      itemIds: [...b.itemIds],
    }))
    .sort((a, b) => b.weight - a.weight);
}
