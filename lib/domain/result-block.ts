// The result of one translation turn, the same few lines every time (R4,
// docs/plans/2026-11-07-translation-difficulty.md A): right or not, what the learner wrote, the
// reference sentence, and the AI's one line of feedback. grade_turn hands it over ready made, so a
// right answer gets a reference too and Claude only copies it. Markdown, in Vietnamese. Pure.

const RATING_VI = ['', 'Quên', 'Khó', 'Nhớ', 'Dễ'] as const;
const VERDICT = ['', 'Chưa đúng', 'Đúng ý, còn lỗi', 'Đúng', 'Đúng'] as const;

export function untilVi(due: Date, now: Date): string {
  const minutes = Math.max(1, Math.round((due.getTime() - now.getTime()) / 60_000));
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} giờ`;
  return `${Math.round(hours / 24)} ngày`;
}

export interface ResultInput {
  rating: 1 | 2 | 3 | 4;
  nextDue: Date;
  now: Date;
  answer: string;
  /** The sentence in the language the learner answered in. */
  reference: string;
  feedback: string | null;
}

export function resultBlock(r: ResultInput): string[] {
  const label = r.rating <= 2 ? 'Lỗi chính' : 'Cách nói khác';
  return [
    `**${VERDICT[r.rating]} · ${RATING_VI[r.rating]}** · ôn lại sau ${untilVi(r.nextDue, r.now)}`,
    '',
    `> **Bạn viết:** ${r.answer}`,
    `> **Tham khảo:** ${r.reference}`,
    ...(r.feedback ? ['', `**${label}:** ${r.feedback}`] : []),
  ];
}
