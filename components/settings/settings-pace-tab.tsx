'use client';

import { Field } from '@/components/shared/field';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { SettingsTab } from '@/components/settings/settings-tab';
import type { Settings } from '@/lib/settings-schema';

/** Tab "Nhịp học": daily new/review caps, session goal, vocab-per-sentence, day cutoff, retention. */
export function PaceTab({
  settings,
  set,
}: {
  settings: Settings;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}) {
  return (
    <SettingsTab value="pace">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Mẫu ngữ pháp mới / ngày">
          <Input
            type="number"
            min={0}
            max={20}
            value={settings.dailyNewGrammar}
            onChange={(e) => set('dailyNewGrammar', Number(e.target.value))}
          />
        </Field>
        <Field
          label="Mẫu mới tối đa / câu"
          info="Số mẫu ngữ pháp BẠN CHƯA GẶP LẦN NÀO được phép nằm trong CÙNG một câu. Khác với hạn mức theo NGÀY ở trên: mỗi mẫu mới đều cần một bài giảng nhỏ, nên nhồi 2–3 mẫu lạ vào một câu vừa khó hiểu vừa làm câu mất tự nhiên. Mặc định 1 (mỗi lần một cái mới) — mẫu bị hoãn sẽ xuất hiện ở câu kế tiếp, không mất đi."
        >
          <Input
            type="number"
            min={1}
            max={5}
            value={settings.maxNewPerSentence}
            onChange={(e) => set('maxNewPerSentence', Number(e.target.value))}
          />
        </Field>
        <Field label="Tối đa lượt ôn / ngày">
          <Input
            type="number"
            min={10}
            max={500}
            value={settings.maxReviewsPerDay}
            onChange={(e) => set('maxReviewsPerDay', Number(e.target.value))}
          />
        </Field>
        <Field
          label="Mục tiêu câu / ngày"
          info="Hiện tiến độ «câu 5/10» trong lúc luyện — đạt mục tiêu sẽ được chúc mừng."
        >
          <Input
            type="number"
            min={3}
            max={50}
            value={settings.sessionGoal}
            onChange={(e) => set('sessionGoal', Number(e.target.value))}
          />
        </Field>
        <Field
          label="Từ vựng / câu"
          info="Số từ vựng bạn đã tra (thêm bằng add_vocab trong Claude) được dệt vào MỖI câu (chế độ Dịch) để ôn trong ngữ cảnh — ngân sách RIÊNG, không chiếm chỗ mẫu ngữ pháp và không ăn hạn mức ôn/mới. Đặt 0 để tắt."
        >
          <Input
            type="number"
            min={0}
            max={5}
            value={settings.vocabPerSentence}
            onChange={(e) => set('vocabPerSentence', Number(e.target.value))}
          />
        </Field>
        <Field
          label="Giờ chốt ngày học (0–6h)"
          info="Kiểu Anki: lượt ôn trước giờ này tính vào ngày hôm trước."
        >
          <Input
            type="number"
            min={0}
            max={6}
            value={settings.dayCutoffHour}
            onChange={(e) => set('dayCutoffHour', Number(e.target.value))}
          />
        </Field>
      </div>

      <Field
        label={`Mục tiêu ghi nhớ (FSRS): ${Math.round(settings.desiredRetention * 100)}%`}
        info="Cao hơn = khoảng cách ôn ngắn hơn, nhớ chắc hơn nhưng ôn nhiều hơn (mặc định 90%)."
      >
        <div className="flex h-9 items-center">
          <Slider
            thumbLabel="Mục tiêu ghi nhớ (FSRS)"
            min={70}
            max={97}
            step={1}
            trackClassName="h-3"
            ticks={[75, 80, 85, 90, 95]}
            value={[Math.round(settings.desiredRetention * 100)]}
            onValueChange={([v]) => set('desiredRetention', v / 100)}
          />
        </div>
      </Field>
    </SettingsTab>
  );
}
