import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '@/lib/test-db';

createTestDb('sakubun-groups-');

type Groups = typeof import('@/lib/groups');
type Db = typeof import('@/lib/db');
let G: Groups;
let prisma: Db['prisma'];

let grammarId = '';
let vocabId = '';

beforeAll(async () => {
  G = await import('@/lib/groups');
  ({ prisma } = await import('@/lib/db'));
});

beforeEach(async () => {
  await prisma.groupMember.deleteMany({});
  await prisma.group.deleteMany({});
  await prisma.item.deleteMany({});
  const g = await prisma.item.create({
    data: { kind: 'GRAMMAR', expression: '〜ばかりに', meaningVi: 'chỉ vì ~', level: 'N2' },
  });
  const v = await prisma.item.create({
    data: { kind: 'VOCAB', expression: '把握', meaningVi: 'nắm bắt', level: 'N2' },
  });
  grammarId = g.id;
  vocabId = v.id;
});

describe('create / list', () => {
  it('tạo nhóm rồi thấy nó trong danh sách, kèm số thành viên', async () => {
    const g = await G.createGroup({ name: 'N2 nguyên nhân', kind: 'grammar' });
    const all = await G.listGroups();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: g.id, name: 'N2 nguyên nhân', kind: 'grammar' });
    expect(all[0].memberCount).toBe(0);
  });

  it('tên trống bị từ chối', async () => {
    await expect(G.createGroup({ name: '   ' })).rejects.toThrow(/name is required/i);
  });

  it('kind mặc định là mixed', async () => {
    const g = await G.createGroup({ name: 'không nói kind' });
    expect(g.kind).toBe('mixed');
  });
});

describe('kind guard', () => {
  it('nhóm grammar KHÔNG nhận từ vựng', async () => {
    const g = await G.createGroup({ name: 'chỉ ngữ pháp', kind: 'grammar' });
    await expect(G.addItemsToGroup(g.id, [vocabId])).rejects.toThrow(/does not accept/i);
    expect((await G.getGroup(g.id))?.members).toHaveLength(0);
  });

  it('nhóm grammar nhận mẫu ngữ pháp', async () => {
    const g = await G.createGroup({ name: 'chỉ ngữ pháp', kind: 'grammar' });
    expect((await G.addItemsToGroup(g.id, [grammarId])).added).toBe(1);
  });

  it('nhóm mixed nhận cả hai loại', async () => {
    const g = await G.createGroup({ name: 'trộn', kind: 'mixed' });
    expect((await G.addItemsToGroup(g.id, [grammarId, vocabId])).added).toBe(2);
    expect((await G.getGroup(g.id))?.memberCount).toBe(2);
  });

  it('id không tồn tại → báo lỗi, không im lặng bỏ qua', async () => {
    const g = await G.createGroup({ name: 'trộn', kind: 'mixed' });
    await expect(G.addItemsToGroup(g.id, [grammarId, 'khong-co-that'])).rejects.toThrow(
      /not found/i,
    );
  });

  it('nhóm không tồn tại → báo lỗi', async () => {
    await expect(G.addItemsToGroup('khong-co-that', [grammarId])).rejects.toThrow(/not found/i);
  });
});

describe('membership', () => {
  it('thêm lại thành viên cũ là no-op (added = 0), không nhân đôi', async () => {
    const g = await G.createGroup({ name: 'trùng lặp', kind: 'mixed' });
    expect((await G.addItemsToGroup(g.id, [grammarId])).added).toBe(1);
    expect((await G.addItemsToGroup(g.id, [grammarId])).added).toBe(0);
    expect((await G.getGroup(g.id))?.memberCount).toBe(1);
  });

  it('id lặp trong CÙNG một lần gọi cũng chỉ tính một', async () => {
    const g = await G.createGroup({ name: 'trộn', kind: 'mixed' });
    expect((await G.addItemsToGroup(g.id, [grammarId, grammarId])).added).toBe(1);
  });

  it('gỡ thành viên khỏi nhóm', async () => {
    const g = await G.createGroup({ name: 'gỡ thử', kind: 'mixed' });
    await G.addItemsToGroup(g.id, [grammarId, vocabId]);
    expect((await G.removeItemsFromGroup(g.id, [vocabId])).removed).toBe(1);
    const detail = await G.getGroup(g.id);
    expect(detail?.members.map((m) => m.itemId)).toEqual([grammarId]);
  });

  it('getGroup trả về null khi nhóm không tồn tại', async () => {
    expect(await G.getGroup('khong-co-that')).toBeNull();
  });
});

describe('delete', () => {
  it('xoá nhóm thì cascade mất membership NHƯNG item vẫn còn', async () => {
    const g = await G.createGroup({ name: 'sắp xoá', kind: 'mixed' });
    await G.addItemsToGroup(g.id, [grammarId, vocabId]);

    expect(await G.deleteGroup(g.id)).toBe(true);
    expect(await G.getGroup(g.id)).toBeNull();
    expect(await prisma.groupMember.count()).toBe(0);
    expect(await prisma.item.count()).toBe(2);
    expect(await prisma.item.findUnique({ where: { id: grammarId } })).not.toBeNull();
  });

  it('xoá ITEM thì membership của nó biến theo, nhóm vẫn còn', async () => {
    const g = await G.createGroup({ name: 'còn lại', kind: 'mixed' });
    await G.addItemsToGroup(g.id, [grammarId, vocabId]);
    await prisma.item.delete({ where: { id: vocabId } });
    const detail = await G.getGroup(g.id);
    expect(detail).not.toBeNull();
    expect(detail?.members.map((m) => m.itemId)).toEqual([grammarId]);
  });

  it('xoá nhóm không tồn tại trả về false', async () => {
    expect(await G.deleteGroup('khong-co-that')).toBe(false);
  });
});

describe('update', () => {
  it('đổi tên và ghi chú', async () => {
    const g = await G.createGroup({ name: 'tên cũ', kind: 'mixed' });
    expect(await G.updateGroup(g.id, { name: 'tên mới', note: 'chủ đề công việc' })).toBe(true);
    const after = (await G.listGroups())[0];
    expect(after).toMatchObject({ name: 'tên mới', note: 'chủ đề công việc' });
  });

  it('tên trống bị từ chối', async () => {
    const g = await G.createGroup({ name: 'tên cũ' });
    await expect(G.updateGroup(g.id, { name: '  ' })).rejects.toThrow(/name is required/i);
  });

  it('nhóm không tồn tại trả về false', async () => {
    expect(await G.updateGroup('khong-co-that', { name: 'x' })).toBe(false);
  });

  it('thu hẹp kind KHÔNG đuổi thành viên đã có (quyết định của caller)', async () => {
    const g = await G.createGroup({ name: 'trộn', kind: 'mixed' });
    await G.addItemsToGroup(g.id, [grammarId, vocabId]);
    await G.updateGroup(g.id, { kind: 'grammar' });
    expect((await G.getGroup(g.id))?.memberCount).toBe(2);
    const another = await prisma.item.create({
      data: { kind: 'VOCAB', expression: '曖昧', meaningVi: 'mơ hồ', level: 'N2' },
    });
    await expect(G.addItemsToGroup(g.id, [another.id])).rejects.toThrow(/does not accept/i);
  });
});

describe('previewGroupMembers (dry run — ghi 0 dòng)', () => {
  it('chia đúng ba rổ: vừa / lệch kind / không tìm thấy', async () => {
    const preview = await G.previewGroupMembers('grammar', [grammarId, vocabId, 'khong-co-that']);
    expect(preview.fit.map((i) => i.itemId)).toEqual([grammarId]);
    expect(preview.mismatched.map((i) => i.itemId)).toEqual([vocabId]);
    expect(preview.notFound).toEqual(['khong-co-that']);
    expect(await prisma.group.count()).toBe(0);
    expect(await prisma.groupMember.count()).toBe(0);
  });

  it('danh sách rỗng trả về ba rổ rỗng', async () => {
    expect(await G.previewGroupMembers('mixed', [])).toEqual({
      fit: [],
      mismatched: [],
      notFound: [],
    });
  });
});

describe('listItems({ withGroupIds })', () => {
  it('attaches the ids of every group the item is in', async () => {
    const { listItems } = await import('@/lib/practice');
    const a = await G.createGroup({ name: 'nhóm A', kind: 'mixed' });
    const b = await G.createGroup({ name: 'nhóm B', kind: 'grammar' });
    await G.addItemsToGroup(a.id, [grammarId, vocabId]);
    await G.addItemsToGroup(b.id, [grammarId]);

    const rows = (await listItems({ withGroupIds: true })) as { itemId: string; groupIds: string[] }[];
    const row = rows.find((r) => r.itemId === grammarId);
    expect(row?.groupIds?.sort()).toEqual([a.id, b.id].sort());

    const vocab = (await listItems({
      kind: 'VOCAB',
      withGroupIds: true,
    })) as { itemId: string; groupIds: string[] }[];
    expect(vocab.find((r) => r.itemId === vocabId)?.groupIds).toEqual([a.id]);
  });

  it('an item in no group gets an empty array, not undefined', async () => {
    const { listItems } = await import('@/lib/practice');
    const rows = (await listItems({ withGroupIds: true })) as { groupIds: string[] }[];
    expect(rows.every((r) => Array.isArray(r.groupIds))).toBe(true);
  });

  it('omits the field entirely without the flag (the MCP payload must not grow)', async () => {
    const { listItems } = await import('@/lib/practice');
    await G.addItemsToGroup((await G.createGroup({ name: 'x', kind: 'mixed' })).id, [grammarId]);
    const rows = await listItems({});
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => 'groupIds' in r)).toBe(false);
  });
});

describe('pickers', () => {
  it('listAddableItems loại thành viên đã có và tôn trọng kind', async () => {
    const g = await G.createGroup({ name: 'chỉ ngữ pháp', kind: 'grammar' });
    expect((await G.listAddableItems(g.id))?.map((i) => i.itemId)).toEqual([grammarId]);
    await G.addItemsToGroup(g.id, [grammarId]);
    expect(await G.listAddableItems(g.id)).toEqual([]);
  });

  it('listAddableItems trả về null khi nhóm không tồn tại', async () => {
    expect(await G.listAddableItems('khong-co-that')).toBeNull();
  });

  it('getItemGroupPicker tách nhóm ĐANG Ở và nhóm CÓ THỂ THÊM', async () => {
    const inGroup = await G.createGroup({ name: 'đang ở', kind: 'mixed' });
    const addable = await G.createGroup({ name: 'có thể thêm', kind: 'grammar' });
    await G.createGroup({ name: 'sai kind', kind: 'vocab' });
    await G.addItemsToGroup(inGroup.id, [grammarId]);

    const picker = await G.getItemGroupPicker(grammarId);
    expect(picker?.member.map((g) => g.id)).toEqual([inGroup.id]);
    expect(picker?.addable.map((g) => g.id)).toEqual([addable.id]);
  });

  it('getItemGroupPicker trả về null khi item không tồn tại', async () => {
    expect(await G.getItemGroupPicker('khong-co-that')).toBeNull();
  });
});
