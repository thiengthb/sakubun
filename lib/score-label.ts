export type SentenceDisplayStatus = 'PENDING' | 'GRADED' | 'SKIPPED';

export type ScoreLabel = {
  text: string;
  muted: boolean;
};

export function scoreLabel(status: string, score: number | null | undefined): ScoreLabel | null {
  if (status === 'SKIPPED') return { text: 'Bỏ qua', muted: true };
  if (status !== 'GRADED') return null;
  if (typeof score === 'number') return { text: `${score}/100`, muted: false };
  return { text: 'Chưa có điểm', muted: true };
}
