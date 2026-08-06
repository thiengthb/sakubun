import { lengthBucket } from '@/lib/format';
import { JLPT_LEVELS } from '@/lib/settings-schema';

/**
 * "Học sinh làm tốt tới đâu, chia theo ĐỘ KHÓ và theo ĐỘ DÀI câu" — một phép tính, một chỗ.
 *
 * Gom 2026-08-07. `lib/analytics.ts` và `lib/stats.ts` mỗi file tự khai `MAX_ANSWER_SEC`, `durationSec`,
 * `Agg`, `summarize`, rồi cùng chạy MỘT vòng lặp 30 dòng giống nhau **từng ký tự** trừ tên biến —
 * `dup-scan` đo được 20 cửa sổ, là cặp trùng lặp lớn nhất trong `lib/`. Hai file đã dính nhau từ trước
 * (`stats.ts` import type `PerfBreakdown` từ `analytics.ts`), nên đây không phải hai domain tình cờ
 * giống nhau: cùng một kiến thức, viết hai lần.
 *
 * Câu hỏi vàng của /dedupe-scan — "hai chỗ này đổi CÙNG NHAU hay ĐỘC LẬP?" — ở đây trả lời rõ: đổi
 * cùng nhau. Cách suy ra độ khó (level của mẫu TARGET, fallback sang mẫu được chấm bất kỳ), cách chia
 * nhóm độ dài, và cửa sổ thời-gian-hợp-lệ đều là một định nghĩa duy nhất; sửa một bên mà quên bên kia
 * thì hai bảng phân tích của cùng một app sẽ nói hai điều khác nhau về cùng một dữ liệu.
 */

/** Trên ngưỡng này thì "thời gian trả lời" là rác (tab để mở qua đêm), không phải dữ liệu. */
export const MAX_ANSWER_SEC = 3600;

/** Một dòng trong bảng phân tích theo nhóm. */
export interface PerfBreakdown {
  label: string;
  count: number;
  /** null khi không lượt nào trong nhóm có điểm. */
  avgScore: number | null;
  avgSec: number;
}

/** Giây từ lúc đề hiện ra tới lúc được chấm; `-1` khi chưa trả lời (để phép lọc dưới loại đi). */
export const answerDurationSec = (s: { createdAt: Date; answeredAt: Date | null }): number =>
  s.answeredAt ? (s.answeredAt.getTime() - s.createdAt.getTime()) / 1000 : -1;

/** Giây hợp lệ, hoặc null. Một chỗ quyết định "hợp lệ" nghĩa là gì. */
export const validAnswerSec = (s: { createdAt: Date; answeredAt: Date | null }): number | null => {
  const sec = answerDurationSec(s);
  return sec >= 0 && sec <= MAX_ANSWER_SEC ? sec : null;
};

/** Hình dạng tối thiểu mà phép tính cần: câu + các lượt chấm của nó. */
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

/**
 * Chia các lượt ĐÃ TRẢ LỜI thành hai bảng: theo cấp JLPT của mẫu trọng tâm, và theo nhóm độ dài câu đề.
 *
 * Độ khó lấy theo mẫu **TARGET**, fallback sang mẫu được chấm bất kỳ — vì `item` có thể null sau khi
 * người học xoá mục (ReviewLog là append-only, invariant #2), và một lượt không còn mẫu nào truy ra được
 * thì đơn giản không vào bảng theo cấp. Nó VẪN vào bảng theo độ dài: độ dài câu không phụ thuộc mẫu.
 */
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
