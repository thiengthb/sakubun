import { prisma } from '@/lib/db';
import { listItems } from '@/lib/practice';
import { normalizeExpression, stripDecoration } from '@/lib/normalize';
import { JLPT_LEVELS, type JlptLevel } from '@/lib/settings-schema';

export type ScaffoldStatus =
  | 'known'
  | 'newToLearner';

export interface ScaffoldPattern {
  expression: string;
  status: ScaffoldStatus;
  level: JlptLevel | null;
  itemId?: string;
  aboveDrilledLevel: boolean;
}

function rank(level: string | null | undefined): number | null {
  const i = JLPT_LEVELS.indexOf(level as JlptLevel);
  return i === -1 ? null : i;
}

export function isAboveLevel(candidate: string | null, drilled: string | null): boolean {
  const a = rank(candidate);
  const b = rank(drilled);
  if (a === null || b === null) return false;
  return a > b;
}

export const MAX_EXTRA_PATTERNS = 5;

export async function drilledLevelOf(
  itemIds: readonly string[],
): Promise<JlptLevel | null> {
  if (itemIds.length === 0) return null;
  const rows = await prisma.item.findMany({
    where: { id: { in: [...itemIds] } },
    select: { level: true },
  });
  let hardest: number | null = null;
  for (const r of rows) {
    const i = rank(r.level);
    if (i !== null && (hardest === null || i > hardest)) hardest = i;
  }
  return hardest === null ? null : JLPT_LEVELS[hardest];
}

export async function classifyExtraPatterns(
  patterns: readonly string[],
  drilledLevel: string | null,
): Promise<ScaffoldPattern[]> {
  const wanted = patterns
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .slice(0, MAX_EXTRA_PATTERNS);
  if (wanted.length === 0) return [];

  return Promise.all(
    wanted.map(async (expression) => {
      const search = stripDecoration(expression);
      const key = normalizeExpression(expression);
      const mine = await listItems({ kind: 'GRAMMAR', search, limit: 20 });

      const own = mine.find((i) => normalizeExpression(i.expression) === key);
      if (own) {
        return {
          expression,
          status: 'known' as const,
          level: (own.level as JlptLevel) ?? null,
          itemId: own.itemId,
          aboveDrilledLevel: isAboveLevel(own.level ?? null, drilledLevel),
        };
      }

      return {
        expression,
        status: 'newToLearner' as const,
        level: null,
        aboveDrilledLevel: false,
      };
    }),
  );
}
