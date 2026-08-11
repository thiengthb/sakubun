// LƯỚI SMOKE CHO CẢ BỀ MẶT MCP — mọi tool phải GỌI ĐƯỢC qua HTTP thật.
//
// Vì sao file này tồn tại (2026-08-10). Server đăng ký 31 tool. Trước hôm nay, trong 31 cái đó đúng
// HAI cái từng được gọi qua HTTP trong bất cứ test nào: `ping` và `list_calibration_proposals`. Con bug
// làm mất lượt luyện của người học sống sót qua 671 unit test vì `submit_review` — tool được chạm mỗi
// lượt — chưa từng được gọi. 29 tool còn lại vẫn đang ở đúng tình trạng đó.
//
// Và bề mặt này hỏng IM LẶNG: `guard()` trong lib/mcp/tool-kit.ts biến mọi exception thành
// `isError: true` với HTTP **200** (cố ý — để Claude đọc được lời lỗi thay vì một -32603 trần). Nên
// một tool hỏng hoàn toàn vẫn cho `curl` mã 200, `/api/health` vẫn xanh, `npm run verify` vẫn xanh.
// Phép kiểm duy nhất có nghĩa là GỌI nó và soi `isError`.
//
// Cái này KHÔNG kiểm: liệu Claude có tuân thủ protocol dạy học, mô tả tool có lái nó đúng hướng. Đó là
// inferential — cần một buổi thật trên Claude Desktop và một người đọc output (chỗ của `evals/`).
// Ở đây chỉ chốt phần tất định: tool nhận được tham số, chạy, và không nổ.
//
// COVERAGE KHÔNG ĐƯỢC PHÉP IM LẶNG. Danh sách dưới được đối chiếu với `tools/list` của server: thêm
// một tool mà quên payload → test ĐỎ kèm tên tool, chứ không âm thầm bỏ qua nó.

import { expect, test } from '@playwright/test';
import {
  callTool,
  initializeMcp,
  openE2eDb,
  rpc,
  seedMcpAccount,
  toolJson,
} from './mcp-client';

/**
 * Tài khoản + token + kho sạch (`seedMcpAccount`), CỘNG một calibration proposal dựng sẵn.
 *
 * Vì sao phải dựng tay: KHÔNG có đường nào trong app tạo được nó ở đây. `submit_review` chỉ gọi
 * `recordCalibrationProposal` khi shadow thật sự đề xuất một thay đổi (lib/practice.ts, `if
 * (calibration)`), và một lượt duy nhất chưa đủ bằng chứng — đo được: lần chạy đầu của lưới này,
 * `list_calibration_proposals` trả rỗng và `set_proposal_verdict` đỏ vì id trống. Ép cho đủ bằng
 * chứng nghĩa là gắn lưới smoke vào ngưỡng bên trong calibration; dựng một hàng thì
 * `set_proposal_verdict` có đường HẠNH PHÚC thật mà không cần biết ngưỡng đó là bao nhiêu.
 * `createdAt` để SQLite tự điền (DEFAULT CURRENT_TIMESTAMP) — không tự tay định dạng DateTime.
 */
async function seed(): Promise<void> {
  await seedMcpAccount();
  const db = openE2eDb();
  try {
    db.prepare(
      `INSERT INTO "CalibrationProposal"
         (id, target, direction, fromValue, toValue, axis, measured, ability, observations, reason, sentenceId, verdict)
       VALUES ('prop-smoke', 'difficulty', 'up', '3', '4', 'receptive', 0.82, 1120, 12,
               'Bạn đang đúng nhiều hơn mức mẫu này nhắm tới — nâng độ khó một bậc chứ?', NULL, NULL)`,
    ).run();
  } finally {
    db.close();
  }
}

/** Id do các bước trước sinh ra, cho các bước sau dùng. */
interface Ctx {
  grammarItemId: string;
  vocabItemId: string;
  groupId: string;
  pendingSentenceId: string;
  proposalId: string;
}

type Step = {
  /** Tên tool đúng như server đăng ký. */
  name: string;
  /** Tham số. Hàm để đọc được id sinh ra ở bước trước. */
  args: (ctx: Ctx) => Record<string, unknown>;
  /** Lấy id ra khỏi kết quả cho các bước sau. */
  capture?: (json: Record<string, unknown>, ctx: Ctx) => void;
  /** Vì sao bước này đứng ở đây, khi thứ tự là điều kiện đúng đắn chứ không phải tuỳ ý. */
  why?: string;
};

/**
 * THỨ TỰ CÓ Ý NGHĨA: tool tạo dữ liệu đứng trước tool cần dữ liệu đó. Mỗi bước chạy đúng một lần,
 * tuần tự, và chia sẻ một `ctx` duy nhất.
 */
const STEPS: Step[] = [
  // ── không phụ thuộc gì ────────────────────────────────────────────────────
  { name: 'ping', args: () => ({}) },
  { name: 'get_settings', args: () => ({}) },
  { name: 'get_stats', args: () => ({}) },
  { name: 'get_weak_report', args: () => ({}) },
  { name: 'get_library_health', args: () => ({}) },
  { name: 'get_protocol', args: () => ({ mode: 'practice' }) },
  { name: 'get_protocol', args: () => ({ mode: 'quiz' }) },
  { name: 'get_protocol', args: () => ({ mode: 'conversation' }) },
  {
    name: 'get_protocol',
    args: () => ({ mode: 'teachback' }),
    why: 'Bốn mode là bốn nhánh của PROTOCOL_BY_MODE — một mode thiếu chỉ nổ khi người học đổi kiểu luyện giữa buổi.',
  },

  // ── kho rỗng: các tool đọc phải trả "rỗng hợp lệ", không phải lỗi ─────────
  {
    name: 'list_grammar',
    args: () => ({}),
    why: 'Kho vừa bị dọn sạch. Một tool chỉ chạy được khi CÓ dữ liệu thì chưa gọi là với tới được.',
  },
  { name: 'list_vocab', args: () => ({}) },
  { name: 'list_groups', args: () => ({}) },
  { name: 'get_due_items', args: () => ({}) },
  { name: 'get_quiz_items', args: () => ({}) },

  // ── thêm dữ liệu ─────────────────────────────────────────────────────────
  {
    name: 'preview_import',
    args: () => ({
      items: [{ kind: 'GRAMMAR', expression: 'SMOKE〜わけだ', meaningVi: 'thì ra là' }],
    }),
    why: 'DRY RUN — phải chạy được TRƯỚC khi kho có gì, vì đó đúng là lúc Claude gọi nó.',
  },
  {
    name: 'add_grammar',
    args: () => ({
      grammar: [
        {
          expression: 'SMOKE〜わけだ',
          reading: 'わけだ',
          meaningVi: 'thì ra là (kết luận hợp lý)',
          level: 'N3',
          notes: '動詞普通形 + わけだ',
        },
      ],
    }),
  },
  {
    name: 'add_vocab',
    args: () => ({ vocab: [{ term: '煙草', reading: 'たばこ', meaning: 'thuốc lá' }] }),
  },
  {
    name: 'list_grammar',
    args: () => ({}),
    capture: (json, ctx) => {
      const rows = ((json.items ?? json) as { itemId: string; expression: string }[]) ?? [];
      const row = rows.find((r) => r.expression === 'SMOKE〜わけだ');
      expect(row?.itemId, `list_grammar phải thấy mẫu vừa thêm: ${JSON.stringify(rows)}`).toBeTruthy();
      ctx.grammarItemId = row!.itemId;
    },
    why: 'Gọi lại sau khi thêm: nó vừa là smoke, vừa là chỗ lấy itemId thật cho mọi bước sau.',
  },
  {
    name: 'list_vocab',
    args: () => ({}),
    capture: (json, ctx) => {
      const rows = ((json.items ?? json) as { itemId: string; expression: string }[]) ?? [];
      expect(rows.length, 'list_vocab phải thấy từ vừa thêm').toBeGreaterThan(0);
      ctx.vocabItemId = rows[0].itemId;
    },
  },
  { name: 'check_library', args: () => ({ query: 'SMOKE〜わけだ' }) },

  // ── sửa dữ liệu đã có ────────────────────────────────────────────────────
  {
    name: 'enrich_items',
    args: (ctx) => ({
      items: [
        {
          itemId: ctx.grammarItemId,
          enrichment: {
            usage: 'Dùng khi rút ra kết luận hợp lý từ điều vừa biết.',
            example: { ja: '道が混んでいるわけだ。', vi: 'Thì ra là đường đang tắc.' },
          },
        },
      ],
    }),
  },
  {
    name: 'patch_enrichment',
    // `add` / `set`, KHÔNG phải field phẳng: bản đầu của lưới này gửi `pitfalls` ở gốc và tool trả
    // "NOTHING was written ... hoặc tham số rỗng" — nó bỏ qua key nó không biết. Lỗi của test, không
    // của app, nhưng đáng ghi: một payload sai kiểu này trông y như một tool hỏng.
    args: (ctx) => ({ itemId: ctx.grammarItemId, add: { pitfalls: ['Đừng lẫn với 〜はずだ'] } }),
    why: 'patch MERGE (`add`), khác enrich_items GHI ĐÈ — chạy sau nó để cả hai nhánh đều được chạm.',
  },
  { name: 'update_grammar', args: (ctx) => ({ itemId: ctx.grammarItemId, level: 'N2' }) },
  { name: 'update_vocab', args: (ctx) => ({ itemId: ctx.vocabItemId, meaningVi: 'thuốc lá (danh từ)' }) },
  { name: 'update_settings', args: () => ({ grammarLevels: ['N3', 'N2'] }) },

  // ── nhóm ─────────────────────────────────────────────────────────────────
  {
    name: 'create_group',
    args: () => ({ name: 'Nhóm smoke' }),
    capture: (json, ctx) => {
      const id = (json.groupId ?? (json.group as { id?: string } | undefined)?.id ?? json.id) as
        | string
        | undefined;
      expect(id, `create_group phải trả id: ${JSON.stringify(json)}`).toBeTruthy();
      ctx.groupId = id!;
    },
  },
  {
    name: 'add_items_to_group',
    args: (ctx) => ({ groupId: ctx.groupId, itemIds: [ctx.grammarItemId] }),
  },
  { name: 'suggest_group', args: (ctx) => ({ name: 'Gợi ý smoke', itemIds: [ctx.grammarItemId] }) },
  {
    name: 'remove_items_from_group',
    args: (ctx) => ({ groupId: ctx.groupId, itemIds: [ctx.grammarItemId] }),
  },

  // ── vòng luyện ───────────────────────────────────────────────────────────
  {
    name: 'stage_sentence',
    args: (ctx) => ({
      direction: 'JA_VI',
      sourceText: '道が混んでいるわけだ。',
      suggested: 'Thì ra là đường đang tắc.',
      items: [{ itemId: ctx.grammarItemId, role: 'TARGET' }],
    }),
    capture: (json, ctx) => {
      ctx.pendingSentenceId = json.sentenceId as string;
      expect(ctx.pendingSentenceId, 'stage_sentence phải trả sentenceId').toBeTruthy();
    },
  },
  {
    name: 'submit_review',
    args: (ctx) => ({
      sentenceId: ctx.pendingSentenceId,
      userAnswer: 'Thì ra đường đang tắc.',
      ratings: [{ itemId: ctx.grammarItemId, rating: 3, role: 'TARGET' }],
      // `score` bắt buộc từ 2026-08-11: một lượt không có điểm là một lượt người học đọc thành "app
      // không chấm". Thiếu nó thì SDK chặn ở -32602, trước cả handler.
      score: 72,
    }),
    why: 'Tool duy nhất ghi lịch FSRS. Nó cũng sinh ra calibration proposal cho bước dưới.',
  },
  {
    name: 'stage_sentence',
    args: (ctx) => ({
      direction: 'JA_VI',
      sourceText: '雨が降っているわけだ。',
      suggested: 'Thì ra là đang mưa.',
      items: [{ itemId: ctx.grammarItemId, role: 'TARGET' }],
    }),
    capture: (json, ctx) => {
      ctx.pendingSentenceId = json.sentenceId as string;
    },
    why: 'Câu thứ hai chỉ để `skip_sentence` có một câu PENDING thật mà bỏ — một câu đã GRADED thì nó không áp dụng.',
  },
  { name: 'skip_sentence', args: (ctx) => ({ sentenceId: ctx.pendingSentenceId }) },

  // ── calibration: nửa đọc và nửa duyệt ────────────────────────────────────
  {
    name: 'list_calibration_proposals',
    args: () => ({}),
    capture: (json, ctx) => {
      const list = (json.proposals ?? []) as { id: string }[];
      const seeded = list.find((p) => p.id === 'prop-smoke');
      expect(
        seeded,
        `nửa ĐỌC của calibration phải trả về hàng đã dựng: ${JSON.stringify(list)}`,
      ).toBeTruthy();
      ctx.proposalId = seeded!.id;
    },
    why: 'Nửa ĐỌC của calibration. Nó cũng chứng minh hàng dựng ở seed() đọc ra được — tức DateTime do SQLite điền được Prisma đọc đúng.',
  },
  {
    name: 'set_proposal_verdict',
    args: (ctx) => ({ id: ctx.proposalId, verdict: 'agree' }),
  },

  // ── treo/bỏ treo: để CUỐI, vì nó đổi trạng thái cả kho ───────────────────
  {
    name: 'set_item_suspended',
    args: (ctx) => ({ itemId: ctx.grammarItemId, suspended: false }),
    why: '`false` chứ không `true`: treo item ở giữa lưới sẽ làm các tool đọc phía sau thấy một kho khác.',
  },
  { name: 'set_below_target_suspended', args: () => ({ suspended: false }) },
];

test('mọi tool MCP đều gọi được qua HTTP thật, không cái nào nổ', async ({ request }) => {
  // 31 tool, vài cái gọi nhiều lần (get_protocol 4 mode) — ngân sách rộng hơn mặc định 60s.
  test.setTimeout(180_000);
  await seed();

  await initializeMcp(request);

  // ── Coverage: bảng trên phải phủ ĐÚNG bộ tool server đăng ký ─────────────
  const list = await rpc(request, 'tools/list', {});
  const advertised = ((list.result as { tools?: { name: string }[] })?.tools ?? []).map(
    (t) => t.name,
  );
  const covered = new Set(STEPS.map((s) => s.name));
  const uncovered = advertised.filter((n) => !covered.has(n));
  expect(
    uncovered,
    'Tool này server có đăng ký nhưng lưới smoke KHÔNG gọi — thêm một bước vào STEPS. Một lưới ' +
      `bỏ qua tool trong im lặng đọc như là đã phủ hết:\n  ${uncovered.join('\n  ')}`,
  ).toEqual([]);
  const ghosts = [...covered].filter((n) => !advertised.includes(n));
  expect(ghosts, `Lưới gọi tool mà server không đăng ký: ${ghosts.join(', ')}`).toEqual([]);
  expect(advertised.length, 'phải có tool để mà gọi').toBeGreaterThan(20);

  // ── Gọi từng bước, tuần tự ───────────────────────────────────────────────
  const ctx: Ctx = {
    grammarItemId: '',
    vocabItemId: '',
    groupId: '',
    pendingSentenceId: '',
    proposalId: '',
  };
  const failures: string[] = [];

  for (const step of STEPS) {
    const args = step.args(ctx);
    const res = await callTool(request, step.name, args);
    if (res.isError) {
      // Gom hết rồi báo một lần: một lần chạy nên nói ra MỌI tool đang hỏng, không phải cái đầu tiên.
      failures.push(`${step.name}(${JSON.stringify(args).slice(0, 120)}) → ${res.text.slice(0, 200)}`);
      continue;
    }
    step.capture?.(toolJson(res.text), ctx);
  }

  expect(failures, `Tool trả lỗi:\n  ${failures.join('\n  ')}`).toEqual([]);
});

// DỌN hàng proposal đã dựng, và đây không phải sự sạch sẽ hình thức: `e2e/mcp.spec.ts` chạy SAU spec
// này (thứ tự chữ cái) và chốt rằng `list_calibration_proposals` trả về rỗng — "DB e2e không có
// proposal nào, nên phong bì phải là rỗng hợp lệ". Không dọn thì `prop-smoke` rò sang đó và làm nó ĐỎ
// vì một lý do không liên quan gì tới nó. Đo được khi chạy CẢ bộ: mcp.spec.ts:145 đỏ, 33 ca còn lại
// xanh — và tôi chỉ thấy vì đã chạy full suite thay vì chạy riêng spec này.
//
// `afterEach` chứ không phải dòng cuối trong test body: hook vẫn chạy khi test ĐỎ, còn dòng cuối thì
// không — và một spec chỉ dọn khi nó thành công là một spec làm hỏng cả bộ đúng lúc đang có lỗi.
test.afterEach(() => {
  const db = openE2eDb();
  try {
    db.prepare('DELETE FROM "CalibrationProposal"').run();
  } finally {
    db.close();
  }
});

/**
 * NGÂN SÁCH BỀ MẶT — đo bằng BYTE, không đếm tool.
 *
 * `harness.config.json → mcp.maxTools: 20` đếm TOOL, trong khi thuế Claude trả là TOKEN, và không có
 * gì trong repo đọc ngưỡng đó (issue #5). Kết quả: một ngưỡng đo sai đơn vị, không ai cưỡng chế. 31
 * tool ở đây nặng ~53 KB, nhưng 20 tool toàn loại nặng thì còn nặng hơn — nên "cắt cho đủ 20" là tối
 * ưu sai chỗ, đúng điều issue #20 đo được.
 *
 * Phép chốt này là **computational control** thay cho ngưỡng chết đó: `tools/list` là thứ Claude tải
 * MỖI PHIÊN, nên nó là ngân sách thật. Trần đặt cao hơn số hiện tại một khoảng để việc thêm một tool
 * bình thường không đỏ; vượt trần thì phải là một hành động CÓ Ý THỨC (đọc bảng phân tích đính kèm,
 * rồi sửa con số này kèm lý do), chứ không phải một lần phình ra không ai thấy.
 *
 * Đo được 2026-08-11: **52.221 byte / 31 tool** (trước hôm nay là 55.576 — chênh lệch là bản sao
 * schema nested trong `update_settings` và hai mô tả chết mà #22 bỏ). Trần dưới đây chừa ~7%.
 */
const SURFACE_BUDGET_BYTES = 56_000;

test('ngân sách bề mặt tool: tools/list phải nằm trong trần BYTE', async ({ request }, testInfo) => {
  await seed();
  await initializeMcp(request);

  const list = await rpc(request, 'tools/list', {});
  const tools = ((list.result as { tools?: Record<string, unknown>[] })?.tools ?? []).map((t) => ({
    name: String(t.name),
    total: JSON.stringify(t).length,
    description: String(t.description ?? '').length,
    schema: JSON.stringify(t.inputSchema ?? {}).length,
  }));
  expect(tools.length, 'phải có tool để mà đo').toBeGreaterThan(20);

  const total = tools.reduce((sum, t) => sum + t.total, 0);
  const heaviest = [...tools].sort((a, b) => b.total - a.total);

  // Đính kèm bảng phân tích: khi phép chốt này đỏ, câu hỏi tiếp theo luôn là "byte nằm ở đâu", và câu
  // trả lời phải nằm ngay trong báo cáo chứ không phải trong một lần đo lại bằng tay.
  await testInfo.attach('mcp-surface.txt', {
    contentType: 'text/plain',
    body:
      `TỔNG: ${total} byte · ${tools.length} tool · trần ${SURFACE_BUDGET_BYTES}\n\n` +
      heaviest
        .map((t) => `${String(t.total).padStart(6)}  ${t.name}  (desc ${t.description} · schema ${t.schema})`)
        .join('\n'),
  });

  expect(
    total,
    `tools/list = ${total} byte, vượt trần ${SURFACE_BUDGET_BYTES}. Xem attachment ` +
      '"mcp-surface.txt" để biết byte nằm ở tool nào trước khi nâng trần.',
  ).toBeLessThanOrEqual(SURFACE_BUDGET_BYTES);
});
