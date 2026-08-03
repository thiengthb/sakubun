// Vietnamese human-friendly time formatting for tutor output ("3 ngày nữa", "10 phút nữa").

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// The app is single-user and Vietnam-based, so every displayed timestamp is pinned to this zone —
// a `vi-VN` locale sets the LANGUAGE, not the timezone, so without this a browser/OS set to another
// zone would show shifted times (and SSR↔client would disagree). Server + client both format in +07.
export const APP_TIME_ZONE = 'Asia/Ho_Chi_Minh';

/** Date + time in Vietnam time, e.g. "10:35:55 18/7/2026". */
export function formatDateTimeVN(value: Date | string | number): string {
  return new Date(value).toLocaleString('vi-VN', { timeZone: APP_TIME_ZONE });
}

/** Date only in Vietnam time, e.g. "18/7/2026". */
export function formatDateVN(value: Date | string | number): string {
  return new Date(value).toLocaleDateString('vi-VN', { timeZone: APP_TIME_ZONE });
}

/** "x phút/giờ/ngày/tháng nữa" relative to now; past dues read as "đến hạn rồi". */
export function humanizeUntil(due: Date, now: Date = new Date()): string {
  const diff = due.getTime() - now.getTime();
  if (diff <= 0) return 'đến hạn rồi';
  if (diff < MINUTE) return 'dưới 1 phút nữa';
  if (diff < HOUR) return `${Math.round(diff / MINUTE)} phút nữa`;
  if (diff < DAY) return `${Math.round(diff / HOUR)} giờ nữa`;
  if (diff < 30 * DAY) return `${Math.round(diff / DAY)} ngày nữa`;
  if (diff < 365 * DAY) return `${Math.round(diff / (30 * DAY))} tháng nữa`;
  return `${(diff / (365 * DAY)).toFixed(1)} năm nữa`;
}

/** "x giây/phút/giờ/ngày/tháng/năm trước" relative to now (sub-minute reads in whole seconds, min 1). */
export function humanizeAgo(past: Date, now: Date = new Date()): string {
  const diff = now.getTime() - past.getTime();
  if (diff < MINUTE) return `${Math.max(1, Math.round(diff / 1000))} giây trước`;
  if (diff < HOUR) return `${Math.round(diff / MINUTE)} phút trước`;
  if (diff < DAY) return `${Math.round(diff / HOUR)} giờ trước`;
  if (diff < 30 * DAY) return `${Math.round(diff / DAY)} ngày trước`;
  if (diff < 365 * DAY) return `${Math.round(diff / (30 * DAY))} tháng trước`;
  return `${(diff / (365 * DAY)).toFixed(1)} năm trước`;
}

/** Exact due time "HH:MM DD/MM/YY" in Vietnam time — for when the precise moment (esp. within a day) matters. */
export function formatDueExact(due: Date): string {
  const parts = new Intl.DateTimeFormat('vi-VN', {
    timeZone: APP_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour12: false,
  }).formatToParts(due);
  const g = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${g('hour')}:${g('minute')} ${g('day')}/${g('month')}/${g('year')}`;
}

/** A whole-second duration in Vietnamese: "42 giây" · "1 phút 20 giây" · "2 phút" · "1 giờ 5 phút". */
export function humanizeDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} giây`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return rem ? `${m} phút ${rem} giây` : `${m} phút`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm ? `${h} giờ ${mm} phút` : `${h} giờ`;
}

// "Ngày thêm" presets — a shared taxonomy for the resources tables' date filter (grammar + vocab), so
// the option list + the cutoff logic live in one place. `withinDatePreset` compares a row's timestamp
// against the preset. (The history tab keeps its own preset helper because it filters on answeredAt.)
export type DatePreset = 'all' | 'today' | '7d' | '30d';

export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'all', label: 'Mọi lúc' },
  { value: 'today', label: 'Hôm nay' },
  { value: '7d', label: '7 ngày qua' },
  { value: '30d', label: '30 ngày qua' },
];

/** True if `value`'s timestamp falls inside the preset window ("all" always passes). */
export function withinDatePreset(value: Date | string | number, preset: DatePreset): boolean {
  if (preset === 'all') return true;
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return false;
  const now = Date.now();
  const day = 86_400_000;
  if (preset === 'today') {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return t >= start.getTime();
  }
  if (preset === '7d') return t >= now - 7 * day;
  if (preset === '30d') return t >= now - 30 * day;
  return true;
}

// Sentence-length buckets by SOURCE character count — one shared taxonomy so the history card's
// "độ dài" label and the analytics "theo độ dài" breakdown always agree. Thresholds are inclusive
// upper bounds; the last bucket catches everything above.
export const LENGTH_BUCKETS = [
  { key: 'short', label: 'Ngắn', max: 20 },
  { key: 'medium', label: 'Vừa', max: 45 },
  { key: 'long', label: 'Dài', max: 80 },
  { key: 'xlong', label: 'Rất dài', max: Infinity },
] as const;

export type LengthBucketKey = (typeof LENGTH_BUCKETS)[number]['key'];

/** Classify a source-sentence length (char count) into a shared bucket (key + label + sort order). */
export function lengthBucket(charCount: number): {
  key: LengthBucketKey;
  label: string;
  order: number;
} {
  const found = LENGTH_BUCKETS.findIndex((b) => charCount <= b.max);
  const order = found === -1 ? LENGTH_BUCKETS.length - 1 : found;
  const bucket = LENGTH_BUCKETS[order];
  return { key: bucket.key, label: bucket.label, order };
}

const RATING_DISPLAY: Record<number, string> = {
  1: 'Again',
  2: 'Hard',
  3: 'Good',
  4: 'Easy',
};

export function ratingLabel(rating: number): string {
  return RATING_DISPLAY[rating] ?? String(rating);
}

/** Clean a term for TTS — drop the 〜/～ grammar-slot placeholder so the voice reads the form only. */
export function speakable(expression: string): string {
  return expression.replace(/[〜～]/g, '').trim();
}
