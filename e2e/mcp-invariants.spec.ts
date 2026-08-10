// BA BẤT BIẾN CỦA LỊCH HỌC, kiểm qua bề mặt MCP thật.
//
// `AGENTS.md` phát biểu bất biến số 1 rất gọn: *"`submitReview()` trong `lib/practice.ts` là lối duy
// nhất TÍNH lịch FSRS. Route, component, MCP tool không được ghi `SrsState` trực tiếp."* Đó là một câu
// văn xuôi, và trước file này nó được gác ở đúng hai chỗ hẹp:
//
//   - `lib/mobile-imports.test.ts` — grep mã nguồn, chốt client KHÔNG có engine FSRS
//   - `lib/practice.test.ts` ("invariant 1") — chốt giá trị FSRS không đổi khi calibration cùng đường
//
// Không chỗ nào hỏi câu quan trọng nhất: **có tool MCP nào KHÁC đang đẩy lịch không?** 31 tool phơi ra
// cho Claude, và câu trả lời cho tới hôm nay là "chưa ai đo".
//
// Ba ca dưới đây cố ý KHÔNG trùng với tầng unit. Đã kiểm trước khi viết:
//   - hạn mức ngày (`dailyNewGrammar`) đã có `lib/select.test.ts` → KHÔNG viết lại ở đây.
//   - `suspended` KHÔNG xuất hiện lần nào trong `lib/select.test.ts` → đó là lỗ, nên ca 3 tồn tại.

import { expect, test, type APIRequestContext } from '@playwright/test';
import { callTool, callToolOk, initializeMcp, openE2eDb, seedMcpAccount } from './mcp-client';

const PATTERN = 'INV〜きらいがある';
const OTHER = 'INV〜あげく';

/** Hàng SrsState của một item, đủ mọi cột lịch — so sánh cả hàng, không so vài trường. */
function srsRow(itemId: string): Record<string, unknown> | undefined {
  const db = openE2eDb();
  try {
    return db
      .prepare(
        `SELECT due, stability, difficulty, scheduledDays, learningSteps, reps, lapses, state, lastReview
         FROM "SrsState" WHERE itemId = ?`,
      )
      .get(itemId) as Record<string, unknown> | undefined;
  } finally {
    db.close();
  }
}

function countRows(table: string, where = '1=1', ...params: unknown[]): number {
  const db = openE2eDb();
  try {
    return (
      db.prepare(`SELECT COUNT(*) AS n FROM "${table}" WHERE ${where}`).get(...params) as {
        n: number;
      }
    ).n;
  } finally {
    db.close();
  }
}

async function addPattern(api: APIRequestContext, expression: string): Promise<string> {
  await callToolOk(api, 'add_grammar', {
    grammar: [{ expression, meaningVi: 'nghĩa', level: 'N2' }],
  });
  const listed = await callToolOk(api, 'list_grammar', {});
  const rows = ((listed.items ?? listed) as { itemId: string; expression: string }[]) ?? [];
  const row = rows.find((r) => r.expression === expression);
  expect(row?.itemId, `list_grammar phải thấy ${expression}`).toBeTruthy();
  return row!.itemId;
}

/** Stage một câu rồi chấm nó — cặp lời gọi của một lượt thật. */
async function practiseOnce(api: APIRequestContext, itemId: string, sourceText: string) {
  const staged = await callToolOk(api, 'stage_sentence', {
    direction: 'JA_VI',
    sourceText,
    suggested: 'bản dịch tham khảo',
    items: [{ itemId, role: 'TARGET' }],
  });
  const sentenceId = staged.sentenceId as string;
  expect(sentenceId).toBeTruthy();
  await callToolOk(api, 'submit_review', {
    sentenceId,
    userAnswer: 'trả lời',
    ratings: [{ itemId, rating: 3, role: 'TARGET' }],
  });
  return sentenceId;
}

test('chấm hai lần bị TỪ CHỐI, và lần chấm đầu không bị sứt', async ({ request }) => {
  await seedMcpAccount();
  await initializeMcp(request);
  const itemId = await addPattern(request, PATTERN);
  const sentenceId = await practiseOnce(request, itemId, '油断するきらいがある。');

  const before = srsRow(itemId);
  expect(before, 'lượt đầu phải tạo hàng FSRS').toBeTruthy();

  // Cùng sentenceId, lần thứ hai. Mô tả tool nói "Ratings are final (a second call for an
  // already-graded sentence is rejected)" — một câu chưa từng được đo.
  const again = await callTool(request, 'submit_review', {
    sentenceId,
    userAnswer: 'đổi ý, chấm lại',
    ratings: [{ itemId, rating: 4, role: 'TARGET' }],
  });
  expect(again.isError, `chấm lại một câu đã GRADED phải bị từ chối: ${again.text}`).toBe(true);

  // Và quan trọng hơn việc bị từ chối: nó không được sứt gì. Một lần từ chối áp dụng NỬA VỜI còn tệ
  // hơn một lần chấp nhận — điểm sẽ lệch mà không ai biết.
  expect(srsRow(itemId), 'lịch FSRS phải y nguyên sau lần bị từ chối').toEqual(before);
  expect(countRows('ReviewLog', 'itemId = ?', itemId), 'không thêm ReviewLog').toBe(1);
  const db = openE2eDb();
  const sentence = db
    .prepare('SELECT status, userAnswer FROM "Sentence" WHERE id = ?')
    .get(sentenceId) as { status: string; userAnswer: string };
  db.close();
  expect(sentence.status).toBe('GRADED');
  expect(sentence.userAnswer, 'câu trả lời ĐẦU TIÊN phải được giữ').toBe('trả lời');
});

test('không tool nào NGOÀI submit_review đẩy được lịch FSRS (bất biến 1)', async ({ request }) => {
  await seedMcpAccount();
  await initializeMcp(request);
  const itemId = await addPattern(request, PATTERN);
  await practiseOnce(request, itemId, '油断するきらいがある。');

  const before = srsRow(itemId);
  const logsBefore = countRows('ReviewLog', 'itemId = ?', itemId);
  expect(before).toBeTruthy();
  expect(logsBefore).toBe(1);

  // Danh sách này là các tool GHI, cộng vài tool đọc đi cùng đường. Nó CỐ Ý không phải bản sao của
  // bảng 31 tool trong `mcp-tools.spec.ts`: spec đó sở hữu câu hỏi "mọi tool có gọi được không", spec
  // này sở hữu câu hỏi "có tool nào đẩy lịch không". Tool chỉ đọc không thể ghi, nên bắt chúng vào đây
  // sẽ làm ca này chậm mà không thêm tín hiệu — trừ vài cái đi qua cùng code path với scheduler.
  const group = await callToolOk(request, 'create_group', { name: 'Nhóm bất biến' });
  const groupId = (group.groupId ?? (group.group as { id?: string })?.id ?? group.id) as string;

  const staged = await callToolOk(request, 'stage_sentence', {
    direction: 'VI_JA',
    sourceText: 'Một câu để bỏ.',
    suggested: '捨てる文。',
    items: [{ itemId, role: 'TARGET' }],
  });

  const mutations: [string, Record<string, unknown>][] = [
    ['add_grammar', { grammar: [{ expression: OTHER, meaningVi: 'nghĩa khác', level: 'N2' }] }],
    ['update_grammar', { itemId, level: 'N1' }],
    [
      'enrich_items',
      {
        items: [
          {
            itemId,
            enrichment: {
              usage: 'Có khuynh hướng xấu nào đó.',
              example: { ja: '油断するきらいがある。', vi: 'Có khuynh hướng lơ là.' },
            },
          },
        ],
      },
    ],
    ['patch_enrichment', { itemId, add: { pitfalls: ['Đừng lẫn với 〜がちだ'] } }],
    ['add_items_to_group', { groupId, itemIds: [itemId] }],
    ['remove_items_from_group', { groupId, itemIds: [itemId] }],
    ['skip_sentence', { sentenceId: staged.sentenceId as string }],
    ['set_item_suspended', { itemId, suspended: true }],
    ['set_item_suspended', { itemId, suspended: false }],
    ['set_below_target_suspended', { suspended: false }],
    ['update_settings', { grammarLevels: ['N2', 'N1'] }],
    ['get_due_items', { maxItems: 5 }],
    ['get_quiz_items', {}],
    ['get_stats', {}],
    ['get_library_health', {}],
    ['get_weak_report', {}],
    ['check_library', { query: PATTERN }],
  ];

  for (const [name, args] of mutations) {
    const res = await callTool(request, name, args);
    // `skip_sentence` trên một câu đã bị auto-park, hay một tool từ chối vì trạng thái, đều là chuyện
    // của spec khác. Ở đây chỉ cần nó ĐÃ CHẠY — rồi lịch phải không đổi.
    expect(
      srsRow(itemId),
      `\`${name}\` đã đẩy lịch FSRS. Bất biến 1 nói chỉ submit_review được làm điều đó ` +
        `(AGENTS.md §Gotchas). Kết quả tool: ${res.text.slice(0, 160)}`,
    ).toEqual(before);
  }

  expect(countRows('ReviewLog', 'itemId = ?', itemId), 'ReviewLog chỉ được append bởi submit_review').toBe(
    logsBefore,
  );

  // Và chiều ngược lại, để ca này không xanh vì lịch bị đóng băng hoàn toàn: lối ghi THẬT vẫn ghi được.
  await practiseOnce(request, itemId, 'また油断するきらいがある。');
  const after = srsRow(itemId);
  expect(after, 'submit_review vẫn phải đẩy được lịch sau tất cả những lời gọi trên').not.toEqual(
    before,
  );
  expect(after!.reps, 'hai lượt đã chấm = hai rep').toBe(2);
});

test('item bị treo không bao giờ vào lô đến hạn, dù lô có đủ chỗ', async ({ request }) => {
  await seedMcpAccount();
  await initializeMcp(request);
  const suspended = await addPattern(request, PATTERN);
  await addPattern(request, OTHER);

  // Tiền đề nói THÀNH LỜI, không dựa vào mặc định: một mẫu ngoài `settings.grammarLevels` không được
  // giới thiệu, nên nếu để mặc định thì lô về RỖNG và ca này xanh một cách vô nghĩa — đúng điều phép
  // chốt "lô vẫn phải có mẫu không bị treo" bắt được ở lần chạy đầu.
  await callToolOk(request, 'update_settings', { grammarLevels: ['N2'] });

  await callToolOk(request, 'set_item_suspended', { itemId: suspended, suspended: true });

  // `maxItems: 12` (mức tối đa) là điều kiện để ca này KHÔNG xanh vì may mắn: với lô mặc định chỉ đủ
  // chỗ cho một mẫu, "mẫu bị treo không xuất hiện" có thể đúng chỉ vì lô đã đầy bởi mẫu kia.
  const batch = await callToolOk(request, 'get_due_items', { maxItems: 12 });
  const items = (batch.items ?? []) as { expression: string }[];
  const expressions = items.map((i) => i.expression);

  expect(expressions, `mẫu bị treo không được vào lô: ${expressions.join(' · ')}`).not.toContain(
    PATTERN,
  );
  expect(
    expressions,
    'và lô vẫn phải có mẫu KHÔNG bị treo — nếu không thì ca trên xanh vì lô rỗng',
  ).toContain(OTHER);

  const quiz = await callToolOk(request, 'get_quiz_items', { maxItems: 12 });
  const quizExpressions = ((quiz.items ?? []) as { expression: string }[]).map((i) => i.expression);
  expect(quizExpressions, 'quiz cũng phải loại mẫu bị treo').not.toContain(PATTERN);
});
