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
  updateItem,
  VOCAB_KIND,
} from '@/lib/practice';
import { JLPT_LEVELS, settingsPatchSchema, type Settings } from '@/lib/settings-schema';
import { getSessionUserId } from '@/lib/current-user';
import {
  GROUP_KINDS,
  addItemsToGroup,
  createGroup,
  deleteGroup,
  removeItemsFromGroup,
  updateGroup,
} from '@/lib/groups';
import { type ActionResult, cleanIds, err, ok, parseInput } from '@/lib/action-result';

export type { ActionResult } from '@/lib/action-result';

function revalidateResources(): void {
  revalidatePath('/resources');
  revalidatePath('/');
}

export async function saveSettingsAction(patch: unknown): Promise<ActionResult<Settings>> {
  await getSessionUserId();
  const parsed = parseInput(settingsPatchSchema, patch);
  if (!parsed.ok) return parsed;
  const settings = await saveSettings(parsed.data);
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
  await getSessionUserId();
  if (!itemId) return err('Thiếu itemId');
  await setItemSuspended(itemId, suspended);
  revalidateResources();
  return ok(undefined);
}

export async function setItemsSuspendedAction(
  ids: string[],
  suspended: boolean,
): Promise<ActionResult<{ affected: number }>> {
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

export async function setItemStarredAction(
  itemId: string,
  starred: boolean,
): Promise<ActionResult> {
  await getSessionUserId();
  if (!itemId) return err('Thiếu itemId');
  await setItemStarred(itemId, starred);
  revalidatePath('/resources');
  revalidatePath(`/resources/${itemId}`);
  return ok(undefined);
}

export async function setSentenceStarredAction(
  sentenceId: string,
  starred: boolean,
): Promise<ActionResult> {
  await getSessionUserId();
  if (!sentenceId) return err('Thiếu sentenceId');
  await setSentenceStarred(sentenceId, starred);
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
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') {
      return err('Đã có mục khác trùng nội dung này');
    }
    return err(e instanceof Error ? e.message : 'Không lưu được');
  }
  revalidateResources();
  return ok(undefined);
}

export async function deleteItemAction(itemId: string): Promise<ActionResult> {
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

export async function deleteItemsAction(ids: string[]): Promise<ActionResult<{ deleted: number }>> {
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

export async function getStreakAction(): Promise<ActionResult<{ current: number }>> {
  await getSessionUserId();
  const { current } = await getStreak();
  return ok({ current });
}

const createGroupSchema = z.object({
  name: z.string().trim().min(1, 'Tên nhóm không được trống'),
  kind: z.enum(GROUP_KINDS).optional(),
  note: z.string().optional(),
});

const updateGroupSchema = z.object({
  name: z.string().trim().min(1, 'Tên nhóm không được trống').optional(),
  kind: z.enum(GROUP_KINDS).optional(),
  note: z.string().nullable().optional(),
});

export async function createGroupAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  await getSessionUserId();
  const parsed = parseInput(createGroupSchema, input);
  if (!parsed.ok) return parsed;
  try {
    const g = await createGroup(parsed.data);
    revalidatePath('/resources');
    return ok({ id: g.id });
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Không tạo được nhóm');
  }
}

export async function updateGroupAction(groupId: string, input: unknown): Promise<ActionResult> {
  await getSessionUserId();
  if (!groupId) return err('Thiếu groupId');
  const parsed = parseInput(updateGroupSchema, input);
  if (!parsed.ok) return parsed;
  try {
    const updated = await updateGroup(groupId, parsed.data);
    if (!updated) return err('Không tìm thấy nhóm');
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Không lưu được');
  }
  revalidatePath('/resources');
  revalidatePath(`/groups/${groupId}`);
  return ok(undefined);
}

export async function deleteGroupAction(groupId: string): Promise<ActionResult> {
  await getSessionUserId();
  if (!groupId) return err('Thiếu groupId');
  try {
    const deleted = await deleteGroup(groupId);
    if (!deleted) return err('Không tìm thấy nhóm');
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Không xóa được');
  }
  revalidatePath('/resources');
  return ok(undefined);
}

export async function addItemsToGroupAction(
  groupId: string,
  itemIds: string[],
): Promise<ActionResult<{ added: number }>> {
  await getSessionUserId();
  if (!groupId) return err('Thiếu groupId');
  const clean = cleanIds(itemIds);
  if (clean.length === 0) return err('Chưa chọn mục nào');
  try {
    const res = await addItemsToGroup(groupId, clean);
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
  await getSessionUserId();
  if (!groupId) return err('Thiếu groupId');
  const clean = cleanIds(itemIds);
  if (clean.length === 0) return err('Chưa chọn mục nào');
  try {
    const res = await removeItemsFromGroup(groupId, clean);
    revalidatePath('/resources');
    revalidatePath(`/groups/${groupId}`);
    return ok(res);
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Không gỡ được khỏi nhóm');
  }
}
