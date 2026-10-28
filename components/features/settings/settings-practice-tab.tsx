'use client';

import { useId, useState, type Dispatch, type SetStateAction } from 'react';
import {
  ArrowLeftRight,
  BookOpen,
  ChevronDown,
  Gauge,
  ListPlus,
  Moon,
  Repeat,
  SlidersHorizontal,
  SquarePlus,
  Target,
  Volume2,
} from 'lucide-react';
import { SettingsSection } from '@/components/features/settings/settings-section';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { SpeakButton } from '@/components/common/speak-button';
import { Stepper } from '@/components/common/stepper';
import { SettingsTab } from '@/components/features/settings/settings-tab';
import { IconTile } from '@/components/common/icon-tile';
import { SettingRow } from '@/components/features/settings/setting-row';
import { cn } from '@/lib/core/utils';
import {
  JLPT_LEVELS,
  VOICE_SPEAKERS,
  type DirectionMode,
  type Settings,
} from '@/lib/settings/schema';
import { speechRateOptions } from '@/lib/settings/speech-rates';

// Eight settings (docs/decisions/0001-core-rewrite.md), one row each, in one card: icon, a short
// name, an (i) for the why, the control. How a sentence is built (length, register, topic,
// difficulty) is derived from the item being studied, so it is no longer a form here.

const DIRECTION_OPTIONS: { value: DirectionMode; label: string }[] = [
  { value: 'JA_VI', label: 'Nhật → Việt' },
  { value: 'VI_JA', label: 'Việt → Nhật' },
  { value: 'auto', label: 'Tự động' },
];

// Separate raised chips (the `choice` variant), never a sunken track.
const SEGMENTED = 'w-full @md:w-auto';
const SEGMENT = 'flex-1 px-3 @md:flex-none';

export function PracticeTab({
  settings,
  set,
  setSettings,
}: {
  settings: Settings;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  setSettings: Dispatch<SetStateAction<Settings>>;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const advancedId = useId();
  const retention = Math.round(settings.desiredRetention * 100);
  const rates = speechRateOptions(settings.speechRate);

  const setLevels = (levels: string[]) => {
    if (levels.length === 0) return; // keep at least one level
    setSettings((s) => ({
      ...s,
      grammarLevels: JLPT_LEVELS.filter((l) => levels.includes(l)),
    }));
  };

  return (
    <SettingsTab value="practice" surface="bare">
      <SettingsSection>
        <SettingRow
          icon={BookOpen}
          label="Cấp JLPT"
          info="Mẫu và từ mới chỉ lấy từ các cấp được chọn; từ mới không khó hơn cấp cao nhất. Mục đã học vẫn ôn bất kể cấp."
          wide
        >
          <ToggleGroup
            type="multiple"
            variant="choice"
            aria-label="Cấp JLPT"
            value={settings.grammarLevels}
            onValueChange={setLevels}
            className="grid w-full grid-cols-5 gap-1.5 @md:flex @md:w-auto"
          >
            {JLPT_LEVELS.map((level) => (
              <ToggleGroupItem key={level} value={level} className="px-3">
                {level}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </SettingRow>

        <SettingRow icon={ListPlus} label="Mẫu mới" unit="/ ngày">
          <Stepper
            label="Mẫu ngữ pháp mới / ngày"
            min={0}
            max={20}
            value={settings.dailyNewGrammar}
            onChange={(v) => set('dailyNewGrammar', v)}
          />
        </SettingRow>
        <SettingRow icon={SquarePlus} label="Từ mới" unit="/ ngày">
          <Stepper
            label="Từ vựng mới / ngày"
            min={0}
            max={50}
            step={5}
            value={settings.dailyNewVocab}
            onChange={(v) => set('dailyNewVocab', v)}
          />
        </SettingRow>
        <SettingRow
          icon={Repeat}
          label="Ôn tối đa"
          unit="/ ngày"
          info="Chạm trần thì phần còn lại dời sang ngày sau, không mất."
        >
          <Stepper
            label="Tối đa lượt ôn / ngày"
            min={10}
            max={500}
            step={10}
            value={settings.maxReviewsPerDay}
            onChange={(v) => set('maxReviewsPerDay', v)}
          />
        </SettingRow>

        <SettingRow
          icon={ArrowLeftRight}
          label="Hướng dịch"
          info="Tự động: mục mới hoặc đang học dịch Nhật → Việt; mục đã nhớ chắc dịch Việt → Nhật."
          wide
        >
          <ToggleGroup
            type="single"
            variant="choice"
            aria-label="Hướng dịch"
            value={settings.directionMode}
            onValueChange={(v) => v && set('directionMode', v as DirectionMode)}
            className={SEGMENTED}
          >
            {DIRECTION_OPTIONS.map((o) => (
              <ToggleGroupItem key={o.value} value={o.value} className={SEGMENT}>
                {o.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </SettingRow>

        <SettingRow
          icon={Volume2}
          label="Giọng đọc"
          info="Giọng VOICEVOX cho các nút phát âm. Chưa bật VOICEVOX thì app dùng giọng của trình duyệt."
          wide
        >
          <Select
            value={String(settings.voiceSpeaker)}
            onValueChange={(v) => set('voiceSpeaker', Number(v))}
          >
            <SelectTrigger aria-label="Giọng đọc" className="min-w-0 flex-1 @md:w-60 @md:flex-none">
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
        </SettingRow>

        {/* The seventh row of a two-column grid: it takes the whole line, no empty half beside it. */}
        <SettingRow icon={Gauge} label="Tốc độ" wide className="col-span-full">
          <ToggleGroup
            type="single"
            variant="choice"
            aria-label="Tốc độ đọc"
            value={String(settings.speechRate)}
            onValueChange={(v) => v && set('speechRate', Number(v))}
            className={SEGMENTED}
          >
            {rates.map((r) => (
              <ToggleGroupItem key={r} value={String(r)} className={cn(SEGMENT, 'tabular-nums')}>
                {r}×
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </SettingRow>

        <button
          type="button"
          aria-expanded={advancedOpen}
          aria-controls={advancedId}
          onClick={() => setAdvancedOpen((o) => !o)}
          className="col-span-full flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
        >
          <IconTile icon={SlidersHorizontal} tone="primary" />
          <span className="text-sm font-medium">Nâng cao</span>
          <span className="truncate text-xs text-muted-foreground tabular-nums">
            {retention}% · {settings.dayCutoffHour}h
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              'ml-auto size-4 shrink-0 text-muted-foreground transition-transform',
              advancedOpen && 'rotate-180',
            )}
          />
        </button>
        <div
          id={advancedId}
          hidden={!advancedOpen}
          className="col-span-full grid gap-px bg-border @4xl:grid-cols-2 [&>*]:bg-card"
        >
          <SettingRow
            icon={Target}
            label="Mục tiêu nhớ"
            info="Lịch ôn FSRS. Cao hơn thì ôn dày hơn: nhớ chắc hơn nhưng nhiều lượt hơn (mặc định 90%)."
          >
            <Stepper
              label="Mục tiêu ghi nhớ (FSRS)"
              suffix="%"
              min={70}
              max={97}
              value={retention}
              onChange={(v) => set('desiredRetention', v / 100)}
            />
          </SettingRow>
          <SettingRow
            icon={Moon}
            label="Chốt ngày"
            info="Lượt ôn trước giờ này tính vào ngày hôm trước."
          >
            <Stepper
              label="Giờ chốt ngày học"
              suffix="h"
              min={0}
              max={6}
              value={settings.dayCutoffHour}
              onChange={(v) => set('dayCutoffHour', v)}
            />
          </SettingRow>
        </div>
      </SettingsSection>
    </SettingsTab>
  );
}
