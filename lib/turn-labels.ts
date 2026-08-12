// WHAT TO CALL EACH PART OF A GRADED TURN — one table, read by every surface that shows one.
//
// The same defect has now been found four times, and the fourth is what put this table in its own file:
//
//   2026-07-27  chat block   TEACH_BACK — the learner's EXPLANATION labelled "Bạn dịch" under "Đề".
//   2026-08-12  chat block   QUIZ — "Bạn dịch: Chọn C", and the ANSWER KEY called "Tham khảo".
//   2026-08-12  chat block   CONVERSATION — a scenario brief labelled "Đề (Việt → Nhật)".
//   2026-08-12  history card — ALL of the above again, because the web has its OWN copy of the labels:
//                             hardcoded "Đề" / "Bạn dịch:" / "Tham khảo:" for every exercise type,
//                             printed right next to a badge reading "Quiz" or "Giảng lại".
//
// The first three were each fixed by adding one more `isX` flag to `renderGradeResult`; the fourth was
// invisible from there, because a second surface had its own hardcoded copy. Two copies of a mapping is
// one copy that will be forgotten — so the mapping lives HERE, and both surfaces read it.
//
// Only the types where the learner does NOT translate a given source need an entry. TRANSLATION, CLOZE,
// DIALOGUE and the two scaffolded rungs (CLOZE_PRODUCTION, GUIDED_PRODUCTION) all involve translating,
// so they take each surface's own defaults — which differ on purpose: the chat block names the direction
// ("Đề (Nhật → Việt)"), the history card has a direction filter above it and does not.

export interface TurnLabels {
  /** Heading for what the learner was GIVEN. */
  prompt: string;
  /** Heading for what the learner PRODUCED. */
  answer: string;
  /** Heading for the reference the app had frozen before they answered. */
  reference: string;
  /**
   * Chat-only: the "do it again to consolidate" offer in the "Tiếp theo?" menu. Surfaces that show no
   * menu ignore it.
   */
  retry: string;
}

export const TURN_LABELS_BY_TYPE: Record<string, TurnLabels> = {
  TEACH_BACK: {
    prompt: 'Mẫu',
    answer: 'Bạn giảng',
    reference: 'Tham khảo',
    retry: 'Giảng lại cho đủ phần còn thiếu',
  },
  QUIZ: {
    prompt: 'Câu hỏi',
    answer: 'Bạn chọn',
    reference: 'Đáp án',
    // Unreachable today — a quiz suppresses the retry offer, since there is nothing to retype when the
    // answer was a letter. Present so the table stays a complete description of the type.
    retry: 'Chọn lại',
  },
  CONVERSATION: {
    prompt: 'Tình huống',
    answer: 'Bạn nói',
    reference: 'Câu mẫu',
    retry: 'Nói lại câu đã sửa',
  },
};

/**
 * Labels for one turn. `fallback` is the surface's own translation wording, used for every type that
 * really is a translation — passed in rather than defaulted here, because the two surfaces word it
 * differently on purpose (see the note at the top).
 */
export function turnLabels(exerciseType: string, fallback: TurnLabels): TurnLabels {
  return TURN_LABELS_BY_TYPE[exerciseType] ?? fallback;
}
