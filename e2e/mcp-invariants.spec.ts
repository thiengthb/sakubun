import { expect, test, type APIRequestContext } from '@playwright/test';
import { callTool, callToolOk, initializeMcp, openE2eDb, seedMcpAccount } from './mcp-client';

const PATTERN = 'INV〜きらいがある';
const OTHER = 'INV〜あげく';

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
    score: 75,
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

  const again = await callTool(request, 'submit_review', {
    sentenceId,
    userAnswer: 'đổi ý, chấm lại',
    ratings: [{ itemId, rating: 4, role: 'TARGET' }],
    score: 90,
  });
  expect(again.isError, `chấm lại một câu đã GRADED phải bị từ chối: ${again.text}`).toBe(true);

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
    expect(
      srsRow(itemId),
      `\`${name}\` đã đẩy lịch FSRS. Bất biến 1 nói chỉ submit_review được làm điều đó ` +
        `(AGENTS.md §Gotchas). Kết quả tool: ${res.text.slice(0, 160)}`,
    ).toEqual(before);
  }

  expect(countRows('ReviewLog', 'itemId = ?', itemId), 'ReviewLog chỉ được append bởi submit_review').toBe(
    logsBefore,
  );

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

  await callToolOk(request, 'update_settings', { grammarLevels: ['N2'] });

  await callToolOk(request, 'set_item_suspended', { itemId: suspended, suspended: true });

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
