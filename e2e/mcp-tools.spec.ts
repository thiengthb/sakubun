import { expect, test } from '@playwright/test';
import {
  callTool,
  initializeMcp,
  openE2eDb,
  rpc,
  seedMcpAccount,
  toolJson,
} from './mcp-client';

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

interface Ctx {
  grammarItemId: string;
  vocabItemId: string;
  groupId: string;
  pendingSentenceId: string;
  proposalId: string;
}

type Step = {
  name: string;
  args: (ctx: Ctx) => Record<string, unknown>;
  capture?: (json: Record<string, unknown>, ctx: Ctx) => void;
  why?: string;
};

const STEPS: Step[] = [
  { name: 'ping', args: () => ({}) },
  { name: 'get_settings', args: () => ({}) },
  { name: 'get_stats', args: () => ({}) },
  { name: 'get_weak_report', args: () => ({}) },
  { name: 'get_review_load', args: () => ({ days: 3 }) },
  { name: 'get_library_health', args: () => ({}) },
  { name: 'get_protocol', args: () => ({ mode: 'practice' }) },
  { name: 'get_protocol', args: () => ({ mode: 'quiz' }) },
  { name: 'get_protocol', args: () => ({ mode: 'conversation' }) },
  {
    name: 'get_protocol',
    args: () => ({ mode: 'teachback' }),
    why: 'Bốn mode là bốn nhánh của PROTOCOL_BY_MODE — một mode thiếu chỉ nổ khi người học đổi kiểu luyện giữa buổi.',
  },

  {
    name: 'list_grammar',
    args: () => ({}),
    why: 'Kho vừa bị dọn sạch. Một tool chỉ chạy được khi CÓ dữ liệu thì chưa gọi là với tới được.',
  },
  { name: 'list_vocab', args: () => ({}) },
  { name: 'list_groups', args: () => ({}) },
  { name: 'get_due_items', args: () => ({}) },
  { name: 'get_quiz_items', args: () => ({}) },

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
    args: (ctx) => ({ itemId: ctx.grammarItemId, add: { pitfalls: ['Đừng lẫn với 〜はずだ'] } }),
    why: 'patch MERGE (`add`), khác enrich_items GHI ĐÈ — chạy sau nó để cả hai nhánh đều được chạm.',
  },
  {
    name: 'enrich_items',
    args: (ctx) => ({
      items: [
        {
          itemId: ctx.vocabItemId,
          enrichment: {
            usage: 'Thuốc lá; danh từ, dùng với 吸う chứ không dùng với 飲む.',
            collocations: ['煙草を吸う', '煙草をやめる'],
            example: { ja: '父は煙草をやめました。', vi: 'Bố tôi đã bỏ thuốc.' },
            examples: [{ ja: 'ここで煙草を吸ってもいいですか。', vi: 'Tôi hút thuốc ở đây được không?' }],
            pitfalls: ['Không nói 煙草を飲む — tiếng Nhật dùng 吸う.'],
            synonyms: [{ term: 'タバコ', reading: 'たばこ', vi: 'thuốc lá', note: 'cách viết katakana, phổ biến hơn.' }],
            antonyms: [],
          },
        },
      ],
    }),
    why: 'Nhánh TỪ VỰNG của enrich_items chưa từng được gọi trong lưới này.',
  },
  {
    name: 'patch_enrichment',
    args: (ctx) => ({
      itemId: ctx.vocabItemId,
      add: { antonyms: [{ term: '禁煙', reading: 'きんえん', vi: 'sự cấm/bỏ thuốc' }] },
    }),
    why: '`add.synonyms` / `add.antonyms` là field mới — chỉ gọi thật mới biết server có nhận hay không.',
  },
  {
    name: 'list_vocab',
    args: () => ({ quality: 'needs-work' }),
    capture: (json) => {
      const rows = ((json.items ?? json) as { expression: string }[]) ?? [];
      expect(
        rows.some((r) => r.expression === '煙草'),
        `từ vừa được soạn thẻ ĐỦ không được nằm trong danh sách cần làm: ${JSON.stringify(rows)}`,
      ).toBe(false);
    },
    why: 'Vòng quét chỉ đóng được khi thẻ vừa ghi thôi báo là "cần làm" — lỗi v1-mãi-mãi của saveEnrichments.',
  },
  { name: 'update_grammar', args: (ctx) => ({ itemId: ctx.grammarItemId, level: 'N2' }) },
  { name: 'update_vocab', args: (ctx) => ({ itemId: ctx.vocabItemId, meaningVi: 'thuốc lá (danh từ)' }) },
  { name: 'update_settings', args: () => ({ grammarLevels: ['N3', 'N2'] }) },

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

  {
    name: 'set_item_suspended',
    args: (ctx) => ({ itemId: ctx.grammarItemId, suspended: false }),
    why: '`false` chứ không `true`: treo item ở giữa lưới sẽ làm các tool đọc phía sau thấy một kho khác.',
  },
  { name: 'set_below_target_suspended', args: () => ({ suspended: false }) },
];

test('mọi tool MCP đều gọi được qua HTTP thật, không cái nào nổ', async ({ request }) => {
  test.setTimeout(180_000);
  await seed();

  await initializeMcp(request);

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
      failures.push(`${step.name}(${JSON.stringify(args).slice(0, 120)}) → ${res.text.slice(0, 200)}`);
      continue;
    }
    step.capture?.(toolJson(res.text), ctx);
  }

  expect(failures, `Tool trả lỗi:\n  ${failures.join('\n  ')}`).toEqual([]);
});

test.afterEach(() => {
  const db = openE2eDb();
  try {
    db.prepare('DELETE FROM "CalibrationProposal"').run();
  } finally {
    db.close();
  }
});

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
