export interface TurnLabels {
  prompt: string;
  answer: string;
  reference: string;
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
    retry: 'Chọn lại',
  },
  CONVERSATION: {
    prompt: 'Tình huống',
    answer: 'Bạn nói',
    reference: 'Câu mẫu',
    retry: 'Nói lại câu đã sửa',
  },
};

export function turnLabels(exerciseType: string, fallback: TurnLabels): TurnLabels {
  return TURN_LABELS_BY_TYPE[exerciseType] ?? fallback;
}
