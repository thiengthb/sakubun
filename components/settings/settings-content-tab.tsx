'use client';

import type { Dispatch, SetStateAction } from 'react';
import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/shared/field';
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
import { SettingsTab } from '@/components/settings/settings-tab';
import { SettingsGroup } from '@/components/settings/settings-group';
import {
  DIFFICULTY_ANCHORS,
  DIRECTIONS,
  FURIGANA_MODES,
  hardestLevel,
  JLPT_LEVELS,
  REGISTERS,
  SENTENCE_SIZES,
  TOPIC_PRESETS,
  TRANSLATION_STYLES,
  type FuriganaMode,
  type JlptLevel,
  type Settings,
} from '@/lib/settings-schema';
import { SENTENCE_SIZE_SPEC } from '@/lib/select';
import { cn } from '@/lib/utils';

const AUTO_VOCAB_CEILING = 'auto';

const SIZE_LABELS: Record<(typeof SENTENCE_SIZES)[number], string> = {
  xshort: 'Rất ngắn',
  short: 'Ngắn',
  medium: 'Vừa',
  long: 'Dài',
  xlong: 'Rất dài',
  huge: 'Cực dài',
  paragraph: 'Đoạn văn',
};

const DIRECTION_LABELS: Record<(typeof DIRECTIONS)[number], string> = {
  JA_VI: 'Nhật → Việt',
  VI_JA: 'Việt → Nhật',
  ALTERNATING: 'Song ngữ (đổi chiều từng câu)',
};

const STYLE_LABELS: Record<(typeof TRANSLATION_STYLES)[number], string> = {
  natural: 'Tự nhiên (ưu tiên thoát ý)',
  balanced: 'Cân bằng',
  accurate: 'Chính xác (bám sát cấu trúc)',
};

const REGISTER_LABELS: Record<(typeof REGISTERS)[number], string> = {
  casual: 'Thân mật (thường thể)',
  polite: 'Lịch sự (です・ます)',
  keigo: 'Kính ngữ (tôn kính / khiêm nhường)',
  business: 'Công việc (business)',
  written: 'Văn viết',
  mixed: 'Đa dạng (đổi mỗi câu)',
};

const FURIGANA_MODE_LABELS: Record<FuriganaMode, string> = {
  app: 'Chỉ trong app',
  claude: 'Chỉ bên Claude',
  both: 'Cả app lẫn Claude',
  none: 'Không hiện',
};

const AUTO_CAPTURE_FLAGS = [
  {
    key: 'vocab' as const,
    label: 'Thêm từ bạn vừa hỏi vào kho ôn',
    hint: 'Từ bạn hỏi nghĩa hoặc dùng sai trong lúc luyện.',
  },
  {
    key: 'enrichPatch' as const,
    label: 'Bổ sung phần còn thiếu vào thẻ',
    hint: 'Chỉ THÊM (phân biệt, bẫy, ví dụ) — không bao giờ ghi đè phần thẻ đang có.',
  },
];

export function ContentTab({
  settings,
  set,
  setSettings,
}: {
  settings: Settings;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  setSettings: Dispatch<SetStateAction<Settings>>;
}) {
  const [customTopic, setCustomTopic] = useState('');

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

  const toggleTopic = (topic: string) =>
    setSettings((s) => ({
      ...s,
      topics: s.topics.includes(topic) ? s.topics.filter((t) => t !== topic) : [...s.topics, topic],
    }));

  const addCustomTopic = () => {
    const topic = customTopic.trim();
    if (!topic) return;
    if (!settings.topics.includes(topic)) set('topics', [...settings.topics, topic]);
    setCustomTopic('');
  };

  const customTopics = settings.topics.filter(
    (t) => !TOPIC_PRESETS.includes(t as (typeof TOPIC_PRESETS)[number]),
  );

  return (
    <SettingsTab value="content" surface="bare">
      <SettingsGroup
        title="Chọn gì để học"
        hint="Phạm vi Claude được lấy mẫu và từ ra, cùng bối cảnh nó đặt câu vào."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Cấp JLPT cho mẫu ngữ pháp mới"
            info="Chỉ lọc mẫu ngữ pháp MỚI được đưa vào học. Mẫu đã học đến hạn vẫn ôn bất kể cấp. Từ vựng Claude dùng quanh mẫu là một knob RIÊNG ngay bên cạnh (trước đây hai thứ này dùng chung một ô, buộc chúng phải bằng nhau)."
          >
            <div className="flex h-9 flex-wrap items-center gap-x-5 gap-y-2">
              {JLPT_LEVELS.map((level) => {
                const active = settings.grammarLevels.includes(level);
                return (
                  <label
                    key={level}
                    className="flex cursor-pointer items-center gap-2 text-sm font-medium select-none"
                  >
                    <Checkbox
                      checked={active}
                      onCheckedChange={() => toggleLevel(level)}
                      aria-label={`Cấp ${level}`}
                    />
                    {level}
                  </label>
                );
              })}
            </div>
          </Field>

          <Field
            label="Trần từ vựng"
            info="Cấp khó nhất Claude được dùng cho TỪ VỰNG tự do trong câu (không phải mẫu được chấm điểm). Để «Theo cấp ngữ pháp» thì nó tự đi theo ô bên cạnh — bạn không phải bảo trì. Chọn cụ thể khi muốn ngữ pháp và từ vựng ở hai cấp khác nhau (ví dụ luyện ngữ pháp N3 nhưng muốn tiếp xúc từ vựng N2)."
          >
            <Select
              value={settings.vocabCeiling ?? AUTO_VOCAB_CEILING}
              onValueChange={(v) =>
                set('vocabCeiling', v === AUTO_VOCAB_CEILING ? null : (v as JlptLevel))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {settings.vocabCeiling ??
                    `Theo cấp ngữ pháp (${hardestLevel(settings.grammarLevels)})`}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AUTO_VOCAB_CEILING}>
                  Theo cấp ngữ pháp ({hardestLevel(settings.grammarLevels)})
                </SelectItem>
                {JLPT_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field
          label="Chủ đề nội dung"
          info="Chọn nhanh chủ đề hoặc thêm chủ đề riêng — Claude lồng bối cảnh câu theo các chủ đề này."
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-5">
              {TOPIC_PRESETS.map((topic) => {
                const active = settings.topics.includes(topic);
                return (
                  <label
                    key={topic}
                    title={topic}
                    className="flex min-w-0 cursor-pointer items-center gap-2 text-sm capitalize select-none"
                  >
                    <Checkbox
                      checked={active}
                      onCheckedChange={() => toggleTopic(topic)}
                      aria-label={topic}
                      className="shrink-0"
                    />
                    <span className="truncate">{topic}</span>
                  </label>
                );
              })}
            </div>
            {customTopics.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {customTopics.map((topic) => (
                  <span
                    key={topic}
                    className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-secondary px-3 py-1 text-sm"
                  >
                    {topic}
                    <button
                      type="button"
                      aria-label={`Bỏ chủ đề ${topic}`}
                      onClick={() => toggleTopic(topic)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomTopic();
                  }
                }}
                placeholder="Thêm chủ đề riêng (anime, công việc…) rồi Enter"
              />
              <Button type="button" variant="secondary" onClick={addCustomTopic}>
                Thêm
              </Button>
            </div>
          </div>
        </Field>
      </SettingsGroup>

      <SettingsGroup
        title="Câu trông như thế nào"
        hint="Mọi thứ quy định MỘT câu bài tập — hình dạng, độ khó cấu trúc, độ dài, và có bao nhiêu thứ mới trong đó."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Hướng dịch">
            <Select
              value={settings.direction}
              onValueChange={(v) => set('direction', v as Settings['direction'])}
            >
              <SelectTrigger className="w-full">
                <SelectValue>{DIRECTION_LABELS[settings.direction]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {DIRECTIONS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {DIRECTION_LABELS[d]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Văn phong tiếng Nhật">
            <Select
              value={settings.register}
              onValueChange={(v) => set('register', v as Settings['register'])}
            >
              <SelectTrigger className="w-full">
                <SelectValue>{REGISTER_LABELS[settings.register]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {REGISTERS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {REGISTER_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            label="Kiểu chấm dịch"
            info="natural = ưu tiên câu dịch tự nhiên · accurate = bám sát từng thành phần · balanced = ở giữa."
          >
            <Select
              value={settings.translationStyle}
              onValueChange={(v) => set('translationStyle', v as Settings['translationStyle'])}
            >
              <SelectTrigger className="w-full">
                <SelectValue>{STYLE_LABELS[settings.translationStyle]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {TRANSLATION_STYLES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STYLE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            label="Furigana"
            info="Cách đọc kanji cho câu tiếng Nhật: hiện trong app, để Claude chèn sẵn, cả hai, hay không hiện."
          >
            <Select
              value={settings.furiganaMode}
              onValueChange={(v) => set('furiganaMode', v as FuriganaMode)}
            >
              <SelectTrigger className="w-full">
                <SelectValue>{FURIGANA_MODE_LABELS[settings.furiganaMode]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {FURIGANA_MODES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {FURIGANA_MODE_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field
          label={`Độ phức tạp của câu: ${settings.difficulty}/5`}
          info="Độ phức tạp CẤU TRÚC — KHÔNG phải độ khó từ vựng (đó là «Trần từ vựng» ở nhóm trên), không phải độ dài (đó là «Cỡ câu» ngay dưới), không phải mức độ mới (đó là «Mẫu mới tối đa / câu» ở cuối nhóm này). Mỗi mức được định nghĩa bằng thứ đếm được: số mệnh đề, độ sâu lồng nhau, sắc thái trợ từ."
        >
          <div className="space-y-2 px-1 pt-2">
            <Slider
              thumbLabel="Độ phức tạp của câu"
              min={1}
              max={5}
              step={1}
              trackClassName="h-3"
              ticks={[2, 3, 4]}
              value={[settings.difficulty]}
              onValueChange={([v]) => set('difficulty', v)}
            />
            <p className="text-xs text-muted-foreground">
              {DIFFICULTY_ANCHORS[settings.difficulty]?.vi}
            </p>
          </div>
        </Field>

        <Field
          label="Cỡ câu"
          info="Một mức duy nhất quy định CẢ độ dài câu đề LẪN số mẫu ngữ pháp dệt vào — câu càng dài càng nhiều mẫu (câu quá ngắn không thể nhồi nhiều mẫu mà vẫn tự nhiên). Server tự canh số chữ theo ngôn ngữ nguồn (文字 Nhật cô đặc hơn ký tự Việt)."
          hint={`Nhật ~${SENTENCE_SIZE_SPEC[settings.sentenceSize].ja} 文字 · Việt ~${SENTENCE_SIZE_SPEC[settings.sentenceSize].vi} ký tự · ${SENTENCE_SIZE_SPEC[settings.sentenceSize].patterns} mẫu ngữ pháp`}
        >
          <div className="space-y-2 px-1 pt-2">
            <Slider
              thumbLabel="Cỡ câu"
              valueText={(i) => SIZE_LABELS[SENTENCE_SIZES[i]] ?? String(i)}
              min={0}
              max={SENTENCE_SIZES.length - 1}
              step={1}
              trackClassName="h-3"
              ticks={Array.from({ length: SENTENCE_SIZES.length - 2 }, (_, i) => i + 1)}
              value={[SENTENCE_SIZES.indexOf(settings.sentenceSize)]}
              onValueChange={([i]) => set('sentenceSize', SENTENCE_SIZES[i])}
            />
            <div className="flex gap-1 text-xs leading-tight text-muted-foreground">
              {SENTENCE_SIZES.map((size, i) => {
                const edge = i === 0 || i === SENTENCE_SIZES.length - 1;
                return (
                  <span
                    key={size}
                    className={cn(
                      edge ? 'flex-[0.5]' : 'flex-1',
                      i === 0
                        ? 'text-left'
                        : i === SENTENCE_SIZES.length - 1
                          ? 'text-right'
                          : 'text-center',
                      settings.sentenceSize === size && 'font-medium text-foreground',
                    )}
                  >
                    {SIZE_LABELS[size]}
                  </span>
                );
              })}
            </div>
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
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
            label="Mẫu mới tối đa / câu"
            info="Số mẫu ngữ pháp BẠN CHƯA GẶP LẦN NÀO được phép nằm trong CÙNG một câu. Khác với hạn mức theo NGÀY ở tab «Nhịp học»: mỗi mẫu mới đều cần một bài giảng nhỏ, nên nhồi 2–3 mẫu lạ vào một câu vừa khó hiểu vừa làm câu mất tự nhiên. Mặc định 1 (mỗi lần một cái mới) — mẫu bị hoãn sẽ xuất hiện ở câu kế tiếp, không mất đi."
          >
            <Input
              type="number"
              min={1}
              max={5}
              value={settings.maxNewPerSentence}
              onChange={(e) => set('maxNewPerSentence', Number(e.target.value))}
            />
          </Field>
        </div>
      </SettingsGroup>

      <SettingsGroup
        title="Cho Claude tự làm giúp"
        hint="Mặc định TẮT hết: Claude luôn hỏi trước khi thêm gì vào kho. Bật một mục nghĩa là bạn cho phép trước cho RIÊNG loại việc đó — Claude làm luôn rồi báo lại một dòng. Chỉ những việc THÊM VÀO và huỷ được mới có ở đây."
      >
        <div className="flex flex-col gap-3">
          {AUTO_CAPTURE_FLAGS.map(({ key, label, hint }) => (
            <label key={key} className="flex min-w-0 cursor-pointer items-start gap-3 select-none">
              <Switch
                checked={settings.autoCapture[key]}
                onCheckedChange={(next) =>
                  set('autoCapture', { ...settings.autoCapture, [key]: next })
                }
                aria-label={label}
                className="mt-0.5 shrink-0"
              />
              <span className="min-w-0">
                <span className="block text-sm">{label}</span>
                <span className="block text-xs text-muted-foreground">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </SettingsGroup>
    </SettingsTab>
  );
}
