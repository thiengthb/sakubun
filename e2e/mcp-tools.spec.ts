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

import { createHash } from 'node:crypto';
import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { E2E_BASE_URL, E2E_DB_FILE, E2E_EMAIL, seedE2eAccount } from './fixtures';

const MCP_TOKEN = ['e2e', 'smoke', 'token', '0123456789'].join('-');
const MCP_URL = `${E2E_BASE_URL}/api/mcp`;
const HEADERS = {
  'content-type': 'application/json',
  accept: 'application/json, text/event-stream',
  authorization: `Bearer ${MCP_TOKEN}`,
};

/** JSON-RPC có thể về dạng SSE (`event: message\ndata: {...}`) hoặc JSON trần. */
function parseRpc(body: string): Record<string, unknown> {
  const line = body.split('\n').find((l) => l.startsWith('data:'));
  return JSON.parse(line ? line.slice(5).trim() : body) as Record<string, unknown>;
}

function openDb() {
  return new Database(path.join(process.cwd(), E2E_DB_FILE));
}

/**
 * Tài khoản + token, và DỌN SẠCH bảng học.
 *
 * Cả bộ e2e dùng chung một DB tạm, nên nếu không dọn thì kết quả ở đây phụ thuộc spec chạy trước —
 * và một lưới smoke phụ thuộc thứ tự file là lưới sẽ đỏ vì lý do không liên quan. Con trước cha (FK).
 */
async function seed(): Promise<void> {
  await seedE2eAccount();
  const db = openDb();
  const user = db.prepare('SELECT id FROM user WHERE email = ?').get(E2E_EMAIL) as
    | { id: string }
    | undefined;
  if (!user) throw new Error('chưa seed được tài khoản e2e');

  db.prepare('DELETE FROM mcp_key').run();
  db.prepare(
    `INSERT INTO mcp_key (id, userId, name, tokenHash, lastUsedAt, createdAt)
     VALUES ('mcpk-smoke', ?, 'smoke', ?, NULL, ?)`,
  ).run(user.id, createHash('sha256').update(MCP_TOKEN).digest('hex'), new Date().toISOString());

  for (const table of [
    'ReviewLog',
    'Sentence',
    'SrsState',
    'GroupMember',
    'Group',
    'Item',
    'CalibrationProposal',
    'LearnerNote',
    'LearnerAbility',
    'Settings',
  ]) {
    db.prepare(`DELETE FROM "${table}"`).run();
  }

  // Một calibration proposal dựng sẵn, vì KHÔNG có đường nào trong app tạo được nó ở đây:
  // `submit_review` chỉ gọi `recordCalibrationProposal` khi shadow thật sự đề xuất một thay đổi
  // (lib/practice.ts:1264 `if (calibration)`), và một lượt duy nhất chưa đủ bằng chứng — đo được:
  // lần chạy đầu của lưới này, `list_calibration_proposals` trả rỗng và `set_proposal_verdict` đỏ vì
  // id trống. Ép cho đủ bằng chứng nghĩa là gắn lưới smoke vào ngưỡng bên trong calibration; dựng
  // một hàng thì `set_proposal_verdict` có đường HẠNH PHÚC thật mà không cần biết ngưỡng đó là bao nhiêu.
  // `createdAt` để SQLite tự điền (DEFAULT CURRENT_TIMESTAMP) — không tự tay định dạng DateTime.
  db.prepare(
    `INSERT INTO "CalibrationProposal"
       (id, target, direction, fromValue, toValue, axis, measured, ability, observations, reason, sentenceId, verdict)
     VALUES ('prop-smoke', 'difficulty', 'up', '3', '4', 'receptive', 0.82, 1120, 12,
             'Bạn đang đúng nhiều hơn mức mẫu này nhắm tới — nâng độ khó một bậc chứ?', NULL, NULL)`,
  ).run();
  db.close();
}

async function rpc(
  api: APIRequestContext,
  method: string,
  params: unknown,
  id: number,
): Promise<Record<string, unknown>> {
  const res = await api.post(MCP_URL, {
    headers: HEADERS,
    data: { jsonrpc: '2.0', id, method, params },
  });
  expect(res.status(), `${method} phải trả 200: ${await res.text()}`).toBe(200);
  return parseRpc(await res.text());
}

interface ToolResult {
  text: string;
  isError: boolean;
}

let rpcId = 1000;

async function callTool(
  api: APIRequestContext,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const body = await rpc(api, 'tools/call', { name, arguments: args }, ++rpcId);
  const result = (body.result ?? {}) as { content?: { text?: string }[]; isError?: boolean };
  return { text: result.content?.[0]?.text ?? '', isError: result.isError === true };
}

/** JSON trong kết quả: `ok()` trả JSON trần, các tool người học đọc trả markdown + khối ```json. */
function toolJson(text: string): Record<string, unknown> {
  const fence = text.match(/```json\n([\s\S]*?)\n```/);
  try {
    return JSON.parse(fence ? fence[1] : text) as Record<string, unknown>;
  } catch {
    return {};
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

  await rpc(
    request,
    'initialize',
    { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'smoke', version: '0' } },
    1,
  );

  // ── Coverage: bảng trên phải phủ ĐÚNG bộ tool server đăng ký ─────────────
  const list = await rpc(request, 'tools/list', {}, 2);
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
  const db = openDb();
  try {
    db.prepare('DELETE FROM "CalibrationProposal"').run();
  } finally {
    db.close();
  }
});
