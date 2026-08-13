'use client';

import { Field } from '@/components/shared/field';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { SettingsTab } from '@/components/settings/settings-tab';
import { SettingsGroup } from '@/components/settings/settings-group';
import type { Settings } from '@/lib/settings-schema';

/**
 * Tab "Nhịp học" — now one thing: how much per DAY, and how hard the schedule pushes.
 *
 * `Từ vựng / câu` and `Mẫu mới tối đa / câu` left for "Nội dung" (issue #38) — two per-SENTENCE budgets
 * in a tab of per-DAY caps. Their presence is what made the boundary meaningless: `Mẫu mới / ngày` and
 * `Mẫu mới tối đa / câu` were adjacent cells of one grid measuring different things, a labelling problem
 * no tooltip fixes.
 *
 * The split of what remains is not cosmetic: the four caps are LIMITS set from the time you have, while
 * retention is a TARGET set from how well you want to remember — FSRS derives the interval from it, so
 * it is the only control here that changes the algorithm rather than clamping its output.
 */
export function PaceTab({
  settings,
  set,
}: {
  settings: Settings;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}) {
  return (
    <SettingsTab value="pace" surface="bare">
      <SettingsGroup
        title="Hạn mức mỗi ngày"
        hint="Đặt theo quỹ thời gian bạn có. Chạm trần thì phần còn lại dời sang ngày sau, không mất."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mẫu ngữ pháp mới / ngày">
            <Input
              type="number"
              min={0}
              max={20}
              value={settings.dailyNewGrammar}
              onChange={(e) => set('dailyNewGrammar', Number(e.target.value))}
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
      </SettingsGroup>

      <SettingsGroup
        title="Mục tiêu ghi nhớ"
        hint="Ô duy nhất ở trang này đổi CÁCH TÍNH lịch, không phải chặn đầu ra của nó. Trang Phân tích đo tỉ lệ nhớ thật của bạn so với con số đặt ở đây."
      >
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
      </SettingsGroup>
    </SettingsTab>
  );
}
