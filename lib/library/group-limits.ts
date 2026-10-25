// thien, 2026-10-25: a group's name and note stay short enough for its card, which keeps two lines
// for each. 40 characters is two lines of the name beside its icon and buttons on a 390px phone
// (about 34 a line) and one line on a laptop card; 80 is two lines of the note on that phone
// (about 45 a line). Pure: no Prisma, no I/O.
export const GROUP_NAME_MAX = 40;
export const GROUP_NOTE_MAX = 80;

/** Characters as a reader counts them: one per letter, Vietnamese tone marks included. */
export function textLength(s: string): number {
  return Array.from(s.normalize('NFC')).length;
}

/**
 * The error under a field over its limit. The label sits right above it, so it says only the limit
 * and the count (thien, 2026-10-25: the main point, short but enough).
 */
export function tooLongError(s: string | null | undefined, max: number): string | null {
  if (!s) return null;
  const n = textLength(s.trim());
  return n > max ? `Tối đa ${max} ký tự, đang có ${n}.` : null;
}

/** A short error naming the fix, or null when the text fits. */
export function groupTextError(
  field: 'name' | 'note',
  s: string | null | undefined,
): string | null {
  if (!s) return null;
  const max = field === 'name' ? GROUP_NAME_MAX : GROUP_NOTE_MAX;
  const n = textLength(s.trim());
  if (n <= max) return null;
  return `${field === 'name' ? 'Tên nhóm' : 'Ghi chú'} tối đa ${max} ký tự, đang có ${n}.`;
}
