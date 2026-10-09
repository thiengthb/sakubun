const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const APP_TIME_ZONE = 'Asia/Ho_Chi_Minh';

export function formatDateTimeVN(value: Date | string | number): string {
  return new Date(value).toLocaleString('vi-VN', { timeZone: APP_TIME_ZONE });
}

export function formatDateVN(value: Date | string | number): string {
  return new Date(value).toLocaleDateString('vi-VN', { timeZone: APP_TIME_ZONE });
}

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

export function humanizeAgo(past: Date, now: Date = new Date()): string {
  const diff = now.getTime() - past.getTime();
  if (diff < MINUTE) return `${Math.max(1, Math.round(diff / 1000))} giây trước`;
  if (diff < HOUR) return `${Math.round(diff / MINUTE)} phút trước`;
  if (diff < DAY) return `${Math.round(diff / HOUR)} giờ trước`;
  if (diff < 30 * DAY) return `${Math.round(diff / DAY)} ngày trước`;
  if (diff < 365 * DAY) return `${Math.round(diff / (30 * DAY))} tháng trước`;
  return `${(diff / (365 * DAY)).toFixed(1)} năm trước`;
}

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

export type DatePreset = 'all' | 'today' | '7d' | '30d';

export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'all', label: 'Mọi lúc' },
  { value: 'today', label: 'Hôm nay' },
  { value: '7d', label: '7 ngày qua' },
  { value: '30d', label: '30 ngày qua' },
];

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

export const LENGTH_BUCKETS = [
  { key: 'short', label: 'Ngắn', max: 20 },
  { key: 'medium', label: 'Vừa', max: 45 },
  { key: 'long', label: 'Dài', max: 80 },
  { key: 'xlong', label: 'Rất dài', max: Infinity },
] as const;

export type LengthBucketKey = (typeof LENGTH_BUCKETS)[number]['key'];

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

export function speakable(expression: string): string {
  return expression.replace(/[〜～]/g, '').trim();
}
