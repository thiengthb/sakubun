// `guard()` — cái vỏ bọc mọi tool MCP, và là thứ QUYẾT ĐỊNH Claude đọc được gì khi có lỗi.
//
// Vì sao có file này (2026-08-10): trước hôm nay mọi P2025 của Prisma đều được dịch thành cùng một
// câu — "không tìm thấy item với id đó, gọi list_grammar để lấy id hiện tại". Ngày 2026-08-08 hàng
// thiếu không phải Item mà là `LearnerAbility`, một singleton phía server mà máy khách không hề địa
// chỉ được. Claude làm đúng như lời hướng dẫn: liệt kê lại kho rồi gọi lại y nguyên, chín lần, trong
// khi mọi lượt luyện đã chấm đều bị rollback. Một lời khuyên SAI còn tệ hơn không có lời khuyên nào,
// vì nó sinh ra hành động sai đầy tự tin — và nó đẩy việc gỡ lỗi đi chệch hướng suốt một buổi.
//
// Không cần DB: guard() thuần, và tool-kit.ts không import tầng Prisma.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { guard } from '@/lib/mcp/tool-kit';

/**
 * Một P2025 đúng hình dạng Prisma 7.9.1 thật sự tạo ra.
 *
 * Hình dạng này không phải phỏng đoán — nó là bản sao của log container ngày 2026-08-08:
 *   `code: 'P2025', meta: { modelName: 'LearnerAbility', operation: 'an update' }`
 * Và nó được chốt lại lần nữa với Prisma THẬT trong practice.test.ts ("hình dạng P2025 mà
 * lib/mcp/tool-kit.ts dựa vào"), nên nếu Prisma đổi meta thì bên đó đỏ, không phải im lặng.
 */
function p2025(modelName?: string): Error {
  const e = new Error(
    'An operation failed because it depends on one or more records that were required but not found.',
  ) as Error & { code: string; meta?: unknown };
  e.code = 'P2025';
  if (modelName !== undefined) e.meta = { modelName, operation: 'an update' };
  return e;
}

/** Chạy một tool luôn ném `err`, trả về đúng text mà Claude sẽ đọc. */
async function textFromThrow(err: unknown): Promise<string> {
  const tool = guard('test_tool', async () => {
    throw err;
  });
  const res = (await tool()) as { content: { text: string }[]; isError?: boolean };
  expect(res.isError, 'lỗi phải về dạng soft error, không phải throw ra ngoài').toBe(true);
  return res.content[0].text;
}

beforeEach(() => {
  // guard() ghi mọi lỗi ra stderr — đó là hành vi ta MUỐN (xem memory: log container là nơi duy nhất
  // thấy được lỗi MCP), nhưng ở đây nó chỉ làm output test ồn.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('guard — P2025 nói đúng hàng nào thiếu', () => {
  it('một bảng phía server: nêu tên bảng, và CẤM thử lại', async () => {
    const text = await textFromThrow(p2025('LearnerAbility'));

    expect(text).toContain('LearnerAbility');
    // Điều quan trọng nhất trong cả file: không được dụ Claude đi sửa một cái id vốn không sai.
    expect(text, 'không được đổ lỗi cho itemId').not.toContain('list_grammar');
    expect(text, 'không được đổ lỗi cho itemId').not.toContain('item với id đó');
    expect(text.toLowerCase(), 'phải nói rõ là đừng thử lại').toContain('đừng thử lại');
  });

  it('một id do máy khách gửi: giữ nguyên lối hồi phục cũ', async () => {
    // Ca này ĐÚNG với lời khuyên cũ, nên bản sửa không được làm mất nó.
    for (const model of ['Item', 'SrsState']) {
      const text = await textFromThrow(p2025(model));
      expect(text, model).toContain('list_grammar / list_vocab');
      expect(text, `${model}: không cấm thử lại, vì thử lại đúng là cách hồi phục`).not.toContain(
        'ĐỪNG thử lại',
      );
    }
  });

  it('mỗi loại id có lối hồi phục riêng, trỏ tới tool thật', async () => {
    expect(await textFromThrow(p2025('Sentence'))).toContain('stage_sentence');
    expect(await textFromThrow(p2025('Group'))).toContain('list_groups');
    expect(await textFromThrow(p2025('GroupMember'))).toContain('list_groups');
    expect(await textFromThrow(p2025('CalibrationProposal'))).toContain(
      'list_calibration_proposals',
    );
  });

  it('P2025 không kèm meta vẫn an toàn: không bịa tên bảng, vẫn cấm thử lại', async () => {
    const text = await textFromThrow(p2025());
    expect(text).toContain('(không rõ bảng)');
    expect(text.toLowerCase()).toContain('đừng thử lại');
    expect(text).not.toContain('list_grammar');
  });
});

describe('guard — các nhánh lỗi còn lại không đổi', () => {
  it('ZodError thành danh sách tham số sai', async () => {
    const err = new ZodError([
      { code: 'custom', path: ['ratings', 0, 'rating'], message: 'phải từ 1 tới 4' },
    ]);
    const text = await textFromThrow(err);
    expect(text).toContain('Tham số không hợp lệ');
    expect(text).toContain('ratings.0.rating');
  });

  it('lỗi thường giữ nguyên lời của nó', async () => {
    expect(await textFromThrow(new Error('kho rỗng, chưa có mẫu nào'))).toBe(
      'kho rỗng, chưa có mẫu nào',
    );
  });

  it('một mã Prisma KHÁC không bị nhận nhầm là record-not-found', async () => {
    const unique = new Error('Unique constraint failed') as Error & { code: string };
    unique.code = 'P2002';
    expect(await textFromThrow(unique)).toBe('Unique constraint failed');
  });

  it('thành công thì trả nguyên kết quả, không bọc thêm gì', async () => {
    const tool = guard('test_tool', async (n: number) => ({ doubled: n * 2 }));
    expect(await tool(21)).toEqual({ doubled: 42 });
  });
});
