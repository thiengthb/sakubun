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

// Sentinel for the "follow grammarLevels" option: a shadcn Select item cannot carry a null value, and
// JLPT_LEVELS must stay a closed set, so the auto case gets its own token mapped back to null on save.
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

/** Tab "Nội dung": JLPT levels + furigana, direction/style/register/difficulty, sentence size, topics. */
/**
 * The three pre-authorisable classes. Each is ADDITIVE and undoable, which is the whole reason it is
 * allowed to be automatic — there is deliberately no flag for anything that overwrites a card or
 * touches the review schedule.
 */
// `autoCapture.fork` is NOT here on purpose (2026-08-05). It pre-authorised "lấy về mẫu người khác đã
// chia sẻ", and the shared library was cut with the multi-user surface on 2026-08-03 — `lib/lookup.ts`
// now returns `shared: []` unconditionally, so the switch could never fire. A live control for a
// capability that no longer exists is worse than a missing one: the learner turns it on and concludes
// the app is broken when nothing happens. The FIELD stays in `settings-schema.ts` (a JSON backup taken
// before the cut still carries it, and `lib/import.ts` must keep parsing those) — only the UI is gone.
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

  // Custom = user-typed topics that aren't one of the preset chips (shown as removable badges).
  const customTopics = settings.topics.filter(
    (t) => !TOPIC_PRESETS.includes(t as (typeof TOPIC_PRESETS)[number]),
  );

  return (
    <SettingsTab value="content">
      <Field
        label="Cấp JLPT cho mẫu ngữ pháp mới"
        info="Chỉ lọc mẫu ngữ pháp MỚI được đưa vào học. Mẫu đã học đến hạn vẫn ôn bất kể cấp. Từ vựng Claude dùng quanh mẫu là một knob RIÊNG ở dưới (trước đây hai thứ này dùng chung một ô, buộc chúng phải bằng nhau)."
      >
        {/* JLPT levels as checkboxes; the furigana toggle rides the SAME row (sm:ml-auto), its
              explanation folded into the item label (per the 2026-07-18 request). */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
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
          <label className="flex items-center gap-2.5 text-sm select-none sm:ml-auto">
            <span className="flex flex-col leading-tight">
              Furigana
              <span className="text-xs font-normal text-muted-foreground">
                cách đọc kanji (câu Nhật)
              </span>
            </span>
            <Select
              value={settings.furiganaMode}
              onValueChange={(v) => set('furiganaMode', v as FuriganaMode)}
            >
              <SelectTrigger size="sm" className="w-40 shrink-0">
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
          </label>
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Trần từ vựng"
          info="Cấp khó nhất Claude được dùng cho TỪ VỰNG tự do trong câu (không phải mẫu được chấm điểm). Để «Theo cấp ngữ pháp» thì nó tự đi theo ô trên — bạn không phải bảo trì. Chọn cụ thể khi muốn ngữ pháp và từ vựng ở hai cấp khác nhau (ví dụ luyện ngữ pháp N3 nhưng muốn tiếp xúc từ vựng N2)."
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
      </div>

      {/* FULL WIDTH, and the same shape as «Cỡ câu» right below it (2026-08-05, by request). These are
          the tab's only two scales, and they were drawn at two different lengths — this one at half width
          inside the 2-column grid, that one across the whole card — so the same "slide from 1 to 5"
          gesture had two different travels. They are also the pair whose info text points at each other
          ("không phải độ dài — đó là «Cỡ câu»"), and a cross-reference only reads as one if the two
          things look like siblings.
          The rung's meaning is READ FROM DIFFICULTY_ANCHORS — the same text Claude receives on the
          composition sheet — so what you set and what gets generated cannot mean two things. */}
      <Field
        label={`Độ phức tạp của câu: ${settings.difficulty}/5`}
        info="Độ phức tạp CẤU TRÚC — KHÔNG phải độ khó từ vựng (đó là «Trần từ vựng»), không phải độ dài (đó là «Cỡ câu»), không phải mức độ mới (đó là «Mẫu mới tối đa/câu»). Mỗi mức được định nghĩa bằng thứ đếm được: số mệnh đề, độ sâu lồng nhau, sắc thái trợ từ."
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
            min={0}
            max={SENTENCE_SIZES.length - 1}
            step={1}
            trackClassName="h-3"
            ticks={Array.from({ length: SENTENCE_SIZES.length - 2 }, (_, i) => i + 1)}
            value={[SENTENCE_SIZES.indexOf(settings.sentenceSize)]}
            onValueChange={([i]) => set('sentenceSize', SENTENCE_SIZES[i])}
          />
          {/* Nhãn phải nằm dưới ĐÚNG nấc của nó. Trước 2026-08-11 mỗi nhãn là `flex-1 text-center`, tức
              7 cột đều nhau → tâm nhãn ở (i+0.5)/7 của track, còn nấc trượt ở i/6. Đo ở 1440px: track
              300→1396 nên nấc nằm ở 300·483·665·848·1031·1213·1396, còn tâm nhãn ở 377·…·1319 — chỉ nhãn
              GIỮA trùng nấc giữa, hai đầu lệch 77px, nên "Rất ngắn" không nằm dưới nấc Rất ngắn.
              Cách sửa: hai nhãn đầu/cuối lấy NỬA cột và canh ra biên, các nhãn giữa lấy cột đầy và canh
              giữa. Tổng thành 6 đơn vị = số khoảng của 7 nấc, nên tâm nhãn giữa thứ i rơi đúng i/6, và
              hai nhãn biên áp vào hai đầu track thay vì tràn ra khỏi thẻ. */}
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

      <Field
        label="Chủ đề nội dung"
        info="Chọn nhanh chủ đề hoặc thêm chủ đề riêng — Claude lồng bối cảnh câu theo các chủ đề này."
      >
        <div className="space-y-3">
          {/* Topics as a 5-column checkbox grid (Discord-style rows), per the 2026-07-19 request;
                each label truncates so a long topic never breaks the grid alignment. */}
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

      <Field
        label="Cho Claude tự làm giúp"
        info="Mặc định TẮT hết: Claude luôn hỏi trước khi thêm gì vào kho. Bật một mục nào đó nghĩa là bạn cho phép trước cho RIÊNG loại việc đó — Claude làm luôn rồi báo lại một dòng, thay vì hỏi. Chỉ những việc THÊM VÀO và huỷ được mới có ở đây; không có mục nào cho việc ghi đè."
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
      </Field>
    </SettingsTab>
  );
}
