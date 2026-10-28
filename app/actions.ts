'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { parseMaziiExcel } from '@/lib/transfer/excel';
import type { ParseResult } from '@/lib/transfer/parse';
import {
  addItems,
  deleteItem,
  deleteItems,
  getSettings,
  saveSettings,
  setItemStarred,
  setItemSuspended,
  setItemsSuspended,
  setSentenceStarred,
  updateItem,
  VOCAB_KIND,
} from '@/lib/library/practice';
import { getStreak } from '@/lib/insights/streak';
import {
  JLPT_LEVELS,
  settingsPatchSchema,
  withAppFurigana,
  type Settings,
} from '@/lib/settings/schema';
import { getSessionUserId, getUserDb } from '@/lib/auth/current-user';
import {
  GROUP_KINDS,
  addItemsToGroup,
  createGroup,
  deleteGroup,
  removeItemsFromGroup,
  updateGroup,
} from '@/lib/library/groups';
import { GROUP_NAME_MAX, GROUP_NOTE_MAX, groupTextError } from '@/lib/library/group-limits';
import { type ActionResult, cleanIds, err, ok, parseInput } from '@/lib/core/action-result';

function revalidateResources(): void {
  revalidatePath('/resources');
  revalidatePath('/');
}

export async function saveSettingsAction(patch: unknown): Promise<ActionResult<Settings>> {
  const db = await getUserDb();
  const parsed = parseInput(settingsPatchSchema, patch);
  if (!parsed.ok) return parsed;
  const settings = await saveSettings(db, parsed.data);
  return ok(settings);
}

// The sidebar's あ: furigana in the app on or off, for every page and device (7.4a).
export async function setAppFuriganaAction(on: unknown): Promise<ActionResult> {
  const parsed = parseInput(z.boolean(), on);
  if (!parsed.ok) return parsed;
  const db = await getUserDb();
  const { furiganaMode } = await getSettings(db);
  await saveSettings(db, { furiganaMode: withAppFurigana(furiganaMode, parsed.data) });
  return ok(undefined);
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

const resourceKindSchema = z.enum(['grammar', 'vocab']).optional();
type ResourceKind = z.infer<typeof resourceKindSchema>;
const resolveKind = (kind: ResourceKind): string | undefined =>
  kind === 'vocab' ? VOCAB_KIND : undefined;

const MAX_EXCEL_BYTES = 10 * 1024 * 1024;

export async function parseExcelAction(formData: FormData): Promise<ActionResult<ParseResult>> {
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

export async function importItemsAction(
  entries: unknown,
  kind?: ResourceKind,
): Promise<ActionResult<ImportSummary>> {
  const db = await getUserDb();
  const kindParsed = parseInput(resourceKindSchema, kind, 'Loại tài nguyên không hợp lệ');
  if (!kindParsed.ok) return kindParsed;
  const parsed = parseInput(
    z.array(importEntrySchema).min(1).max(2000),
    entries,
    'Danh sách nhập không hợp lệ',
  );
  if (!parsed.ok) return parsed;

  const r = await addItems(db, parsed.data, 'MAZII', resolveKind(kindParsed.data));
  revalidateResources();
  return ok({ created: r.created, skipped: r.skipped });
}

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
  const db = await getUserDb();
  const kindParsed = parseInput(resourceKindSchema, kind, 'Loại tài nguyên không hợp lệ');
  if (!kindParsed.ok) return kindParsed;
  const parsed = parseInput(addOneItemSchema, input);
  if (!parsed.ok) return parsed;
  const r = await addItems(db, [parsed.data], 'WEB', resolveKind(kindParsed.data));
  if (r.created === 0) return err(r.skipped[0]?.reason ?? 'Đã có trong kho');
  revalidateResources();
  return ok({ created: r.created });
}

export async function setItemSuspendedAction(
  itemId: string,
  suspended: boolean,
): Promise<ActionResult> {
  const db = await getUserDb();
  if (!itemId) return err('Thiếu itemId');
  await setItemSuspended(db, itemId, suspended);
  revalidateResources();
  return ok(undefined);
}

export async function setItemsSuspendedAction(
  ids: string[],
  suspended: boolean,
): Promise<ActionResult<{ affected: number }>> {
  const db = await getUserDb();
  const clean = cleanIds(ids);
  if (clean.length === 0) return err('Chưa chọn mục nào');
  let affected: number;
  try {
    ({ affected } = await setItemsSuspended(db, clean, suspended));
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Không cập nhật được');
  }
  revalidateResources();
  return ok({ affected });
}

export async function setItemStarredAction(
  itemId: string,
  starred: boolean,
): Promise<ActionResult> {
  const db = await getUserDb();
  if (!itemId) return err('Thiếu itemId');
  await setItemStarred(db, itemId, starred);
  revalidatePath('/resources');
  revalidatePath(`/resources/${itemId}`);
  return ok(undefined);
}

export async function setSentenceStarredAction(
  sentenceId: string,
  starred: boolean,
): Promise<ActionResult> {
  const db = await getUserDb();
  if (!sentenceId) return err('Thiếu sentenceId');
  await setSentenceStarred(db, sentenceId, starred);
  revalidatePath('/history');
  return ok(undefined);
}

const updateItemSchema = z.object({
  expression: z.string().trim().min(1, 'Từ / mẫu không được trống'),
  reading: z.string().trim().nullable().optional(),
  meaningVi: z.string().trim().min(1, 'Nghĩa không được trống'),
  notes: z.string().trim().nullable().optional(),
  level: z.enum(JLPT_LEVELS).optional(),
});

export async function updateItemAction(itemId: string, input: unknown): Promise<ActionResult> {
  const db = await getUserDb();
  if (!itemId) return err('Thiếu itemId');
  const parsed = parseInput(updateItemSchema, input);
  if (!parsed.ok) return parsed;
  try {
    await updateItem(db, itemId, {
      ...parsed.data,
      reading: parsed.data.reading?.trim() || null,
      notes: parsed.data.notes?.trim() || null,
    });
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') {
      return err('Đã có mục khác trùng nội dung này');
    }
    return err(e instanceof Error ? e.message : 'Không lưu được');
  }
  revalidateResources();
  return ok(undefined);
}

export async function deleteItemAction(itemId: string): Promise<ActionResult> {
  const db = await getUserDb();
  if (!itemId) return err('Thiếu itemId');
  try {
    await deleteItem(db, itemId);
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Không xoá được');
  }
  revalidateResources();
  return ok(undefined);
}

export async function deleteItemsAction(ids: string[]): Promise<ActionResult<{ deleted: number }>> {
  const db = await getUserDb();
  const clean = cleanIds(ids);
  if (clean.length === 0) return err('Chưa chọn mục nào');
  let deleted: number;
  try {
    ({ deleted } = await deleteItems(db, clean));
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Không xoá được');
  }
  revalidateResources();
  return ok({ deleted });
}

export async function getStreakAction(): Promise<ActionResult<{ current: number }>> {
  const db = await getUserDb();
  const { current } = await getStreak(db);
  return ok({ current });
}

const groupName = z
  .string()
  .trim()
  .min(1, 'Tên nhóm không được trống')
  .refine((s) => !groupTextError('name', s), {
    message: `Tên nhóm tối đa ${GROUP_NAME_MAX} ký tự.`,
  });
const groupNote = z.string().refine((s) => !groupTextError('note', s), {
  message: `Ghi chú tối đa ${GROUP_NOTE_MAX} ký tự.`,
});

const createGroupSchema = z.object({
  name: groupName,
  kind: z.enum(GROUP_KINDS).optional(),
  note: groupNote.optional(),
});

const updateGroupSchema = z.object({
  name: groupName.optional(),
  kind: z.enum(GROUP_KINDS).optional(),
  note: groupNote.nullable().optional(),
});

export async function createGroupAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const db = await getUserDb();
  const parsed = parseInput(createGroupSchema, input);
  if (!parsed.ok) return parsed;
  try {
    const g = await createGroup(db, parsed.data);
    revalidatePath('/resources');
    return ok({ id: g.id });
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Không tạo được nhóm');
  }
}

export async function updateGroupAction(groupId: string, input: unknown): Promise<ActionResult> {
  const db = await getUserDb();
  if (!groupId) return err('Thiếu groupId');
  const parsed = parseInput(updateGroupSchema, input);
  if (!parsed.ok) return parsed;
  try {
    const updated = await updateGroup(db, groupId, parsed.data);
    if (!updated) return err('Không tìm thấy nhóm');
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Không lưu được');
  }
  revalidatePath('/resources');
  revalidatePath(`/groups/${groupId}`);
  return ok(undefined);
}

export async function deleteGroupAction(groupId: string): Promise<ActionResult> {
  const db = await getUserDb();
  if (!groupId) return err('Thiếu groupId');
  try {
    const deleted = await deleteGroup(db, groupId);
    if (!deleted) return err('Không tìm thấy nhóm');
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Không xoá được');
  }
  revalidatePath('/resources');
  return ok(undefined);
}

export async function addItemsToGroupAction(
  groupId: string,
  itemIds: string[],
): Promise<ActionResult<{ added: number }>> {
  const db = await getUserDb();
  if (!groupId) return err('Thiếu groupId');
  const clean = cleanIds(itemIds);
  if (clean.length === 0) return err('Chưa chọn mục nào');
  try {
    const res = await addItemsToGroup(db, groupId, clean);
    revalidatePath('/resources');
    revalidatePath(`/groups/${groupId}`);
    return ok(res);
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Không thêm được vào nhóm');
  }
}

export async function removeItemsFromGroupAction(
  groupId: string,
  itemIds: string[],
): Promise<ActionResult<{ removed: number }>> {
  const db = await getUserDb();
  if (!groupId) return err('Thiếu groupId');
  const clean = cleanIds(itemIds);
  if (clean.length === 0) return err('Chưa chọn mục nào');
  try {
    const res = await removeItemsFromGroup(db, groupId, clean);
    revalidatePath('/resources');
    revalidatePath(`/groups/${groupId}`);
    return ok(res);
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Không gỡ được khỏi nhóm');
  }
}
