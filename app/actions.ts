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
import {
  addItemsToGroup,
  createGroup,
  deleteGroup,
  GROUP_KINDS,
  removeItemsFromGroup,
  updateGroup,
} from '@/lib/groups';
import {
  forkItem,
  forkItems,
  type ItemLikeResult,
  publishItem,
  publishItems,
  toggleItemLike,
  unpublishItem,
  unpublishItems,
} from '@/lib/library';
import {
  addComment,
  type CommentEntry,
  deleteComment,
  listComments,
  type LikeResult,
  shareSentence,
  toggleSentenceLike,
  unshareSentence,
  voteComment,
  type VoteResult,
} from '@/lib/feed';
import {
  BELL_PREVIEW_LIMIT,
  listNotifications,
  markAllRead,
  markRead,
  unreadCount,
  type NotificationRow,
} from '@/lib/notifications';
import { getOptionalSessionUser, getSessionUserId } from '@/lib/current-user';
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
  const parsed = parseInput(settingsPatchSchema, patch);
  if (!parsed.ok) return parsed;
  const settings = await saveSettings(await getSessionUserId(), parsed.data);
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
  const kindParsed = parseInput(resourceKindSchema, kind, 'Loại tài nguyên không hợp lệ');
  if (!kindParsed.ok) return kindParsed;
  const parsed = parseInput(
    z.array(importEntrySchema).min(1).max(2000),
    entries,
    'Danh sách nhập không hợp lệ',
  );
  if (!parsed.ok) return parsed;

  const r = await addItems(
    await getSessionUserId(),
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
  const kindParsed = parseInput(resourceKindSchema, kind, 'Loại tài nguyên không hợp lệ');
  if (!kindParsed.ok) return kindParsed;
  const parsed = parseInput(addOneItemSchema, input);
  if (!parsed.ok) return parsed;
  const r = await addItems(
    await getSessionUserId(),
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
  if (!itemId) return err('Thiếu itemId');
  await setItemSuspended(await getSessionUserId(), itemId, suspended);
  revalidateResources();
  return ok(undefined);
}

/** Bulk suspend/resume selected items (resources DataTable row-selection → "Tạm ngưng"). */
export async function setItemsSuspendedAction(
  ids: string[],
  suspended: boolean,
): Promise<ActionResult<{ affected: number }>> {
  const clean = cleanIds(ids);
  if (clean.length === 0) return err('Chưa chọn mục nào');
  let affected: number;
  try {
    ({ affected } = await setItemsSuspended(await getSessionUserId(), clean, suspended));
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
  if (!itemId) return err('Thiếu itemId');
  await setItemStarred(await getSessionUserId(), itemId, starred);
  revalidatePath('/resources');
  revalidatePath(`/resources/${itemId}`);
  return ok(undefined);
}

/** Toggle a favourite star on a practiced sentence (history card). */
export async function setSentenceStarredAction(
  sentenceId: string,
  starred: boolean,
): Promise<ActionResult> {
  if (!sentenceId) return err('Thiếu sentenceId');
  await setSentenceStarred(await getSessionUserId(), sentenceId, starred);
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
  if (!itemId) return err('Thiếu itemId');
  const parsed = parseInput(updateItemSchema, input);
  if (!parsed.ok) return parsed;
  try {
    await updateItem(await getSessionUserId(), itemId, {
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
  if (!itemId) return err('Thiếu itemId');
  try {
    await deleteItem(await getSessionUserId(), itemId);
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Không xóa được');
  }
  revalidateResources();
  return ok(undefined);
}

/** Bulk-delete selected items (resources DataTable row selection → "Xóa"). Preserves each item's
 *  ReviewLog (server SET-NULLs the log's itemId), same as the single-row delete. */
export async function deleteItemsAction(ids: string[]): Promise<ActionResult<{ deleted: number }>> {
  const clean = cleanIds(ids);
  if (clean.length === 0) return err('Chưa chọn mục nào');
  let deleted: number;
  try {
    ({ deleted } = await deleteItems(await getSessionUserId(), clean));
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
  if (!sentenceId) return err('Thiếu sentenceId');
  try {
    const result = await skipSentence(await getSessionUserId(), sentenceId);
    revalidatePath('/history');
    revalidatePath('/');
    return ok(result);
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Không xử lý được');
  }
}

// ---------------- study groups (plan 2026-07-21-study-groups) ----------------

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
  const parsed = parseInput(createGroupSchema, input);
  if (!parsed.ok) return parsed;
  try {
    const g = await createGroup(await getSessionUserId(), parsed.data);
    // The groups list now lives under the /resources "Nhóm" tab.
    revalidatePath('/resources');
    return ok({ id: g.id });
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Không tạo được nhóm');
  }
}

export async function updateGroupAction(groupId: string, input: unknown): Promise<ActionResult> {
  if (!groupId) return err('Thiếu groupId');
  const parsed = parseInput(updateGroupSchema, input);
  if (!parsed.ok) return parsed;
  try {
    const updated = await updateGroup(await getSessionUserId(), groupId, parsed.data);
    if (!updated) return err('Không tìm thấy nhóm');
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Không lưu được');
  }
  revalidatePath('/resources');
  revalidatePath(`/groups/${groupId}`);
  return ok(undefined);
}

export async function deleteGroupAction(groupId: string): Promise<ActionResult> {
  if (!groupId) return err('Thiếu groupId');
  try {
    const deleted = await deleteGroup(await getSessionUserId(), groupId);
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
  if (!groupId) return err('Thiếu groupId');
  const clean = cleanIds(itemIds);
  if (clean.length === 0) return err('Chưa chọn mục nào');
  try {
    const res = await addItemsToGroup(await getSessionUserId(), groupId, clean);
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
  if (!groupId) return err('Thiếu groupId');
  const clean = cleanIds(itemIds);
  if (clean.length === 0) return err('Chưa chọn mục nào');
  try {
    const res = await removeItemsFromGroup(await getSessionUserId(), groupId, clean);
    revalidatePath('/resources');
    revalidatePath(`/groups/${groupId}`);
    return ok(res);
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Không gỡ được khỏi nhóm');
  }
}

// ---------------- public library + fork (Phase 3) ----------------

const FORK_REASON_MESSAGE: Record<string, string> = {
  'not-found': 'Mục này không còn được chia sẻ (hoặc đã bị gỡ).',
  'own-item': 'Đây là mục của chính bạn.',
  'already-have': 'Kho của bạn đã có mục này rồi.',
};

export async function publishItemAction(itemId: string): Promise<ActionResult> {
  if (!itemId) return err('Thiếu itemId');
  const published = await publishItem(await getSessionUserId(), itemId);
  if (!published) return err('Không tìm thấy mục (hoặc không phải của bạn)');
  revalidatePath('/resources');
  revalidatePath(`/resources/${itemId}`);
  revalidatePath('/library');
  return ok(undefined);
}

export async function unpublishItemAction(itemId: string): Promise<ActionResult> {
  if (!itemId) return err('Thiếu itemId');
  const unpublished = await unpublishItem(await getSessionUserId(), itemId);
  if (!unpublished) return err('Không tìm thấy mục (hoặc không phải của bạn)');
  revalidatePath('/resources');
  revalidatePath(`/resources/${itemId}`);
  revalidatePath('/library');
  return ok(undefined);
}

/** Bulk share (publish) selected items — resources selection bar. Forked rows are silently skipped by
 *  the authorship gate; `shared` reports how many were actually made public. */
export async function publishItemsAction(ids: string[]): Promise<ActionResult<{ shared: number }>> {
  const clean = cleanIds(ids);
  if (clean.length === 0) return err('Chưa chọn mục nào');
  let shared: number;
  try {
    shared = await publishItems(await getSessionUserId(), clean);
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Không chia sẻ được');
  }
  revalidatePath('/resources');
  revalidatePath('/library');
  return ok({ shared });
}

/** Bulk unshare (back to private) — resources selection bar. */
export async function unpublishItemsAction(
  ids: string[],
): Promise<ActionResult<{ shared: number }>> {
  const clean = cleanIds(ids);
  if (clean.length === 0) return err('Chưa chọn mục nào');
  let shared: number;
  try {
    shared = await unpublishItems(await getSessionUserId(), clean);
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Không thu hồi được');
  }
  revalidatePath('/resources');
  revalidatePath('/library');
  return ok({ shared });
}

/** Current study-day streak — polled by the app-wide streak celebration beacon (StreakBeacon). */
export async function getStreakAction(): Promise<ActionResult<{ current: number }>> {
  const { current } = await getStreak(await getSessionUserId());
  return ok({ current });
}

export async function forkItemAction(
  sourceItemId: string,
): Promise<ActionResult<{ itemId: string }>> {
  if (!sourceItemId) return err('Thiếu itemId');
  const res = await forkItem(await getSessionUserId(), sourceItemId);
  if (!res.forked) return err(FORK_REASON_MESSAGE[res.reason] ?? 'Không lấy được về kho');
  revalidatePath('/library');
  revalidateResources();
  return ok({ itemId: res.itemId });
}

export async function forkItemsAction(
  sourceItemIds: string[],
): Promise<ActionResult<{ taken: number }>> {
  if (!sourceItemIds?.length) return err('Chưa chọn mục nào');
  const taken = await forkItems(await getSessionUserId(), sourceItemIds);
  revalidatePath('/library');
  revalidateResources();
  return ok({ taken });
}

/** Toggle the current user's like on a public library item. Returns the new state + total. */
export async function toggleItemLikeAction(itemId: string): Promise<ActionResult<ItemLikeResult>> {
  if (!itemId) return err('Thiếu itemId');
  const res = await toggleItemLike(await getSessionUserId(), itemId);
  if (!res) return err('Mục này không còn được chia sẻ');
  revalidatePath('/library');
  return ok(res);
}

// ---------------- shared history feed + comments (Phase 4) ----------------

export async function shareSentenceAction(sentenceId: string): Promise<ActionResult> {
  if (!sentenceId) return err('Thiếu sentenceId');
  const shared = await shareSentence(await getSessionUserId(), sentenceId);
  if (!shared) return err('Chỉ chia sẻ được lượt đã chấm của chính bạn');
  revalidatePath('/history');
  return ok(undefined);
}

export async function unshareSentenceAction(sentenceId: string): Promise<ActionResult> {
  if (!sentenceId) return err('Thiếu sentenceId');
  const unshared = await unshareSentence(await getSessionUserId(), sentenceId);
  if (!unshared) return err('Không tìm thấy lượt (hoặc không phải của bạn)');
  revalidatePath('/history');
  return ok(undefined);
}

const COMMENT_REASON_MESSAGE: Record<string, string> = {
  'not-visible': 'Lượt này không còn được chia sẻ.',
  empty: 'Bình luận không được để trống.',
  'too-long': 'Bình luận quá dài (tối đa 2000 ký tự).',
};

export async function addCommentAction(
  sentenceId: string,
  body: string,
): Promise<ActionResult<{ id: string }>> {
  if (!sentenceId) return err('Thiếu sentenceId');
  const parsed = parseInput(z.string().min(1).max(2000), body, 'Bình luận không hợp lệ');
  if (!parsed.ok) return parsed;
  const res = await addComment(await getSessionUserId(), sentenceId, parsed.data);
  if (!res.ok) return err(COMMENT_REASON_MESSAGE[res.reason] ?? 'Không gửi được');
  revalidatePath('/history');
  return ok({ id: res.id });
}

export async function deleteCommentAction(commentId: string): Promise<ActionResult> {
  if (!commentId) return err('Thiếu commentId');
  const deleted = await deleteComment(await getSessionUserId(), commentId);
  if (!deleted) return err('Không xóa được bình luận này');
  revalidatePath('/history');
  return ok(undefined);
}

/** Lazy-load a shared sentence's comments (feed card expands). Null result → not visible to you. */
export async function listCommentsAction(
  sentenceId: string,
): Promise<ActionResult<CommentEntry[]>> {
  if (!sentenceId) return err('Thiếu sentenceId');
  const comments = await listComments(await getSessionUserId(), sentenceId);
  if (comments === null) return err('Lượt này không còn được chia sẻ');
  return ok(comments);
}

/** Toggle the current user's like on a shared sentence. Returns the new state + total. */
export async function toggleSentenceLikeAction(
  sentenceId: string,
): Promise<ActionResult<LikeResult>> {
  if (!sentenceId) return err('Thiếu sentenceId');
  const res = await toggleSentenceLike(await getSessionUserId(), sentenceId);
  if (!res) return err('Lượt này không còn được chia sẻ');
  revalidatePath('/history');
  return ok(res);
}

/** Up/down vote a comment (value 1 | -1); same direction again clears it. Returns the fresh score. */
export async function voteCommentAction(
  commentId: string,
  value: 1 | -1,
): Promise<ActionResult<VoteResult>> {
  if (!commentId) return err('Thiếu commentId');
  if (value !== 1 && value !== -1) return err('Giá trị vote không hợp lệ');
  const res = await voteComment(await getSessionUserId(), commentId, value);
  if (!res) return err('Không vote được bình luận này');
  revalidatePath('/history');
  return ok(res);
}

// ---------------- notifications ----------------

/**
 * Mark ONE notification read. Scoped to the caller inside `markRead`, so a foreign id reads as
 * "not found" rather than touching another member's row.
 */
export async function markNotificationReadAction(id: string): Promise<ActionResult> {
  if (!id) return err('Thiếu id');
  await markRead(await getSessionUserId(), id);
  revalidatePath('/', 'layout');
  return ok(undefined);
}

/** Mark every unread notification read. Returns how many were cleared. */
export async function markAllNotificationsReadAction(): Promise<ActionResult<number>> {
  const cleared = await markAllRead(await getSessionUserId());
  revalidatePath('/', 'layout');
  return ok(cleared);
}

/**
 * The bell's own data. A server action rather than a route handler (no endpoint to secure) and rather
 * than a prop from `PageShell` (which client components import, so it cannot be async/server-only).
 * Returns an empty feed instead of throwing for a signed-out viewer — `/guide` is guest-viewable.
 */
export async function getNotificationsAction(): Promise<{
  items: NotificationRow[];
  unread: number;
} | null> {
  // NULL means "no session", which is different from "signed in with an empty feed": the bell must be
  // present on every page for a member even at zero, and absent for a guest reading /guide. Collapsing
  // both into an empty array would hide the control the user asked to always be there.
  const viewer = await getOptionalSessionUser();
  if (!viewer) return null;
  const [items, unread] = await Promise.all([
    listNotifications(viewer.id, BELL_PREVIEW_LIMIT),
    unreadCount(viewer.id),
  ]);
  return { items, unread };
}
