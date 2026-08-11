'use client';

import { Layers, List } from 'lucide-react';
import { ExpandingIconButton } from '@/components/shared/expanding-icon-button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { FilterPopover, FilterRow } from '@/components/shared/filter-popover';
import { SearchInput } from '@/components/shared/search-input';
import { EXERCISE_TYPE_LABELS, durationSecOf } from '@/components/history/history-cards';
import { DATE_PRESETS, LENGTH_BUCKETS, withinDatePreset, type DatePreset } from '@/lib/format';
import { JLPT_LEVELS } from '@/lib/settings-schema';
import type { SentenceHistoryRow } from '@/lib/practice';

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

/** How many filters are narrowed from their default — shown as a badge on the "Bộ lọc" button. */
export function activeFilterCount(f: Filters): number {
  let n = 0;
  if (f.direction !== 'all') n++;
  if (f.result !== 'all') n++;
  if (f.type !== 'all') n++;
  if (f.status !== 'all') n++;
  if (f.level !== 'all') n++;
  if (f.length !== 'all') n++;
  if (f.duration !== 'all') n++;
  if (f.datePreset !== 'all') n++;
  if (f.starred !== 'all') n++;
  if (f.scoreMin > 0 || f.scoreMax < 100) n++;
  return n;
}

/** A sentence "passed" when every graded pattern was Good/Easy; "failed" if any was Again/Hard. */
export function isFail(s: SentenceHistoryRow): boolean {
  return s.ratings.some((r) => r.rating <= 2);
}

// History filters on when the sentence was ANSWERED (falling back to when it was staged); the window
// math itself is the shared `withinDatePreset` (lib/format), so the two date-filter surfaces agree.
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

/**
 * Nút lật giữa danh sách và flashcard.
 *
 * Tách khỏi hàng tìm kiếm 2026-08-11: ở chế độ flashcard hàng tìm kiếm không còn (gõ tìm một chuỗi
 * trong khi đang lướt thẻ là việc không ai làm), nên nút này xuống hàng công cụ của deck và đứng cạnh
 * nút cài đặt deck. Cùng một nút ở hai chỗ đặt — nên nó là một component, không phải hai bản sao.
 */
export function HistoryModeToggle({
  mode,
  onModeChange,
}: {
  /** Read the history as a list, or flip through it one card at a time. */
  mode: 'list' | 'card';
  onModeChange: (mode: 'list' | 'card') => void;
}) {
  return (
    // Nhãn nói việc lần bấm TỚI làm, không nói chế độ đang ở.
    <ExpandingIconButton
      icon={mode === 'list' ? Layers : List}
      label={mode === 'list' ? 'Flashcard' : 'Danh sách'}
      aria-pressed={mode === 'card'}
      onClick={() => onModeChange(mode === 'list' ? 'card' : 'list')}
    />
  );
}

/**
 * Popover bộ lọc đầy đủ. CHỈ có ở chế độ danh sách.
 *
 * Nó từng có mặt ở cả chế độ flashcard (thanh công cụ của deck), bỏ 2026-08-11 theo yêu cầu của chủ
 * repo. Điều đó KHÔNG làm chồng thẻ mất bộ lọc: deck luôn được chia từ `filtered`, nên bộ lọc đặt ở
 * danh sách vẫn còn hiệu lực khi lật sang thẻ — chỉ là muốn ĐỔI thì lật về danh sách.
 */
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
      <FilterRow label="Chiều dịch">
        <Select value={filters.direction} onValueChange={(v) => onPatch({ direction: v })}>
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="all">Mọi chiều</SelectItem>
            <SelectItem value="JA_VI">JP → VN</SelectItem>
            <SelectItem value="VI_JA">VN → JP</SelectItem>
          </SelectContent>
        </Select>
      </FilterRow>

      <FilterRow label="Kết quả">
        <Select value={filters.result} onValueChange={(v) => onPatch({ result: v })}>
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="all">Mọi kết quả</SelectItem>
            <SelectItem value="pass">Đạt (Good/Easy)</SelectItem>
            <SelectItem value="fail">Có lỗi (Again/Hard)</SelectItem>
          </SelectContent>
        </Select>
      </FilterRow>

      <FilterRow label="Dạng bài">
        <Select value={filters.type} onValueChange={(v) => onPatch({ type: v })}>
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="all">Mọi dạng</SelectItem>
            {Object.entries(EXERCISE_TYPE_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterRow>

      <FilterRow label="Trạng thái">
        <Select value={filters.status} onValueChange={(v) => onPatch({ status: v })}>
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="all">Mọi trạng thái</SelectItem>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterRow>

      <FilterRow label="Độ khó (JLPT)">
        <Select value={filters.level} onValueChange={(v) => onPatch({ level: v })}>
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="all">Mọi cấp</SelectItem>
            {JLPT_LEVELS.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterRow>

      <FilterRow label="Độ dài">
        <Select value={filters.length} onValueChange={(v) => onPatch({ length: v })}>
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="all">Mọi độ dài</SelectItem>
            {LENGTH_BUCKETS.map((b) => (
              <SelectItem key={b.key} value={b.key}>
                {b.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterRow>

      <FilterRow label="Thời gian làm">
        <Select value={filters.duration} onValueChange={(v) => onPatch({ duration: v })}>
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="all">Mọi mức</SelectItem>
            {DURATION_BUCKETS.map((b) => (
              <SelectItem key={b.value} value={b.value}>
                {b.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterRow>

      <FilterRow label="Ngày làm">
        <Select value={filters.datePreset} onValueChange={(v) => onPatch({ datePreset: v })}>
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            {DATE_PRESETS.map((d) => (
              <SelectItem key={d.value} value={d.value}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterRow>

      <FilterRow label="Đánh dấu sao">
        <Select value={filters.starred} onValueChange={(v) => onPatch({ starred: v })}>
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="yes">Đã đánh dấu sao</SelectItem>
          </SelectContent>
        </Select>
      </FilterRow>

      <div className="col-span-2">
        <FilterRow label={`Điểm số: ${filters.scoreMin}–${filters.scoreMax}`}>
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
      </div>
    </FilterPopover>
  );
}

/**
 * Hàng tìm kiếm của /history: ô tìm + nút lật chế độ + bộ lọc.
 *
 * CHỈ có ở chế độ danh sách. Ở chế độ flashcard, `HistoryList` không render hàng này nữa — thanh tiến
 * độ của deck lên chiếm đúng hàng đó, và hai nút chuyển xuống thanh công cụ của deck.
 */
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
    // One row at EVERY width (it used to stack below sm). The toolbar rule for this app is that the
    // actions share the search box's row — a phone has vertical space to spare only in theory, and the
    // buttons are icon-only below md, so the row costs ~76px and gives back a whole stacked row.
    <div className="flex flex-row items-center gap-2 sm:gap-3">
      <SearchInput
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Tìm trong đề / bài dịch…"
        // Capped at max-w-xs from sm up, exactly like the DataTable toolbar: a full-width search box
        // leaves the two controls stuck to its right edge, mid-row. Capped, they sit at the FAR right
        // (`md:ml-auto` below) and this toolbar matches the resources one.
        className="min-w-0 flex-1 sm:max-w-xs"
      />
      <div className="flex shrink-0 items-center gap-2 md:ml-auto">
        <HistoryModeToggle mode={mode} onModeChange={onModeChange} />
        <HistoryFilterPopover filters={filters} onPatch={onPatch} onResetFilters={onResetFilters} />
      </div>
    </div>
  );
}
