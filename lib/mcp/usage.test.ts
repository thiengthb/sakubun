import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb } from '@/lib/db/test-db';
import { MCP_CATALOG } from '@/lib/mcp/catalog';

createTestDb('sakubun-mcp-usage-');

type Usage = typeof import('@/lib/mcp/usage');
type Kit = typeof import('@/lib/mcp/tool-kit');
type Db = typeof import('@/lib/db/db');

let U: Usage;
let K: Kit;
let prisma: Db['prisma'];

beforeEach(async () => {
  U ??= await import('@/lib/mcp/usage');
  K ??= await import('@/lib/mcp/tool-kit');
  prisma ??= (await import('@/lib/db/db')).prisma;
  await prisma.mcpToolCall.deleteMany({});
  K.setToolCallRecorder(null);
});

describe('recordToolCall', () => {
  it('lời gọi đầu tiên tạo hàng, lời gọi sau CỘNG vào chứ không ghi đè', async () => {
    await U.recordToolCall('get_due_items', 12);
    await U.recordToolCall('get_due_items', 30);
    await U.recordToolCall('get_due_items', 7);

    const row = await prisma.mcpToolCall.findUniqueOrThrow({ where: { name: 'get_due_items' } });
    expect(row.calls, 'ba lần gọi = ba').toBe(3);
    expect(row.errors).toBe(0);
    expect(row.lastMs, 'lastMs là lần GẦN NHẤT, không phải lần đầu hay tổng').toBe(7);
    expect(row.lastError).toBeNull();
    expect(row.lastErrorAt).toBeNull();
  });

  it('firstCalledAt là mốc ĐẦU, và không bị lời gọi sau dịch đi', async () => {
    await U.recordToolCall('ping', 1);
    const long = new Date('2026-01-01T00:00:00Z');
    await prisma.mcpToolCall.update({ where: { name: 'ping' }, data: { firstCalledAt: long } });

    await U.recordToolCall('ping', 2);

    const row = await prisma.mcpToolCall.findUniqueOrThrow({ where: { name: 'ping' } });
    expect(row.firstCalledAt.toISOString()).toBe(long.toISOString());
    expect(
      row.lastCalledAt.getTime(),
      'lastCalledAt thì PHẢI dịch — nếu không thì "tool này còn được dùng không" mất câu trả lời',
    ).toBeGreaterThan(long.getTime());
  });

  it('một lời gọi hỏng cộng errors và giữ lại lời của lỗi', async () => {
    await U.recordToolCall(
      'submit_review',
      40,
      'thiếu một hàng LearnerAbility trong cơ sở dữ liệu',
    );

    const row = await prisma.mcpToolCall.findUniqueOrThrow({ where: { name: 'submit_review' } });
    expect(row.calls, 'một lời gọi hỏng vẫn LÀ một lời gọi').toBe(1);
    expect(row.errors).toBe(1);
    expect(row.lastError).toContain('LearnerAbility');
    expect(row.lastErrorAt).not.toBeNull();
  });

  it('gọi thành công SAU đó không xoá dấu vết lỗi cũ', async () => {
    await U.recordToolCall('submit_review', 40, 'P2025');
    await U.recordToolCall('submit_review', 18);

    const row = await prisma.mcpToolCall.findUniqueOrThrow({ where: { name: 'submit_review' } });
    expect(row.calls).toBe(2);
    expect(row.errors, 'số lần hỏng là tích luỹ').toBe(1);
    expect(
      row.lastError,
      'lời của lỗi phải còn — nó là bằng chứng duy nhất sau khi log biến mất',
    ).toBe('P2025');
  });

  it('lỗi dài bị cắt, để một stack trace không phình bảng đếm', async () => {
    await U.recordToolCall('add_vocab', 5, 'x'.repeat(5000));

    const row = await prisma.mcpToolCall.findUniqueOrThrow({ where: { name: 'add_vocab' } });
    expect(row.lastError!.length).toBe(400);
  });
});

describe('readToolUsage', () => {
  it('tool bận nhất lên trước, và tool CHƯA BAO GIỜ được gọi được nêu tên', async () => {
    await U.recordToolCall('next_turn', 10);
    await U.recordToolCall('next_turn', 10);
    await U.recordToolCall('next_turn', 10);
    await U.recordToolCall('grade_turn', 20);

    const report = await U.readToolUsage();
    expect(report.rows.map((r) => r.name)).toEqual(['next_turn', 'grade_turn']);
    expect(report.rows[0].calls).toBe(3);

    const catalogTools = MCP_CATALOG.filter((e) => e.kind === 'tool').map((e) => e.name);
    expect(report.toolCount, 'mẫu số là số tool bản đồ đang quảng cáo').toBe(catalogTools.length);
    expect(report.neverCalled, 'đúng phần bù, không phải một danh sách viết tay').toEqual(
      catalogTools.filter((n) => n !== 'next_turn' && n !== 'grade_turn'),
    );
    expect(report.rows.length + report.neverCalled.length).toBe(report.toolCount);
  });

  it('hàng của một tool đã bị đổi tên/xoá không bị giấu, mà bị ĐÁNH DẤU', async () => {
    await U.recordToolCall('fork_shared_items', 9);

    const report = await U.readToolUsage();
    const row = report.rows.find((r) => r.name === 'fork_shared_items');
    expect(row?.inCatalog).toBe(false);
    expect(report.neverCalled, 'nó KHÔNG phải một tool chưa được gọi').not.toContain(
      'fork_shared_items',
    );
  });

  it('kho rỗng: chưa gọi gì thì mọi tool đều là chưa gọi', async () => {
    const report = await U.readToolUsage();
    expect(report.rows).toEqual([]);
    expect(report.neverCalled.length).toBe(report.toolCount);
  });
});

describe('guard + recorder, nối đúng như server.ts nối', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    K.setToolCallRecorder(U.recordToolCall);
  });

  it('một tool chạy xong được đếm, dưới đúng tên của nó', async () => {
    const tool = K.guard('get_stats', async () => ({ total: 1 }));
    await tool();

    const row = await prisma.mcpToolCall.findUniqueOrThrow({ where: { name: 'get_stats' } });
    expect(row.calls).toBe(1);
    expect(row.errors).toBe(0);
    expect(row.lastMs, 'thời gian có thể là 0 ms, nhưng phải là một con số').toBeGreaterThanOrEqual(
      0,
    );
  });

  it('một tool ném lỗi được đếm là hỏng, kèm lời của lỗi thật', async () => {
    const tool = K.guard('stage_sentence', async () => {
      throw new Error('bộ phương án quiz bị trùng');
    });
    const res = (await tool()) as { isError?: boolean };
    expect(res.isError, 'phía Claude vẫn nhận soft error như trước').toBe(true);

    const row = await prisma.mcpToolCall.findUniqueOrThrow({ where: { name: 'stage_sentence' } });
    expect(row.calls).toBe(1);
    expect(row.errors).toBe(1);
    expect(row.lastError).toBe('bộ phương án quiz bị trùng');
  });
});
