import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { UserDb } from '@/lib/db/user-db';
import { createTestUser, createTestDb, resetLearningData } from '@/lib/db/test-db';

createTestDb('sakubun-groups-');

type Groups = typeof import('@/lib/library/groups');
type Db = typeof import('@/lib/db/db');
let G: Groups;
let prisma: Db['prisma'];
let db: UserDb;

let grammarId = '';
let vocabId = '';

beforeAll(async () => {
  G = await import('@/lib/library/groups');
  ({ prisma } = await import('@/lib/db/db'));
  db = (await import('@/lib/db/user-db')).userDb(await createTestUser(prisma, 'learner'));
});

beforeEach(async () => {
  await resetLearningData(prisma);
  const g = await db.item.create({
    data: { kind: 'GRAMMAR', expression: '〜ばかりに', meaningVi: 'chỉ vì ~', level: 'N2' },
  });
  const v = await db.item.create({
    data: { kind: 'VOCAB', expression: '把握', meaningVi: 'nắm bắt', level: 'N2' },
  });
  grammarId = g.id;
  vocabId = v.id;
});

describe('create / list', () => {
  it('tạo nhóm rồi thấy nó trong danh sách, kèm số thành viên', async () => {
    const g = await G.createGroup(db, { name: 'N2 nguyên nhân', kind: 'grammar' });
    const all = await G.listGroups(db);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: g.id, name: 'N2 nguyên nhân', kind: 'grammar' });
    expect(all[0].memberCount).toBe(0);
  });

  it('tên trống bị từ chối', async () => {
    await expect(G.createGroup(db, { name: '   ' })).rejects.toThrow(/name is required/i);
  });

  it('kind mặc định là mixed', async () => {
    const g = await G.createGroup(db, { name: 'không nói kind' });
    expect(g.kind).toBe('mixed');
  });
});

describe('length limits (thien, 2026-10-25)', () => {
  it('a name over 40 characters or a note over 80 is refused, on create and on update', async () => {
    await expect(G.createGroup(db, { name: 'a'.repeat(41) })).rejects.toThrow(
      'Tên nhóm tối đa 40 ký tự',
    );
    await expect(G.createGroup(db, { name: 'ok', note: 'b'.repeat(81) })).rejects.toThrow(
      'Ghi chú tối đa 80 ký tự',
    );
    const g = await G.createGroup(db, { name: 'a'.repeat(40), note: 'b'.repeat(80) });
    await expect(G.updateGroup(db, g.id, { name: 'c'.repeat(41) })).rejects.toThrow('Tên nhóm');
    await expect(G.updateGroup(db, g.id, { note: 'd'.repeat(81) })).rejects.toThrow('Ghi chú');
    expect(await G.listGroups(db)).toHaveLength(1);
  });
});

describe('kind guard', () => {
  it('nhóm grammar KHÔNG nhận từ vựng', async () => {
    const g = await G.createGroup(db, { name: 'chỉ ngữ pháp', kind: 'grammar' });
    await expect(G.addItemsToGroup(db, g.id, [vocabId])).rejects.toThrow(/does not accept/i);
    expect((await G.getGroup(db, g.id))?.members).toHaveLength(0);
  });

  it('nhóm grammar nhận mẫu ngữ pháp', async () => {
    const g = await G.createGroup(db, { name: 'chỉ ngữ pháp', kind: 'grammar' });
    expect((await G.addItemsToGroup(db, g.id, [grammarId])).added).toBe(1);
  });

  it('nhóm mixed nhận cả hai loại', async () => {
    const g = await G.createGroup(db, { name: 'trộn', kind: 'mixed' });
    expect((await G.addItemsToGroup(db, g.id, [grammarId, vocabId])).added).toBe(2);
    expect((await G.getGroup(db, g.id))?.memberCount).toBe(2);
  });

  it('id không tồn tại → báo lỗi, không im lặng bỏ qua', async () => {
    const g = await G.createGroup(db, { name: 'trộn', kind: 'mixed' });
    await expect(G.addItemsToGroup(db, g.id, [grammarId, 'khong-co-that'])).rejects.toThrow(
      /not found/i,
    );
  });

  it('nhóm không tồn tại → báo lỗi', async () => {
    await expect(G.addItemsToGroup(db, 'khong-co-that', [grammarId])).rejects.toThrow(/not found/i);
  });
});

describe('membership', () => {
  it('thêm lại thành viên cũ là no-op (added = 0), không nhân đôi', async () => {
    const g = await G.createGroup(db, { name: 'trùng lặp', kind: 'mixed' });
    expect((await G.addItemsToGroup(db, g.id, [grammarId])).added).toBe(1);
    expect((await G.addItemsToGroup(db, g.id, [grammarId])).added).toBe(0);
    expect((await G.getGroup(db, g.id))?.memberCount).toBe(1);
  });

  it('id lặp trong CÙNG một lần gọi cũng chỉ tính một', async () => {
    const g = await G.createGroup(db, { name: 'trộn', kind: 'mixed' });
    expect((await G.addItemsToGroup(db, g.id, [grammarId, grammarId])).added).toBe(1);
  });

  it('gỡ thành viên khỏi nhóm', async () => {
    const g = await G.createGroup(db, { name: 'gỡ thử', kind: 'mixed' });
    await G.addItemsToGroup(db, g.id, [grammarId, vocabId]);
    expect((await G.removeItemsFromGroup(db, g.id, [vocabId])).removed).toBe(1);
    const detail = await G.getGroup(db, g.id);
    expect(detail?.members.map((m) => m.itemId)).toEqual([grammarId]);
  });

  it('getGroup trả về null khi nhóm không tồn tại', async () => {
    expect(await G.getGroup(db, 'khong-co-that')).toBeNull();
  });
});

describe('delete', () => {
  it('xoá nhóm thì cascade mất membership NHƯNG item vẫn còn', async () => {
    const g = await G.createGroup(db, { name: 'sắp xoá', kind: 'mixed' });
    await G.addItemsToGroup(db, g.id, [grammarId, vocabId]);

    expect(await G.deleteGroup(db, g.id)).toBe(true);
    expect(await G.getGroup(db, g.id)).toBeNull();
    expect(await db.groupMember.count()).toBe(0);
    expect(await db.item.count()).toBe(2);
    expect(await db.item.findUnique({ where: { id: grammarId } })).not.toBeNull();
  });

  it('xoá ITEM thì membership của nó biến theo, nhóm vẫn còn', async () => {
    const g = await G.createGroup(db, { name: 'còn lại', kind: 'mixed' });
    await G.addItemsToGroup(db, g.id, [grammarId, vocabId]);
    await db.item.delete({ where: { id: vocabId } });
    const detail = await G.getGroup(db, g.id);
    expect(detail).not.toBeNull();
    expect(detail?.members.map((m) => m.itemId)).toEqual([grammarId]);
  });

  it('xoá nhóm không tồn tại trả về false', async () => {
    expect(await G.deleteGroup(db, 'khong-co-that')).toBe(false);
  });
});

describe('update', () => {
  it('đổi tên và ghi chú', async () => {
    const g = await G.createGroup(db, { name: 'tên cũ', kind: 'mixed' });
    expect(await G.updateGroup(db, g.id, { name: 'tên mới', note: 'chủ đề công việc' })).toBe(true);
    const after = (await G.listGroups(db))[0];
    expect(after).toMatchObject({ name: 'tên mới', note: 'chủ đề công việc' });
  });

  it('tên trống bị từ chối', async () => {
    const g = await G.createGroup(db, { name: 'tên cũ' });
    await expect(G.updateGroup(db, g.id, { name: '  ' })).rejects.toThrow(/name is required/i);
  });

  it('nhóm không tồn tại trả về false', async () => {
    expect(await G.updateGroup(db, 'khong-co-that', { name: 'x' })).toBe(false);
  });

  it('thu hẹp kind KHÔNG đuổi thành viên đã có (quyết định của caller)', async () => {
    const g = await G.createGroup(db, { name: 'trộn', kind: 'mixed' });
    await G.addItemsToGroup(db, g.id, [grammarId, vocabId]);
    await G.updateGroup(db, g.id, { kind: 'grammar' });
    expect((await G.getGroup(db, g.id))?.memberCount).toBe(2);
    const another = await db.item.create({
      data: { kind: 'VOCAB', expression: '曖昧', meaningVi: 'mơ hồ', level: 'N2' },
    });
    await expect(G.addItemsToGroup(db, g.id, [another.id])).rejects.toThrow(/does not accept/i);
  });
});

describe('previewGroupMembers (dry run — ghi 0 dòng)', () => {
  it('chia đúng ba rổ: vừa / lệch kind / không tìm thấy', async () => {
    const preview = await G.previewGroupMembers(db, 'grammar', [
      grammarId,
      vocabId,
      'khong-co-that',
    ]);
    expect(preview.fit.map((i) => i.itemId)).toEqual([grammarId]);
    expect(preview.mismatched.map((i) => i.itemId)).toEqual([vocabId]);
    expect(preview.notFound).toEqual(['khong-co-that']);
    expect(await db.group.count()).toBe(0);
    expect(await db.groupMember.count()).toBe(0);
  });

  it('danh sách rỗng trả về ba rổ rỗng', async () => {
    expect(await G.previewGroupMembers(db, 'mixed', [])).toEqual({
      fit: [],
      mismatched: [],
      notFound: [],
    });
  });
});

describe('listItems(db, { withGroupIds })', () => {
  it('attaches the ids of every group the item is in', async () => {
    const { listItems } = await import('@/lib/library/practice');
    const a = await G.createGroup(db, { name: 'nhóm A', kind: 'mixed' });
    const b = await G.createGroup(db, { name: 'nhóm B', kind: 'grammar' });
    await G.addItemsToGroup(db, a.id, [grammarId, vocabId]);
    await G.addItemsToGroup(db, b.id, [grammarId]);

    const rows = (await listItems(db, { withGroupIds: true })) as {
      itemId: string;
      groupIds: string[];
    }[];
    const row = rows.find((r) => r.itemId === grammarId);
    expect(row?.groupIds?.sort()).toEqual([a.id, b.id].sort());

    const vocab = (await listItems(db, {
      kind: 'VOCAB',
      withGroupIds: true,
    })) as { itemId: string; groupIds: string[] }[];
    expect(vocab.find((r) => r.itemId === vocabId)?.groupIds).toEqual([a.id]);
  });

  it('an item in no group gets an empty array, not undefined', async () => {
    const { listItems } = await import('@/lib/library/practice');
    const rows = (await listItems(db, { withGroupIds: true })) as { groupIds: string[] }[];
    expect(rows.every((r) => Array.isArray(r.groupIds))).toBe(true);
  });

  it('omits the field entirely without the flag (the MCP payload must not grow)', async () => {
    const { listItems } = await import('@/lib/library/practice');
    await G.addItemsToGroup(db, (await G.createGroup(db, { name: 'x', kind: 'mixed' })).id, [
      grammarId,
    ]);
    const rows = await listItems(db, {});
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => 'groupIds' in r)).toBe(false);
  });
});

describe('pickers', () => {
  it('listAddableItems loại thành viên đã có và tôn trọng kind', async () => {
    const g = await G.createGroup(db, { name: 'chỉ ngữ pháp', kind: 'grammar' });
    expect((await G.listAddableItems(db, g.id))?.map((i) => i.itemId)).toEqual([grammarId]);
    await G.addItemsToGroup(db, g.id, [grammarId]);
    expect(await G.listAddableItems(db, g.id)).toEqual([]);
  });

  it('listAddableItems lists the whole library, not the first 500', async () => {
    await db.item.createMany({
      data: Array.from({ length: 600 }, (_, i) => ({
        kind: 'VOCAB',
        expression: `語${i}`,
        meaningVi: `nghĩa ${i}`,
        level: 'N3',
      })),
    });
    const g = await G.createGroup(db, { name: 'kho lớn', kind: 'vocab' });
    expect(await G.listAddableItems(db, g.id)).toHaveLength(601);
  });

  it('listAddableItems trả về null khi nhóm không tồn tại', async () => {
    expect(await G.listAddableItems(db, 'khong-co-that')).toBeNull();
  });

  it('getItemGroupPicker tách nhóm ĐANG Ở và nhóm CÓ THỂ THÊM', async () => {
    const inGroup = await G.createGroup(db, { name: 'đang ở', kind: 'mixed' });
    const addable = await G.createGroup(db, { name: 'có thể thêm', kind: 'grammar' });
    await G.createGroup(db, { name: 'sai kind', kind: 'vocab' });
    await G.addItemsToGroup(db, inGroup.id, [grammarId]);

    const picker = await G.getItemGroupPicker(db, grammarId);
    expect(picker?.member.map((g) => g.id)).toEqual([inGroup.id]);
    expect(picker?.addable.map((g) => g.id)).toEqual([addable.id]);
  });

  it('getItemGroupPicker trả về null khi item không tồn tại', async () => {
    expect(await G.getItemGroupPicker(db, 'khong-co-that')).toBeNull();
  });
});
