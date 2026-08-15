'use client';

import { Layers, List } from 'lucide-react';
import { ExpandingIconButton } from '@/components/common/expanding-icon-button';
import { Slider } from '@/components/ui/slider';
import {
  chipFor,
  FilterChips,
  FilterPopover,
  FilterRow,
  SelectFilterRow,
  type FilterChip,
  type FilterOption,
} from '@/components/common/filter-popover';
import { SearchInput } from '@/components/common/search-input';
import { EXERCISE_TYPE_LABELS, durationSecOf } from '@/components/features/history/history-cards';
import { DATE_PRESETS, LENGTH_BUCKETS, withinDatePreset, type DatePreset } from '@/lib/core/format';
import { JLPT_LEVELS } from '@/lib/settings/schema';
import type { SentenceHistoryRow } from '@/lib/library/practice';

const STATUS_LABELS: Record<string, string> = {
  GRADED: 'Đã chấm',
  SKIPPED: 'Bỏ qua',
  PENDING: 'Đang chờ',
};

const DURATION_BUCKETS = [
  { value: 'fast', label: 'Nhanh (<30 giây)', max: 30 },
  { value: 'medium', label: 'Vừa (30 giây–2 phút)', max: 120 },
  { value: 'slow', label: 'Chậm (>2 phút)', max: Infinity },
] as const;

export interface Filters {
  direction: string;
  result: string;
  type: string;
  status: string;
  level: string;
  length: string;
  duration: string;
  datePreset: string;
  starred: string;
  scoreMin: number;
  scoreMax: number;
}

export const DEFAULT_FILTERS: Filters = {
  direction: 'all',
  result: 'all',
  type: 'all',
  status: 'all',
  level: 'all',
  length: 'all',
  duration: 'all',
  datePreset: 'all',
  starred: 'all',
  scoreMin: 0,
  scoreMax: 100,
};

type SelectKey = Exclude<keyof Filters, 'scoreMin' | 'scoreMax'>;

// Nine filters that differ only in label and options. As a table they stay one screenful, and the
// count, the popover rows and the chips below it all read from this one list — so a tenth filter
// cannot show up in the popover while silently missing from the chips.
const SELECT_FILTERS: readonly { key: SelectKey; label: string; options: readonly FilterOption[] }[] =
  [
    {
      key: 'direction',
      label: 'Chiều dịch',
      options: [
        { value: 'all', label: 'Mọi chiều' },
        { value: 'JA_VI', label: 'JP → VN' },
        { value: 'VI_JA', label: 'VN → JP' },
      ],
    },
    {
      key: 'result',
      label: 'Kết quả',
      options: [
        { value: 'all', label: 'Mọi kết quả' },
        { value: 'pass', label: 'Đạt (Good/Easy)' },
        { value: 'fail', label: 'Có lỗi (Again/Hard)' },
      ],
    },
    {
      key: 'type',
      label: 'Dạng bài',
      options: [
        { value: 'all', label: 'Mọi dạng' },
        ...Object.entries(EXERCISE_TYPE_LABELS).map(([value, label]) => ({ value, label })),
      ],
    },
    {
      key: 'status',
      label: 'Trạng thái',
      options: [
        { value: 'all', label: 'Mọi trạng thái' },
        ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
      ],
    },
    {
      key: 'level',
      label: 'Độ khó (JLPT)',
      options: [
        { value: 'all', label: 'Mọi cấp' },
        ...JLPT_LEVELS.map((l) => ({ value: l, label: l })),
      ],
    },
    {
      key: 'length',
      label: 'Độ dài',
      options: [
        { value: 'all', label: 'Mọi độ dài' },
        ...LENGTH_BUCKETS.map((b) => ({ value: b.key, label: b.label })),
      ],
    },
    {
      key: 'duration',
      label: 'Thời gian làm',
      options: [
        { value: 'all', label: 'Mọi mức' },
        ...DURATION_BUCKETS.map((b) => ({ value: b.value, label: b.label })),
      ],
    },
    { key: 'datePreset', label: 'Ngày làm', options: DATE_PRESETS },
    {
      key: 'starred',
      label: 'Đánh dấu sao',
      options: [
        { value: 'all', label: 'Tất cả' },
        { value: 'yes', label: 'Đã đánh dấu sao' },
      ],
    },
  ];

function scoreNarrowed(f: Filters): boolean {
  return f.scoreMin > 0 || f.scoreMax < 100;
}

function activeFilterCount(f: Filters): number {
  return SELECT_FILTERS.filter((s) => f[s.key] !== 'all').length + (scoreNarrowed(f) ? 1 : 0);
}

function historyChips(f: Filters, onPatch: (patch: Partial<Filters>) => void): FilterChip[] {
  const chips = SELECT_FILTERS.map((s) =>
    chipFor(s.key, s.label, f[s.key], s.options, () =>
      onPatch({ [s.key]: 'all' } as Partial<Filters>),
    ),
  ).filter((c) => c !== null);
  if (scoreNarrowed(f)) {
    chips.push({
      key: 'score',
      label: 'Điểm số',
      value: `${f.scoreMin}–${f.scoreMax}`,
      onClear: () => onPatch({ scoreMin: 0, scoreMax: 100 }),
    });
  }
  return chips;
}

export function isFail(s: SentenceHistoryRow): boolean {
  return s.ratings.some((r) => r.rating <= 2);
}

export function inDatePreset(s: SentenceHistoryRow, preset: string): boolean {
  return withinDatePreset(s.answeredAt ?? s.createdAt, preset as DatePreset);
}

export function inDurationBucket(s: SentenceHistoryRow, bucket: string): boolean {
  if (bucket === 'all') return true;
  const d = durationSecOf(s);
  if (d == null) return false;
  if (bucket === 'fast') return d < 30;
  if (bucket === 'medium') return d >= 30 && d <= 120;
  if (bucket === 'slow') return d > 120;
  return true;
}

export function HistoryModeToggle({
  mode,
  onModeChange,
}: {
  mode: 'list' | 'card';
  onModeChange: (mode: 'list' | 'card') => void;
}) {
  return (
    <ExpandingIconButton
      icon={mode === 'list' ? Layers : List}
      label={mode === 'list' ? 'Flashcard' : 'Danh sách'}
      aria-pressed={mode === 'card'}
      onClick={() => onModeChange(mode === 'list' ? 'card' : 'list')}
    />
  );
}

function HistoryFilterPopover({
  filters,
  onPatch,
  onResetFilters,
}: {
  filters: Filters;
  onPatch: (patch: Partial<Filters>) => void;
  onResetFilters: () => void;
}) {
  const activeCount = activeFilterCount(filters);

  return (
    <FilterPopover activeCount={activeCount} align="end" onReset={onResetFilters}>
      {SELECT_FILTERS.map((f) => (
        <SelectFilterRow
          key={f.key}
          label={f.label}
          value={filters[f.key]}
          onValueChange={(v) => onPatch({ [f.key]: v } as Partial<Filters>)}
          options={f.options}
        />
      ))}

      <FilterRow
        className="col-span-2"
        label={`Điểm số: ${filters.scoreMin}–${filters.scoreMax}`}
      >
        <div className="flex h-8 items-center px-1">
          <Slider
            thumbLabel={['Điểm số tối thiểu', 'Điểm số tối đa']}
            min={0}
            max={100}
            step={5}
            value={[filters.scoreMin, filters.scoreMax]}
            onValueChange={([lo, hi]) => onPatch({ scoreMin: lo, scoreMax: hi })}
          />
        </div>
      </FilterRow>
    </FilterPopover>
  );
}

export function HistoryFilters({
  search,
  onSearchChange,
  filters,
  onPatch,
  onResetFilters,
  mode,
  onModeChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  filters: Filters;
  onPatch: (patch: Partial<Filters>) => void;
  onResetFilters: () => void;
  mode: 'list' | 'card';
  onModeChange: (mode: 'list' | 'card') => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-row items-center gap-2 sm:gap-3">
        <SearchInput
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Tìm trong đề / bài dịch…"
          className="min-w-0 flex-1 sm:max-w-xs"
        />
        <div className="flex shrink-0 items-center gap-2 md:ml-auto">
          <HistoryModeToggle mode={mode} onModeChange={onModeChange} />
          <HistoryFilterPopover
            filters={filters}
            onPatch={onPatch}
            onResetFilters={onResetFilters}
          />
        </div>
      </div>
      <FilterChips chips={historyChips(filters, onPatch)} onReset={onResetFilters} />
    </div>
  );
}
