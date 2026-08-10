// BỐN KIỂU LUYỆN, MỘT PIPELINE — chạy qua bề mặt MCP thật và chốt ở DB.
//
// Vì sao (2026-08-11): dịch · quiz · hội thoại · giảng lại đều TUYÊN BỐ dùng chung đường
// `stage_sentence → submit_review`, và tuyên bố đó nằm trong comment chứ không nằm trong phép đo. Cùng
// lớp lỗ đã để con bug `submit_review` sống một tuần: `lib/practice.test.ts` kiểm pipeline ở tầng hàm,
// nhưng không có gì kiểm rằng một LƯỢT THẬT đi từ Claude Desktop, qua JSON-RPC, qua Zod của SDK, qua
// `guard()`, rồi hạ cánh đúng vào lịch FSRS.
//
// Phần đắt nhất ở đây là cột calibration. `axesFor` (lib/calibration.ts) đã có unit test cho HÀM
// THUẦN; cái chưa ai kiểm là DÂY NỐI — `submit_review` có thật sự đi qua nó và ghi vào đúng cột
// `LearnerAbility` hay không. Nên mỗi ca chốt cả hai chiều: trục ĐƯỢC đếm, và các trục KHÔNG được đếm.
// Chiều thứ hai là chiều bắt được lỗi thật, ví dụ đúng câu comment trong `axesFor` nói về giảng lại:
// "no Japanese is produced, so counting it as productive evidence would credit an ability the turn
// never exercised".

import { expect, test, type APIRequestContext } from '@playwright/test';
import {
  callToolOk,
  initializeMcp,
  openE2eDb,
  seedMcpAccount,
} from './mcp-client';

/** Ba cột quan sát của `LearnerAbility`, theo tên trục trong `axesFor`. */
const OBSERVATION_COLUMN = {
  receptive: 'receptiveObservations',
  productive: 'productiveObservations',
  register: 'registerObservations',
} as const;

type Axis = keyof typeof OBSERVATION_COLUMN;

interface Loop {
  name: string;
  exerciseType: string;
  direction: 'JA_VI' | 'VI_JA';
  sourceText: string;
  suggested: string;
  userAnswer: string;
  /** Trục mà `axesFor(direction, exerciseType)` nói là bằng chứng của lượt này. */
  axes: Axis[];
  /** QUIZ bị REFUSED nếu thiếu khối này — server tự xếp A–D, không để Claude chọn chỗ đáp án. */
  quiz?: { correct: string; distractors: string[] };
}

const PATTERN = 'LOOP〜わけではない';

const LOOPS: Loop[] = [
  {
    name: 'dịch JA→VI',
    exerciseType: 'TRANSLATION',
    direction: 'JA_VI',
    sourceText: '嫌いなわけではない。',
    suggested: 'Không phải là tôi ghét.',
    userAnswer: 'Không hẳn là tôi ghét.',
    axes: ['receptive'],
  },
  {
    name: 'dịch VI→JA',
    exerciseType: 'TRANSLATION',
    direction: 'VI_JA',
    sourceText: 'Không phải là tôi không muốn đi.',
    suggested: '行きたくないわけではない。',
    userAnswer: '行きたくないわけではありません。',
    axes: ['productive'],
  },
  {
    name: 'quiz trắc nghiệm',
    exerciseType: 'QUIZ',
    direction: 'JA_VI',
    sourceText: '嫌いな＿＿。',
    suggested: 'わけではない',
    userAnswer: 'A',
    axes: ['receptive'],
    quiz: { correct: 'わけではない', distractors: ['はずがない', 'ものではない', 'どころではない'] },
  },
  {
    name: 'hội thoại theo tình huống',
    exerciseType: 'CONVERSATION',
    direction: 'VI_JA',
    sourceText: 'Đồng nghiệp mời đi uống, bạn muốn từ chối nhẹ nhàng mà không làm họ nghĩ bạn ghét họ.',
    suggested: '嫌いなわけではないんですが、今日は遠慮しておきます。',
    userAnswer: '嫌いなわけではないですが、今日はやめておきます。',
    axes: ['productive', 'register'],
  },
  {
    name: 'giảng lại (teach-back)',
    exerciseType: 'TEACH_BACK',
    direction: 'JA_VI',
    sourceText: PATTERN,
    suggested: 'Phủ định một suy luận mà người nghe có thể đang có, không phủ định toàn bộ.',
    userAnswer: 'Nó phủ nhận cách hiểu của người nghe, kiểu "không hẳn là…", chứ không phủ định hoàn toàn.',
    axes: ['receptive'],
  },
];

/** Thêm mẫu vào kho rồi trả itemId thật — mọi ca đều bắt đầu từ một kho sạch. */
async function seedOneItem(api: APIRequestContext): Promise<string> {
  await callToolOk(api, 'add_grammar', {
    grammar: [
      {
        expression: PATTERN,
        reading: 'わけではない',
        meaningVi: 'không hẳn là, không phải là',
        level: 'N3',
        notes: '普通形 + わけではない',
      },
    ],
  });
  const listed = await callToolOk(api, 'list_grammar', {});
  const rows = ((listed.items ?? listed) as { itemId: string; expression: string }[]) ?? [];
  const row = rows.find((r) => r.expression === PATTERN);
  expect(row?.itemId, `list_grammar phải thấy mẫu vừa thêm: ${JSON.stringify(rows)}`).toBeTruthy();
  return row!.itemId;
}

for (const loop of LOOPS) {
  test(`${loop.name}: một lượt thật đi hết vòng và nằm lại trong DB`, async ({ request }) => {
    await seedMcpAccount();
    await initializeMcp(request);
    const itemId = await seedOneItem(request);

    // ── stage → submit, đúng cặp lời gọi Claude thực hiện mỗi lượt ──────────
    const staged = await callToolOk(request, 'stage_sentence', {
      direction: loop.direction,
      exerciseType: loop.exerciseType,
      sourceText: loop.sourceText,
      suggested: loop.suggested,
      items: [{ itemId, role: 'TARGET' }],
      ...(loop.quiz ? { quiz: loop.quiz } : {}),
    });
    const sentenceId = staged.sentenceId as string;
    expect(sentenceId, 'stage_sentence phải trả sentenceId').toBeTruthy();

    const graded = await callToolOk(request, 'submit_review', {
      sentenceId,
      userAnswer: loop.userAnswer,
      ratings: [{ itemId, rating: 3, role: 'TARGET' }],
    });
    expect((graded.items as { itemId: string }[])?.[0]?.itemId).toBe(itemId);

    // ── Chốt ở DB, không ở phong bì trả về ─────────────────────────────────
    // Một transaction bị rollback vẫn trả về một phong bì trông ổn — đó ĐÚNG là cách con bug
    // 2026-08-08 trông vô hại. Chỉ các hàng mới nói được sự thật.
    const db = openE2eDb();
    try {
      const sentence = db
        .prepare('SELECT status, exerciseType, direction, userAnswer FROM "Sentence" WHERE id = ?')
        .get(sentenceId) as
        | { status: string; exerciseType: string; direction: string; userAnswer: string }
        | undefined;
      expect(sentence, 'câu đã stage phải còn trong DB').toBeTruthy();
      expect(sentence!.status, 'chấm rồi thì phải là GRADED').toBe('GRADED');
      expect(sentence!.exerciseType, 'exerciseType phải được lưu đúng kiểu luyện').toBe(
        loop.exerciseType,
      );
      expect(sentence!.direction).toBe(loop.direction);
      expect(sentence!.userAnswer).toBe(loop.userAnswer);

      const logs = db
        .prepare('SELECT rating, sentenceId FROM "ReviewLog" WHERE itemId = ?')
        .all(itemId) as { rating: number; sentenceId: string | null }[];
      expect(logs, 'đúng một ReviewLog được ghi thêm').toHaveLength(1);
      expect(logs[0].rating).toBe(3);
      expect(logs[0].sentenceId, 'log phải trỏ về câu đã chấm').toBe(sentenceId);

      const srs = db
        .prepare('SELECT reps, state FROM "SrsState" WHERE itemId = ?')
        .get(itemId) as { reps: number; state: number } | undefined;
      expect(srs, 'FSRS phải có hàng cho item').toBeTruthy();
      expect(srs!.reps, 'một lượt đã chấm = một rep').toBe(1);
      expect(srs!.state, 'phải rời trạng thái "new" (0)').toBeGreaterThan(0);

      // ── Dây nối calibration: đúng trục, và KHÔNG trục nào khác ───────────
      const ability = db
        .prepare(
          'SELECT receptiveObservations, productiveObservations, registerObservations FROM "LearnerAbility"',
        )
        .all() as Record<string, number>[];
      expect(ability, 'đúng một hàng ability cho một người học').toHaveLength(1);

      for (const axis of Object.keys(OBSERVATION_COLUMN) as Axis[]) {
        const column = OBSERVATION_COLUMN[axis];
        const expected = loop.axes.includes(axis) ? 1 : 0;
        expect(
          ability[0][column],
          expected === 1
            ? `${loop.exerciseType} phải là bằng chứng của trục ${axis} (axesFor)`
            : `${loop.exerciseType} KHÔNG được tính là bằng chứng của trục ${axis} — ` +
              'một lượt ghi điểm cho năng lực nó chưa hề dùng là điều tệ hơn không ghi gì',
        ).toBe(expected);
      }
    } finally {
      db.close();
    }
  });
}
