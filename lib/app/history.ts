import { prisma } from '@/lib/db/db';
import { listSentences, type SentenceHistoryRow } from '@/lib/library/practice';
import { MAX_LISTED_ITEMS } from '@/lib/library/item-limits';

// The History page lists both kinds of translation practice in one timeline: pre-v2 sentences
// (Sentence, possibly several items) and v2 turns (Turn, exactly one item). A turn is dressed in
// the sentence row's shape so the page renders both the same way; `rating` carries its 1-4 grade,
// since a turn has no 0-100 score.

export type HistoryRow = SentenceHistoryRow & {
  kind: 'sentence' | 'turn';
  rating: number | null;
};

const TURN_STATUS: Record<string, string> = {
  staged: 'PENDING',
  graded: 'GRADED',
  skipped: 'SKIPPED',
};

export interface TurnHistorySource {
  id: string;
  direction: string;
  ja: string;
  jaRuby: string | null;
  vi: string;
  status: string;
  answer: string | null;
  rating: number | null;
  feedback: string | null;
  createdAt: Date;
  gradedAt: Date | null;
  item: { expression: string; level: string } | null;
}

export function turnToRow(turn: TurnHistorySource): HistoryRow {
  const readsJapanese = turn.direction === 'JA_VI';
  const sourceText = readsJapanese ? turn.ja : turn.vi;
  return {
    kind: 'turn',
    id: turn.id,
    direction: turn.direction,
    status: TURN_STATUS[turn.status] ?? 'PENDING',
    exerciseType: 'TRANSLATION',
    sourceText,
    sourceRuby: readsJapanese ? turn.jaRuby : null,
    userAnswer: turn.answer ?? '',
    suggested: readsJapanese ? turn.vi : turn.ja,
    suggestedRuby: readsJapanese ? null : turn.jaRuby,
    feedback: turn.feedback,
    score: null,
    rating: turn.rating,
    createdAt: turn.createdAt,
    starred: false,
    level: turn.item?.level ?? null,
    context: null,
    answeredAt: turn.gradedAt,
    charCount: sourceText.length,
    ratings:
      turn.rating === null
        ? []
        : [
            {
              expression: turn.item?.expression ?? '(đã xóa)',
              rating: turn.rating,
              role: 'TARGET',
            },
          ],
  };
}

// The page lists every turn (the same ceiling as Tài nguyên): a cap below the real count would
// make the header's count and the search quietly wrong.
export async function listHistory(limit = MAX_LISTED_ITEMS): Promise<HistoryRow[]> {
  const [sentences, turns] = await Promise.all([
    listSentences(limit),
    prisma.turn.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { item: { select: { expression: true, level: true } } },
    }),
  ]);
  const rows: HistoryRow[] = [
    ...sentences.map((s) => ({ ...s, kind: 'sentence' as const, rating: null })),
    ...turns.map(turnToRow),
  ];
  return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
}
