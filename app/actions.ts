'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { parseMaziiExcel } from '@/lib/excel-import';
import type { ParseResult } from '@/lib/import-parse';
import {
  addItems,
  deleteItem,
  deleteItems,
  getStreak,
  saveSettings,
  setItemStarred,
  setItemSuspended,
  setItemsSuspended,
  setSentenceStarred,
  skipSentence,
  updateItem,
  VOCAB_KIND,
} from '@/lib/practice';
import { JLPT_LEVELS, settingsPatchSchema, type Settings } from '@/lib/settings-schema';
import { getSessionUserId } from '@/lib/current-user';
import { type ActionResult, cleanIds, err, ok, parseInput } from '@/lib/action-result';

// Re-exported so existing importers (`@/app/actions`) and client components keep one import site.
export type { ActionResult } from '@/lib/action-result';

// The resources tables + the dashboard both read item data, so a write to either revalidates both.
// Kept local (not in lib/action-result) because it needs next/cache and the path set is app-specific.
function revalidateResources(): void {
  revalidatePath('/resources');
  revalidatePath('/');
}

export async function saveSettingsAction(patch: unknown): Promise<ActionResult<Settings>> {
  // Auth gate: a Server Action is a public HTTP endpoint — bounce if not signed in.
  await getSessionUserId();
  const parsed = parseInput(settingsPatchSchema, patch);
  if (!parsed.ok) return parsed;
  const settings = await saveSettings(parsed.data);
  // Deliberately NO revalidatePath here. In Next 16 ANY revalidatePath/refresh in an action re-renders
  // the CURRENT route server-side in the same response (docs: guides/server-actions.md) — even
  // revalidatePath('/'), not just '/settings'. That mid-save re-render of the open form is what reverted
  // the just-edited values and left Save stuck enabled. Both this page and the dashboard are
  // `force-dynamic` (refetched on every navigation), so revalidation buys nothing here; the client
  // already holds the saved values in state (settings-form adopts the returned `data` as its baseline).
  return ok(settings);
}

const importEntrySchema = z.object({
  expression: z.string().min(1),
  reading: z.string().optional(),
  meaningVi: z.string().min(1),
  level: z.enum(JLPT_LEVELS).optional(),
  notes: z.string().optional(),
});

export interface ImportSummary {
  created: number;
  skipped: { expression: string; reason: string }[];
}

// The two resource stores share one writer (addItems) — the client passes which store it is adding to.
// `undefined` (or 'grammar') falls through to addItems' GRAMMAR_KIND default; only VOCAB is remapped.
const resourceKindSchema = z.enum(['grammar', 'vocab']).optional();
type ResourceKind = z.infer<typeof resourceKindSchema>;
const resolveKind = (kind: ResourceKind): string | undefined =>
  kind === 'vocab' ? VOCAB_KIND : undefined;

// 10 MB cap — a Mazii export is a few hundred KB; anything bigger is the wrong file.
const MAX_EXCEL_BYTES = 10 * 1024 * 1024;

export async function parseExcelAction(formData: FormData): Promise<ActionResult<ParseResult>> {
  // Auth gate: a Server Action is a public HTTP endpoint — bounce if not signed in.
  await getSessionUserId();
  const file = formData.get('file');
  if (!(file instanceof File)) return err('Chưa chọn file');
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return err('Chỉ hỗ trợ file .xlsx (Excel tải từ Mazii)');
  }
  if (file.size > MAX_EXCEL_BYTES) return err('File quá lớn (>10MB)');
  try {
    const result = await parseMaziiExcel(await file.arrayBuffer());
    if (result.entries.length === 0 && result.errors.length === 0) {
      return err('Không đọc được dòng nào từ file');
    }
    return ok(result);
  } catch {
    return err('File không đọc được — có đúng là .xlsx không?');
  }
}

// Bulk import (paste-list / Excel) into either store — the "Dán danh sách" and "Nhập Excel" tabs of the
// resource-add dialog. `kind` selects grammar (default) vs vocab; source 'MAZII' marks a bulk import.
export async function importItemsAction(
  entries: unknown,
  kind?: ResourceKind,
): Promise<ActionResult<ImportSummary>> {
  // Auth gate: a Server Action is a public HTTP endpoint — bounce if not signed in.
  await getSessionUserId();
  const kindParsed = parseInput(resourceKindSchema, kind, 'Loại tài nguyên không hợp lệ');
  if (!kindParsed.ok) return kindParsed;
  const parsed = parseInput(
    z.array(importEntrySchema).min(1).max(2000),
    entries,
    'Danh sách nhập không hợp lệ',
  );
  if (!parsed.ok) return parsed;

  const r = await addItems(
    parsed.data,
    'MAZII',
    resolveKind(kindParsed.data),
  );
  revalidateResources();
  return ok({ created: r.created, skipped: r.skipped });
}

// Manually add ONE item from the web UI — the "Theo trường" tab, for grammar OR vocab (the MCP
// `add_vocab` tool is the other vocab path). Rides the same addItems writer with source=WEB; VOCAB
// lands on the separate vocab FSRS budget, GRAMMAR on the core loop.
const addOneItemSchema = z.object({
  expression: z.string().trim().min(1, 'Nội dung không được trống'),
  reading: z.string().trim().optional(),
  meaningVi: z.string().trim().min(1, 'Nghĩa không được trống'),
  level: z.enum(JLPT_LEVELS).optional(),
  notes: z.string().trim().optional(),
});

export async function addOneItemAction(
  input: unknown,
  kind?: ResourceKind,
): Promise<ActionResult<{ created: number }>> {
  // Auth gate: a Server Action is a public HTTP endpoint — bounce if not signed in.
  await getSessionUserId();
  const kindParsed = parseInput(resourceKindSchema, kind, 'Loại tài nguyên không hợp lệ');
  if (!kindParsed.ok) return kindParsed;
  const parsed = parseInput(addOneItemSchema, input);
  if (!parsed.ok) return parsed;
  const r = await addItems(
    [parsed.data],
    'WEB',
    resolveKind(kindParsed.data),
  );
  if (r.created === 0) return err(r.skipped[0]?.reason ?? 'Đã có trong kho');
  revalidateResources();
  return ok({ created: r.created });
}

export async function setItemSuspendedAction(
  itemId: string,
  suspended: boolean,
): Promise<ActionResult> {
  // Auth gate: a Server Action is a public HTTP endpoint — bounce if not signed in.
  await getSessionUserId();
  if (!itemId) return err('Thiếu itemId');
  await setItemSuspended(itemId, suspended);
  revalidateResources();
  return ok(undefined);
}

/** Bulk suspend/resume selected items (resources DataTable row-selection → "Tạm ngưng"). */
export async function setItemsSuspendedAction(
  ids: string[],
  suspended: boolean,
): Promise<ActionResult<{ affected: number }>> {
  // Auth gate: a Server Action is a public HTTP endpoint — bounce if not signed in.
  await getSessionUserId();
  const clean = cleanIds(ids);
  if (clean.length === 0) return err('Chưa chọn mục nào');
  let affected: number;
  try {
    ({ affected } = await setItemsSuspended(clean, suspended));
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Không cập nhật được');
  }
  revalidateResources();
  return ok({ affected });
}

/** Toggle a favourite star on an item (grammar/vocab) — resources tables + item detail page. */
export async function setItemStarredAction(
  itemId: string,
  starred: boolean,
): Promise<ActionResult> {
  // Auth gate: a Server Action is a public HTTP endpoint — bounce if not signed in.
  await getSessionUserId();
  if (!itemId) return err('Thiếu itemId');
  await setItemStarred(itemId, starred);
  revalidatePath('/resources');
  revalidatePath(`/resources/${itemId}`);
  return ok(undefined);
}

/** Toggle a favourite star on a practiced sentence (history card). */
export async function setSentenceStarredAction(
  sentenceId: string,
  starred: boolean,
): Promise<ActionResult> {
  // Auth gate: a Server Action is a public HTTP endpoint — bounce if not signed in.
  await getSessionUserId();
  if (!sentenceId) return err('Thiếu sentenceId');
  await setSentenceStarred(sentenceId, starred);
  revalidatePath('/history');
  return ok(undefined);
}

// Content-only edit — NO FSRS field is accepted here (the schedule is off-limits from the UI).
const updateItemSchema = z.object({
  expression: z.string().trim().min(1, 'Từ / mẫu không được trống'),
  reading: z.string().trim().nullable().optional(),
  meaningVi: z.string().trim().min(1, 'Nghĩa không được trống'),
  notes: z.string().trim().nullable().optional(),
  level: z.enum(JLPT_LEVELS).optional(),
});

export async function updateItemAction(itemId: string, input: unknown): Promise<ActionResult> {
  // Auth gate: a Server Action is a public HTTP endpoint — bounce if not signed in.
  await getSessionUserId();
  if (!itemId) return err('Thiếu itemId');
  const parsed = parseInput(updateItemSchema, input);
  if (!parsed.ok) return parsed;
  try {
    await updateItem(itemId, {
      ...parsed.data,
      reading: parsed.data.reading?.trim() || null,
      notes: parsed.data.notes?.trim() || null,
    });
  } catch (e) {
    // P2002 = the new expression collides with another item of the same kind.
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') {
      return err('Đã có mục khác trùng nội dung này');
    }
    return err(e instanceof Error ? e.message : 'Không lưu được');
  }
  revalidateResources();
  return ok(undefined);
}

export async function deleteItemAction(itemId: string): Promise<ActionResult> {
  // Auth gate: a Server Action is a public HTTP endpoint — bounce if not signed in.
  await getSessionUserId();
  if (!itemId) return err('Thiếu itemId');
  try {
    await deleteItem(itemId);
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Không xóa được');
  }
  revalidateResources();
  return ok(undefined);
}

/** Bulk-delete selected items (resources DataTable row selection → "Xóa"). Preserves each item's
 *  ReviewLog (server SET-NULLs the log's itemId), same as the single-row delete. */
export async function deleteItemsAction(ids: string[]): Promise<ActionResult<{ deleted: number }>> {
  // Auth gate: a Server Action is a public HTTP endpoint — bounce if not signed in.
  await getSessionUserId();
  const clean = cleanIds(ids);
  if (clean.length === 0) return err('Chưa chọn mục nào');
  let deleted: number;
  try {
    ({ deleted } = await deleteItems(clean));
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Không xóa được');
  }
  revalidateResources();
  return ok({ deleted });
}

/** Skip a pending sentence — kept in history with its reference, but NOT counted by FSRS (the
 *  history pending-card "Bỏ qua" action). */
export async function skipSentenceAction(
  sentenceId: string,
): Promise<ActionResult<{ skipped: number }>> {
  // Auth gate: a Server Action is a public HTTP endpoint — bounce if not signed in.
  await getSessionUserId();
  if (!sentenceId) return err('Thiếu sentenceId');
  try {
    const result = await skipSentence(sentenceId);
    revalidatePath('/history');
    revalidatePath('/');
    return ok(result);
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Không xử lý được');
  }
}

/** Current study-day streak — polled by the app-wide streak celebration beacon (StreakBeacon). */
export async function getStreakAction(): Promise<ActionResult<{ current: number }>> {
  // Auth gate: a Server Action is a public HTTP endpoint — bounce if not signed in.
  await getSessionUserId();
  const { current } = await getStreak();
  return ok({ current });
}

// ---------------- notifications ----------------

