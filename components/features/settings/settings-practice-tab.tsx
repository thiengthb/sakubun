'use client';

import type { Dispatch, SetStateAction } from 'react';
import { BookOpenText, CalendarClock, SlidersHorizontal, Volume2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/common/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { SpeakButton } from '@/components/common/speak-button';
import { SettingsTab } from '@/components/features/settings/settings-tab';
import { SettingsGroup } from '@/components/features/settings/settings-group';
import { SettingsSection } from '@/components/features/settings/settings-section';
import {
  DIRECTION_MODES,
  furiganaInApp,
  JLPT_LEVELS,
  VOICE_SPEAKERS,
  type DirectionMode,
  type Settings,
} from '@/lib/settings/schema';

// Eight settings (docs/decisions/0001-core-rewrite.md). How a sentence is built (length, register,
// topic, difficulty) is derived from the item being studied, so it is no longer a form here; a wish
// for one session is said to Claude in chat.

const DIRECTION_MODE_LABELS: Record<DirectionMode, string> = {
  auto: 'Tự động theo mức nhớ',
  JA_VI: 'Luôn Nhật → Việt',
  VI_JA: 'Luôn Việt → Nhật',
};

export function PracticeTab({
  settings,
  set,
  setSettings,
}: {
  settings: Settings;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  setSettings: Dispatch<SetStateAction<Settings>>;
}) {
  const toggleLevel = (level: Settings['grammarLevels'][number]) => {
    setSettings((s) => {
      const has = s.grammarLevels.includes(level);
      if (has && s.grammarLevels.length === 1) return s; // keep at least one level
      return {
        ...s,
        grammarLevels: has
          ? s.grammarLevels.filter((l) => l !== level)
          : [...s.grammarLevels, level],
      };
    });
  };

  return (
    <SettingsTab value="practice" surface="bare" className="space-y-8">
      <SettingsSection
        icon={BookOpenText}
        title="Học gì"
        hint="Cấp bạn đang học. Mẫu và từ mới chỉ lấy từ các cấp này."
      >
        <SettingsGroup title="Cấp JLPT đang học">
          <Field
            label="Cấp JLPT"
            info="Mẫu ngữ pháp mới lấy từ các cấp được chọn; từ vựng mới không khó hơn cấp cao nhất trong đó. Mục đã học vẫn ôn bất kể cấp."
          >
            <div className="flex h-9 flex-wrap items-center gap-x-5 gap-y-2">
              {JLPT_LEVELS.map((level) => (
                <label
                  key={level}
                  className="flex cursor-pointer items-center gap-2 text-sm font-medium select-none"
                >
                  <Checkbox
                    checked={settings.grammarLevels.includes(level)}
                    onCheckedChange={() => toggleLevel(level)}
                    aria-label={`Cấp ${level}`}
                  />
                  {level}
                </label>
              ))}
            </div>
          </Field>
        </SettingsGroup>
      </SettingsSection>

      <SettingsSection
        icon={CalendarClock}
        title="Nhịp học"
        hint="Mỗi ngày bao nhiêu là đủ. Chạm trần thì phần còn lại dời sang ngày sau, không mất."
      >
        <SettingsGroup title="Hạn mức mỗi ngày">
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
            <Field label="Từ vựng mới / ngày">
              <Input
                type="number"
                min={0}
                max={50}
                value={settings.dailyNewVocab}
                onChange={(e) => set('dailyNewVocab', Number(e.target.value))}
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
          </div>
        </SettingsGroup>

        <SettingsGroup title="Hướng dịch khi luyện với Claude">
          <Field
            label="Hướng dịch"
            info="Tự động: mục mới hoặc đang học thì dịch Nhật → Việt; mục đã nhớ chắc thì dịch Việt → Nhật."
          >
            <Select
              value={settings.directionMode}
              onValueChange={(v) => set('directionMode', v as DirectionMode)}
            >
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue>{DIRECTION_MODE_LABELS[settings.directionMode]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {DIRECTION_MODES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {DIRECTION_MODE_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </SettingsGroup>
      </SettingsSection>

      <SettingsSection
        icon={Volume2}
        title="Hiển thị & giọng đọc"
        hint="Áp dụng cho câu tiếng Nhật ở mọi nơi trong app."
      >
        <SettingsGroup title="Chữ và tiếng">
          <label className="flex min-w-0 cursor-pointer items-center gap-3 select-none">
            <Switch
              checked={furiganaInApp(settings.furiganaMode)}
              onCheckedChange={(on) => set('furiganaMode', on ? 'app' : 'none')}
              aria-label="Hiện furigana"
              className="shrink-0"
            />
            <span className="text-sm">Hiện furigana trên kanji</span>
          </label>

          <Field
            label="Giọng đọc"
            info="Giọng VOICEVOX cho các nút phát âm. Chưa bật VOICEVOX thì app dùng giọng của trình duyệt."
          >
            <div className="flex items-center gap-2">
              <Select
                value={String(settings.voiceSpeaker)}
                onValueChange={(v) => set('voiceSpeaker', Number(v))}
              >
                <SelectTrigger className="w-full sm:w-72">
                  <SelectValue placeholder="Chọn giọng">
                    {VOICE_SPEAKERS.find((v) => v.id === settings.voiceSpeaker)?.label ??
                      `Giọng #${settings.voiceSpeaker}`}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {VOICE_SPEAKERS.map((v) => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <SpeakButton
                text="天気がいいから、散歩しましょう。"
                label="Nghe thử giọng"
                speaker={settings.voiceSpeaker}
                rate={settings.speechRate}
                className="shrink-0"
              />
            </div>
          </Field>

          <Field label={`Tốc độ đọc: ${settings.speechRate}×`}>
            <div className="flex h-9 items-center gap-3">
              <Slider
                thumbLabel="Tốc độ đọc"
                min={0.5}
                max={2}
                step={0.25}
                trackClassName="h-3"
                ticks={[0.75, 1, 1.25, 1.5, 1.75]}
                value={[settings.speechRate]}
                onValueChange={([v]) => set('speechRate', v)}
              />
              <span className="w-10 shrink-0 text-right text-sm text-muted-foreground tabular-nums">
                {settings.speechRate}×
              </span>
            </div>
          </Field>
        </SettingsGroup>
      </SettingsSection>

      <SettingsSection
        icon={SlidersHorizontal}
        title="Nâng cao"
        hint="Ít khi cần đổi. Mặc định đã hợp với hầu hết người học."
      >
        <SettingsGroup title="Lịch ôn">
          <Field
            label={`Mục tiêu ghi nhớ (FSRS): ${Math.round(settings.desiredRetention * 100)}%`}
            info="Cao hơn thì khoảng cách ôn ngắn hơn: nhớ chắc hơn nhưng ôn nhiều hơn (mặc định 90%)."
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
          <Field
            label="Giờ chốt ngày học (0–6h)"
            info="Lượt ôn trước giờ này tính vào ngày hôm trước."
          >
            <Input
              type="number"
              min={0}
              max={6}
              value={settings.dayCutoffHour}
              onChange={(e) => set('dayCutoffHour', Number(e.target.value))}
              className="sm:w-32"
            />
          </Field>
        </SettingsGroup>
      </SettingsSection>
    </SettingsTab>
  );
}
