import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { guard, setToolCallRecorder } from '@/lib/mcp/tool-kit';

function p2025(modelName?: string): Error {
  const e = new Error(
    'An operation failed because it depends on one or more records that were required but not found.',
  ) as Error & { code: string; meta?: unknown };
  e.code = 'P2025';
  if (modelName !== undefined) e.meta = { modelName, operation: 'an update' };
  return e;
}

async function textFromThrow(err: unknown): Promise<string> {
  const tool = guard('test_tool', async () => {
    throw err;
  });
  const res = (await tool()) as { content: { text: string }[]; isError?: boolean };
  expect(res.isError, 'lỗi phải về dạng soft error, không phải throw ra ngoài').toBe(true);
  return res.content[0].text;
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('guard — P2025 nói đúng hàng nào thiếu', () => {
  it('một bảng phía server: nêu tên bảng, và CẤM thử lại', async () => {
    const text = await textFromThrow(p2025('LearnerAbility'));

    expect(text).toContain('LearnerAbility');
    expect(text, 'không được đổ lỗi cho itemId').not.toContain('itemId');
    expect(text.toLowerCase(), 'phải nói rõ là đừng thử lại').toContain('đừng thử lại');
  });

  it('một id do máy khách gửi: chỉ lối hồi phục bằng tool v2', async () => {
    for (const model of ['Item', 'SrsState']) {
      const text = await textFromThrow(p2025(model));
      expect(text, model).toContain('Call lookup or next_turn');
      expect(text, `${model}: không cấm thử lại, vì thử lại đúng là cách hồi phục`).not.toContain(
        'ĐỪNG thử lại',
      );
    }
  });

  it('mỗi loại id có lối hồi phục riêng, trỏ tới tool thật', async () => {
    expect(await textFromThrow(p2025('Turn'))).toContain('Call next_turn, then stage_turn');
  });

  it('P2025 không kèm meta vẫn an toàn: không bịa tên bảng, vẫn cấm thử lại', async () => {
    const text = await textFromThrow(p2025());
    expect(text).toContain('(không rõ bảng)');
    expect(text.toLowerCase()).toContain('đừng thử lại');
    expect(text).not.toContain('itemId');
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

describe('guard — đếm việc dùng tool', () => {
  afterEach(() => {
    setToolCallRecorder(null);
  });

  it('không cắm recorder thì guard() KHÔNG ghi đi đâu cả', async () => {
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

    expect(seen[0][2]).toContain('[P2025 LearnerAbility]');
    expect(seen[0][2]).toContain('required but not found');
  });

  async function digestOf(err: unknown): Promise<string> {
    const seen: (string | null)[] = [];
    setToolCallRecorder(async (_n, _ms, error) => void seen.push(error));
    await guard('update_grammar', async () => {
      throw err;
    })();
    return seen[0]!;
  }

  it('dump của Prisma: giữ ĐÚNG dòng cuối, bỏ đường dẫn chunk và phần echo mã nguồn', async () => {
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
    const digest = await digestOf(
      new ZodError([
        { code: 'custom', path: ['ratings', 0, 'rating'], message: 'phải từ 1 tới 4' },
      ]),
    );

    expect(digest).toBe('[ZodError] ratings.0.rating: phải từ 1 tới 4');
  });

  it('một lỗi dài bất thường vẫn bị chặn độ dài, và phần giữ lại là phần ĐUÔI', async () => {
    const digest = await digestOf(new Error(`${'x'.repeat(5000)} câu cuối cùng`));

    expect(digest.length).toBe(300);
    expect(digest).toContain('câu cuối cùng');
    expect(digest.startsWith('…'), 'nói rõ là đã bị cắt, không giả vờ là nguyên văn').toBe(true);
  });

  it('recorder hỏng KHÔNG được làm hỏng lời gọi tool', async () => {
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
