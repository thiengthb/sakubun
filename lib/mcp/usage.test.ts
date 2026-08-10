// Đếm việc dùng tool MCP — lưới cho lib/mcp/usage.ts, chạy trên DB thật (migration đã commit).
//
// Vì sao có file này (2026-08-11): bảng `mcp_tool_call` tồn tại để trả lời hai câu mà log stdout không
// trả lời được sau khi container restart — "Claude thật sự gọi tool nào" (issue #20) và "tool nào đang
// hỏng trong im lặng" (tool ném lỗi vẫn trả HTTP 200). Một bộ đếm đếm SAI thì tệ hơn không có bộ đếm:
// nó biến một câu hỏi mở thành một câu trả lời tự tin và lệch. Nên mọi phép cộng ở đây đều được đo.
//
// Ca cuối là ca đắt nhất: nó đi qua ĐÚNG đường production dùng — `guard()` + recorder được nối như
// `lib/mcp/server.ts` nối — vì một bộ đếm đúng mà không được cắm vào đâu thì cũng không đếm gì.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb } from '@/lib/test-db';
import { MCP_CATALOG } from '@/lib/mcp/catalog';

createTestDb('sakubun-mcp-usage-');

type Usage = typeof import('@/lib/mcp/usage');
type Kit = typeof import('@/lib/mcp/tool-kit');
type Db = typeof import('@/lib/db');

let U: Usage;
let K: Kit;
let prisma: Db['prisma'];

// `tool-kit` cũng phải nạp ĐỘNG, không phải import tĩnh: nó với tới `@/lib/db` qua render.ts →
// dossier.ts, và mọi import tĩnh đều chạy TRƯỚC `createTestDb()` — Prisma singleton sẽ bind vào
// `prisma/dev.db` rồi mọi phép chốt dưới đây đo sai cơ sở dữ liệu (AGENTS.md §Gotchas).
beforeEach(async () => {
  U ??= await import('@/lib/mcp/usage');
  K ??= await import('@/lib/mcp/tool-kit');
  prisma ??= (await import('@/lib/db')).prisma;
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
    // Đặt mốc đầu về quá khứ để phép chốt không phụ thuộc vào việc hai lời gọi cách nhau bao nhiêu ms.
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
    await U.recordToolCall('submit_review', 40, 'thiếu một hàng LearnerAbility trong cơ sở dữ liệu');

    const row = await prisma.mcpToolCall.findUniqueOrThrow({ where: { name: 'submit_review' } });
    expect(row.calls, 'một lời gọi hỏng vẫn LÀ một lời gọi').toBe(1);
    expect(row.errors).toBe(1);
    expect(row.lastError).toContain('LearnerAbility');
    expect(row.lastErrorAt).not.toBeNull();
  });

  it('gọi thành công SAU đó không xoá dấu vết lỗi cũ', async () => {
    // Cố ý: đây là ca của bug 2026-08-08. `submit_review` hỏng cả buổi rồi được sửa; nếu lần thành công
    // đầu tiên xoá sạch errors + lastError thì bảng này trở thành "mọi thứ đều ổn" đúng lúc người ta
    // cần biết vừa có gì đó rất không ổn.
    await U.recordToolCall('submit_review', 40, 'P2025');
    await U.recordToolCall('submit_review', 18);

    const row = await prisma.mcpToolCall.findUniqueOrThrow({ where: { name: 'submit_review' } });
    expect(row.calls).toBe(2);
    expect(row.errors, 'số lần hỏng là tích luỹ').toBe(1);
    expect(row.lastError, 'lời của lỗi phải còn — nó là bằng chứng duy nhất sau khi log biến mất').toBe(
      'P2025',
    );
  });

  it('lỗi dài bị cắt, để một stack trace không phình bảng đếm', async () => {
    await U.recordToolCall('add_vocab', 5, 'x'.repeat(5000));

    const row = await prisma.mcpToolCall.findUniqueOrThrow({ where: { name: 'add_vocab' } });
    expect(row.lastError!.length).toBe(400);
  });
});

describe('readToolUsage', () => {
  it('tool bận nhất lên trước, và tool CHƯA BAO GIỜ được gọi được nêu tên', async () => {
    await U.recordToolCall('check_library', 10);
    await U.recordToolCall('check_library', 10);
    await U.recordToolCall('check_library', 10);
    await U.recordToolCall('submit_review', 20);

    const report = await U.readToolUsage();
    expect(report.rows.map((r) => r.name)).toEqual(['check_library', 'submit_review']);
    expect(report.rows[0].calls).toBe(3);

    const catalogTools = MCP_CATALOG.filter((e) => e.kind === 'tool').map((e) => e.name);
    expect(report.toolCount, 'mẫu số là số tool bản đồ đang quảng cáo').toBe(catalogTools.length);
    expect(report.neverCalled, 'đúng phần bù, không phải một danh sách viết tay').toEqual(
      catalogTools.filter((n) => n !== 'check_library' && n !== 'submit_review'),
    );
    // Câu trả lời cho P4 nằm ở đây: 2 tool được dùng, 29 tool chưa từng — nhưng chỉ sau khi bảng này
    // sống qua vài buổi luyện THẬT. Phép chốt dưới đây chỉ giữ cho hai vế luôn cộng lại đủ.
    expect(report.rows.length + report.neverCalled.length).toBe(report.toolCount);
  });

  it('hàng của một tool đã bị đổi tên/xoá không bị giấu, mà bị ĐÁNH DẤU', async () => {
    // Sau một lần đổi tên tool, hàng cũ vẫn còn số đếm thật của nó. Bỏ nó đi thì mất lịch sử; trộn nó
    // vào như tool đang sống thì "31 tool" biến thành 32. Nên: vẫn hiện, và nói rõ là không còn.
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
    expect(row.lastMs, 'thời gian có thể là 0 ms, nhưng phải là một con số').toBeGreaterThanOrEqual(0);
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
