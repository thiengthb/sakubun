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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { guard, setToolCallRecorder } from '@/lib/mcp/tool-kit';

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

// Bộ đếm việc dùng tool (2026-08-11). Recorder thật ghi qua Prisma và có lưới riêng ở
// `lib/mcp/usage.test.ts`; ở đây chỉ đo phần hợp đồng của guard(), bằng recorder giả — và quan trọng
// nhất là đo cái KHÔNG được xảy ra.
describe('guard — đếm việc dùng tool', () => {
  afterEach(() => {
    // Slot ở mức module: bỏ quên nó thì mọi file test chạy sau trong cùng process đều bị ghi đè.
    setToolCallRecorder(null);
  });

  it('không cắm recorder thì guard() KHÔNG ghi đi đâu cả', async () => {
    // Mặc định phải là im lặng: `guard()` được gọi trong hàng chục test thuần, và một recorder mặc
    // định sẽ biến chúng thành thứ ghi vào prisma/dev.db.
    const tool = guard('test_tool', async () => 'ok');
    expect(await tool()).toBe('ok');
  });

  it('lời gọi thành công: đúng tên, có thời gian, không có lỗi', async () => {
    const seen: [string, number, string | null][] = [];
    setToolCallRecorder(async (...call) => void seen.push(call));

    await guard('get_stats', async () => 'ok')();

    expect(seen).toHaveLength(1);
    expect(seen[0][0]).toBe('get_stats');
    expect(seen[0][1], 'ms có thể là 0 nhưng phải là số').toBeGreaterThanOrEqual(0);
    expect(seen[0][2], 'thành công thì không có lời lỗi nào').toBeNull();
  });

  it('lời gọi hỏng: ghi mã lỗi + tên bảng, không phải câu đã dịch cho Claude', async () => {
    const seen: [string, number, string | null][] = [];
    setToolCallRecorder(async (...call) => void seen.push(call));

    await guard('submit_review', async () => {
      throw p2025('LearnerAbility');
    })();

    // Bảng đếm để gỡ lỗi, nên nó cần mã lỗi và tên bảng. Câu tiếng Việt gửi cho Claude là lời KHUYÊN,
    // nó đã bỏ mất cả hai.
    expect(seen[0][2]).toContain('[P2025 LearnerAbility]');
    expect(seen[0][2]).toContain('required but not found');
  });

  /** Chạy một tool ném `err` rồi trả về đúng chuỗi được LƯU (không phải chuỗi gửi cho Claude). */
  async function digestOf(err: unknown): Promise<string> {
    const seen: (string | null)[] = [];
    setToolCallRecorder(async (_n, _ms, error) => void seen.push(error));
    await guard('update_grammar', async () => {
      throw err;
    })();
    return seen[0]!;
  }

  it('dump của Prisma: giữ ĐÚNG dòng cuối, bỏ đường dẫn chunk và phần echo mã nguồn', async () => {
    // Hình dạng thật, sao lại từ lần chạy e2e ngày 2026-08-11 (kể cả việc các mục cách nhau bằng MỘT
    // dòng xuống, không phải dòng trắng — bản sửa đầu đoán là dòng trắng và e2e đỏ lần thứ hai).
    const err = new Error(
      'Invalid `__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$db$2e$ts["prisma"].item.update()` invocation in\n' +
        'C:\\project\\sakubun-single-user\\.next\\dev\\server\\chunks\\[root-of-the-server].js:5462:134\n' +
        '  5461 |     if (input.level !== undefined) data.level = input.level;\n' +
        '> 5462 |     await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$db$2e$ts["prisma"].item.update({\n' +
        'An operation failed because it depends on one or more records that were required but not found. No record was found for an update.',
    ) as Error & { code: string; meta: unknown };
    err.code = 'P2025';
    err.meta = { modelName: 'Item' };

    expect(await digestOf(err)).toBe(
      '[P2025 Item] An operation failed because it depends on one or more records that were required but not found. No record was found for an update.',
    );
  });

  it('ZodError: lưu các mục sai, không lưu dấu ngoặc cuối của JSON', async () => {
    // `e.message` của ZodError là một mảng JSON nhiều dòng, dòng cuối của nó là `]`. Đây cũng là loại
    // lỗi MCP thường gặp nhất (Claude gửi tham số không khớp), nên nó là loại đáng đọc được nhất.
    const digest = await digestOf(
      new ZodError([{ code: 'custom', path: ['ratings', 0, 'rating'], message: 'phải từ 1 tới 4' }]),
    );

    expect(digest).toBe('[ZodError] ratings.0.rating: phải từ 1 tới 4');
  });

  it('một lỗi dài bất thường vẫn bị chặn độ dài, và phần giữ lại là phần ĐUÔI', async () => {
    // Không có dòng nào để chọn (một khối liền), nên cái chặn duy nhất là giới hạn ký tự. Cột này
    // không phải nơi chứa stack trace.
    const digest = await digestOf(new Error(`${'x'.repeat(5000)} câu cuối cùng`));

    expect(digest.length).toBe(300);
    expect(digest).toContain('câu cuối cùng');
    expect(digest.startsWith('…'), 'nói rõ là đã bị cắt, không giả vờ là nguyên văn').toBe(true);
  });

  it('recorder hỏng KHÔNG được làm hỏng lời gọi tool', async () => {
    // Một lớp đo đạc gây ra chính sự cố nó tồn tại để phát hiện là ca tệ nhất trong nhóm này: người
    // học mất lượt luyện vì bộ đếm ghi không được.
    setToolCallRecorder(async () => {
      throw new Error('DB đầy');
    });

    expect(await guard('test_tool', async () => ({ ok: true }))()).toEqual({ ok: true });

    const failed = await guard('test_tool', async () => {
      throw new Error('lỗi thật của tool');
    })();
    expect((failed as { content: { text: string }[] }).content[0].text).toBe('lỗi thật của tool');
  });
});
