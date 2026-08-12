// harness-allow-test-shrink — 2026-08-11: một ca bị XOÁ vì hành vi nó chốt đã không còn tồn tại.
// `renderScaffold` từng có nhánh `availableInSharedLibrary` dạy Claude gọi `fork_shared_items`; trạng
// thái đó chưa bao giờ được `classifyExtraPatterns` gán, và tool đó không còn được đăng ký. Nhánh
// `newToLearner` — nhánh duy nhất còn lại — vẫn có ca gác riêng ngay phía trên chỗ đã xoá.
import { describe, expect, it } from 'vitest';
import type { Suggestion } from '@/lib/coach';
import {
  renderConsentGuard,
  renderDueBatch,
  renderScaffold,
  renderGradeResult,
  renderStats,
  renderTeachBackHarvest,
  verbatimEnvelope,
} from '@/lib/mcp/render';
import { MODE_DISPATCH, TEACH_BACK_PROTOCOL, TEACH_BACK_SESSION } from '@/lib/mcp/prompts';
import { EXERCISE_TYPE } from '@/lib/mcp/tool-kit';
import { DEFAULT_SETTINGS } from '@/lib/settings-schema';
import type { DueBatch, SubmitReviewResult } from '@/lib/practice';

const NOW = new Date('2026-07-06T10:00:00Z');

const baseBatch: DueBatch = {
  direction: 'JA_VI',
  mode: 'ACQUIRE',
  items: [],
  limits: {
    reviewLimitReached: false,
    newGrammarLimitReached: false,
    newPerSentenceReached: false,
  },
  withheld: [],
  settings: DEFAULT_SETTINGS,
  today: { reviews: 0, newGrammar: 0, sentences: 0 },
  dueNow: 0,
  newAvailable: { grammar: 0 },
  focus: null,
  weakSpots: { topTags: [], byItem: {} },
  newBeyondLevels: 0,
  nextDueAt: null,
  recentContexts: {},
};

const plainItem = {
  reading: null,
  level: 'N5',
  notes: null,
  isNew: false,
  enrichment: null,
  lapses: 0,
};

describe('renderGradeResult', () => {
  const result: SubmitReviewResult = {
    sentenceId: 's1',
    ratingNotes: [],
    direction: 'JA_VI',
    exerciseType: 'TRANSLATION',
    sourceText: '毎日勉強しています。',
    userAnswer: 'Tôi học mỗi ngày.',
    suggested: 'Tôi đang học mỗi ngày.',
    items: [
      {
        itemId: 'a',
        expression: '勉強',
        rating: 3,
        state: 2,
        nextDue: new Date('2026-07-09T10:00:00Z'),
        intervalDays: 3,
      },
    ],
    score: 85,
    today: { reviews: 5, newGrammar: 0, sentences: 2 },
    dueNow: 2,
    nextDueAt: null,
    sessionGoal: 10,
    calibration: null,
    learnerNote: null,
    teachBack: null,
  };

  it('renders a per-item table with humanized next due', () => {
    const md = renderGradeResult(result, NOW);
    expect(md).toContain('| 勉強 | Good | 3 ngày nữa |');
    expect(md).toContain('còn **2** mẫu đến hạn');
  });

  it('shows đề / bạn dịch / bản dịch tham khảo and the next-action menu', () => {
    const md = renderGradeResult(result, NOW);
    expect(md).toContain('**Đề (Nhật → Việt):** 毎日勉強しています。');
    expect(md).toContain('**Bạn dịch:** Tôi học mỗi ngày.');
    expect(md).toContain('**Tham khảo:** Tôi đang học mỗi ngày.');
    expect(md).toContain('**Tiếp theo?**');
    expect(md).toContain('5. Kết thúc buổi');
  });

  // Ca này ĐỔI CHIỀU ngày 2026-08-11. Trước đó nó khoá hành vi "thiếu điểm thì BỎ dòng đi", và đúng
  // hành vi ấy là một nửa của lỗi người học báo đi báo lại: điểm mất khỏi chat, đồng thời mất khỏi thẻ,
  // nên không có chỗ nào nói ra rằng lượt này không có điểm. `score` giờ bắt buộc ở biên
  // (`lib/mcp/tools/practice.ts`) nên null không còn tới được đây từ một lượt mới — dòng vẫn phải có
  // chữ, vì im lặng là thứ người học đọc thành "app không chấm".
  it('luôn có dòng Điểm trong khối chép nguyên văn, kể cả khi không có điểm', () => {
    expect(renderGradeResult(result, NOW)).toContain('**Điểm:** 85/100');
    expect(renderGradeResult({ ...result, score: null }, NOW)).toContain('**Điểm:** chưa có');
  });

  it('shows daily-goal progress; no retry option when nothing failed', () => {
    const md = renderGradeResult(result, NOW);
    expect(md).toContain('câu **2/10**');
    expect(md).not.toContain('Gõ lại bản dịch');
    expect(md).not.toContain('Đạt mục tiêu hôm nay');
  });

  it('failed item (rating ≤ 2) leads the menu with the rewrite step', () => {
    const md = renderGradeResult({ ...result, items: [{ ...result.items[0], rating: 1 }] }, NOW);
    expect(md).toContain('Gõ lại bản dịch đã sửa lỗi');
    expect(md).toContain('KHÔNG chấm lại');
    expect(md).toContain('1. Câu tiếp'); // the numbered menu is still intact
  });

  // "Đã sạch hàng đợi" is a claim about the DAY, and `dueNow` only knows about this second. Measured in
  // the lab 2026-08-12 on a fresh account: after sentence 2 the line read "câu **2/10** — đã sạch hàng
  // đợi", while three just-learned patterns sat in learning steps 5-10 minutes out. Half the line said
  // eight sentences to go, the other half said there was nothing to do, and it is the line the learner
  // reads after EVERY turn.
  it('an empty-right-now queue with work coming back says WHEN, not "đã sạch"', () => {
    const md = renderGradeResult(
      {
        ...result,
        dueNow: 0,
        nextDueAt: new Date('2026-07-06T10:06:00Z'), // a learning step, 6 minutes out
      },
      NOW,
    );
    expect(md).toContain('mẫu tiếp đến hạn 6 phút nữa');
    expect(md).not.toContain('đã sạch hàng đợi');
  });

  it('"đã sạch hàng đợi" is reserved for a queue with nothing left in it at all', () => {
    const md = renderGradeResult({ ...result, dueNow: 0, nextDueAt: null }, NOW);
    expect(md).toContain('đã sạch hàng đợi');
  });

  // A QUIZ turn is not a translation. Same defect as the teach-back one fixed on 2026-07-27, one
  // exercise type over — it survived because only teach-back had been given a name. Found in the lab
  // 2026-08-12 driving a real quiz over MCP.
  it('a QUIZ turn is labelled as a choice, with an answer key and no rewrite offer', () => {
    const md = renderGradeResult(
      {
        ...result,
        exerciseType: 'QUIZ',
        sourceText: 'すみません、ここで写真を撮っ（＿＿）か。',
        userAnswer: 'Chọn C: 〜たことがあります',
        suggested: 'Đáp án: 〜てもいいです',
        items: [{ ...result.items[0], rating: 1 }],
      },
      NOW,
    );
    expect(md).toContain('**Câu hỏi:** すみません');
    expect(md).toContain('**Bạn chọn:** Chọn C');
    expect(md).toContain('**Đáp án:** Đáp án: 〜てもいいです');
    expect(md).not.toContain('Đề (Nhật → Việt)');
    expect(md).not.toContain('Bạn dịch');
    expect(md).not.toContain('**Tham khảo:**');
    // Nothing to retype when the answer was a letter — the menu must not send them looking for a
    // sentence the turn never asked them to write.
    expect(md).not.toContain('Gõ lại bản dịch');
    expect(md).toContain('1. Câu tiếp'); // the numbered menu is still intact
  });

  // A CONVERSATION turn: the learner composed an utterance from a situation. Third instance of the same
  // defect (after TEACH_BACK 2026-07-27 and QUIZ), found in the lab 2026-08-12 — the scenario brief was
  // labelled "Đề (Việt → Nhật)" and their own utterance "Bạn dịch".
  it('a CONVERSATION turn is labelled as a situation and a spoken answer', () => {
    const md = renderGradeResult(
      {
        ...result,
        exerciseType: 'CONVERSATION',
        direction: 'VI_JA',
        sourceText: 'Bối cảnh: gọi điện cho cấp trên. Bạn cần: xin phép đến muộn. Văn phong: kính ngữ',
        userAnswer: 'すみません、30分遅れて行ってもいいですか。',
        suggested: '申し訳ございません、30分ほど遅れて出社してもいいでしょうか。',
        items: [{ ...result.items[0], rating: 2 }],
      },
      NOW,
    );
    expect(md).toContain('**Tình huống:** Bối cảnh');
    expect(md).toContain('**Bạn nói:**');
    expect(md).toContain('**Câu mẫu:**');
    expect(md).not.toContain('Đề (Việt → Nhật)');
    expect(md).not.toContain('Bạn dịch');
    expect(md).toContain('Nói lại câu đã sửa'); // a retry here is speaking again, not re-translating
  });

  // THE STRUCTURAL GUARD, and the reason this stopped being a chain of flags. Each of the three fixes
  // above added one more `isX`, which is exactly why there was a third one to find: a flag has to be
  // remembered. Walking the enum means a NEW exercise type arrives with its labels chosen on purpose —
  // either an entry in TURN_LABELS, or a conscious decision that it really is a translation.
  it('every exercise type renders labels that match what the learner actually did', () => {
    // The types on which the learner genuinely TRANSLATES a given source — the translation defaults are
    // right for these, including the two scaffolded rungs (still translating, just with support).
    const translations = new Set([
      'TRANSLATION',
      'CLOZE',
      'DIALOGUE',
      'CLOZE_PRODUCTION',
      'GUIDED_PRODUCTION',
    ]);
    for (const type of EXERCISE_TYPE.options) {
      const md = renderGradeResult({ ...result, exerciseType: type }, NOW);
      if (translations.has(type)) {
        expect(md, `${type} should read as a translation`).toContain('**Bạn dịch:**');
      } else {
        expect(md, `${type} must NOT claim the learner translated`).not.toContain('**Bạn dịch:**');
        expect(md, `${type} must NOT be headed as a translation prompt`).not.toContain('**Đề (');
      }
    }
  });

  it('celebrates when the daily sentence goal is reached', () => {
    const md = renderGradeResult({ ...result, today: { ...result.today, sentences: 10 } }, NOW);
    expect(md).toContain('Đạt mục tiêu hôm nay (10 câu)');
  });
});

describe('verbatimEnvelope', () => {
  it('prepends the display order and keeps the block intact', () => {
    const out = verbatimEnvelope('### Kết quả lượt này\nnội dung');
    expect(out.startsWith('**QUY TẮC HIỂN THỊ**')).toBe(true);
    expect(out).toContain('PHẢI BẮT ĐẦU');
    expect(out).toContain('NGUYÊN VĂN 100%');
    expect(out).toContain('KHÔNG hiển thị'); // the json-payload ban (eval finding 2026-07-09)
    expect(out.endsWith('### Kết quả lượt này\nnội dung')).toBe(true);
  });

  // THE RULE MUST BE TRUE OF THE BLOCK IT WRAPS. It was a fixed string naming the "Tiếp theo?" menu as
  // the end boundary and "Bản dịch tham khảo" as a line not to drop — but only `renderGradeResult`
  // produces that menu, and this envelope also wraps "Tiến độ", "Tra cứu" and "Điểm yếu". Measured
  // 2026-08-12: on three of its four blocks it pointed at a terminator that does not exist and defended
  // two lines that were never there. This is the instruction the entire display contract rests on (the
  // missing-score bug lived behind it for a week), and one that is false on most of its uses is one the
  // reader learns to skim on the use where it matters.
  it('names the menu as the boundary only when the block HAS a menu', () => {
    const withMenu = verbatimEnvelope('### Kết quả lượt này\n**Tiếp theo?** 1. Câu tiếp');
    expect(withMenu).toContain('đến HẾT DÒNG MENU "Tiếp theo?"');
    expect(withMenu).toContain('menu "Tiếp theo?"');

    const withoutMenu = verbatimEnvelope('### Tiến độ\n- **Đến hạn bây giờ:** 0');
    expect(withoutMenu).toContain('đến hết khối');
    expect(withoutMenu).not.toContain('Tiếp theo?');
    // …and it defends nothing it cannot see.
    expect(withoutMenu).not.toContain('kể cả');
  });

  it('names the reference line the block actually printed, whichever it is', () => {
    for (const [label, others] of [
      ['Tham khảo', ['Đáp án', 'Câu mẫu']],
      ['Đáp án', ['Tham khảo', 'Câu mẫu']],
      ['Câu mẫu', ['Tham khảo', 'Đáp án']],
    ] as const) {
      const out = verbatimEnvelope(`### Kết quả lượt này\n**${label}:** x\n**Tiếp theo?** 1.`);
      expect(out, `${label} must be defended by name`).toContain(`(kể cả "${label}"`);
      for (const other of others) expect(out).not.toContain(`"${other}"`);
    }
    // The old string named a label the block never prints — that is the shape of the bug.
    expect(verbatimEnvelope('### Kết quả lượt này\n**Tham khảo:** x')).not.toContain(
      'Bản dịch tham khảo',
    );
  });
});

describe('renderWeakReport', () => {
  it('renders tag table, worst items, and leech suspension hint', async () => {
    const { renderWeakReport } = await import('@/lib/mcp/render');
    const md = renderWeakReport({
      windowDays: 30,
      tagCounts: [{ tag: 'particle', count: 5 }],
      worstItems: [{ itemId: 'a', expression: '〜けど', misses: 3, tags: ['particle'] }],
      leeches: [
        { itemId: 'b', expression: '難しい', meaningVi: 'khó', lapses: 9, suspendSuggested: true },
      ],
    });
    expect(md).toContain('| Trợ từ | 5 |');
    expect(md).toContain('**〜けど** — sai 3 lần');
    expect(md).toContain('cân nhắc tạm ngưng');
  });
});

describe('renderDueBatch', () => {
  it('empty batch mentions the next due time', () => {
    const md = renderDueBatch({ ...baseBatch, nextDueAt: new Date(Date.now() + 10 * 60 * 1000) });
    expect(md).toContain('phút nữa');
  });

  it('focus mode carries the focus header and marks requested vs filler items', () => {
    const md = renderDueBatch({
      ...baseBatch,
      focus: {
        levels: ['N3'],
        patterns: ['ばかりに'],
        matched: 1,
        unmatchedPatterns: ['ぞい'],
        suspendedPatterns: [],
      },
      items: [
        {
          ...plainItem,
          id: 'a',
          expression: '〜ばかりに',
          meaningVi: 'chỉ vì',
          role: 'TARGET',
          focusHit: true,
        },
        {
          ...plainItem,
          id: 'b',
          expression: '〜けど',
          meaningVi: 'nhưng',
          role: 'SECONDARY',
          focusHit: false,
        },
      ],
    });
    expect(md).toContain('FOCUS requested by the user: level N3 + pattern 「ばかりに」');
    expect(md).toContain('[TARGET · FOCUS');
    expect(md).toContain('[SECONDARY · filler');
    expect(md).toContain('NOT in the library: 「ぞい」');
  });

  it('a focus that served NO requested pattern says so instead of claiming the sentence revolves around it', () => {
    // The 2026-07-26 defect: the sheet asserted "the sentence MUST revolve around the FOCUS entries"
    // while listing only fillers, so the tutor composed about an absent pattern — no rating, no FSRS.
    const md = renderDueBatch({
      ...baseBatch,
      focus: { patterns: ['かねる'], matched: 1, unmatchedPatterns: [], suspendedPatterns: [] },
      withheld: [{ expression: '〜かねる', reason: 'per-sentence-new-cap', focusHit: true }],
      items: [
        {
          ...plainItem,
          id: 'b',
          expression: '〜けど',
          meaningVi: 'nhưng',
          role: 'TARGET',
          focusHit: false,
        },
      ],
    });
    expect(md).toContain('FOCUS NOT SERVED');
    expect(md).not.toContain('MUST revolve around the FOCUS entries');
    expect(md).toContain('HELD BACK (THE USER EXPLICITLY ASKED FOR THIS): 「〜かねる」');
    expect(md).toContain('settings.maxNewPerSentence');
  });

  it('a spent daily quota is stated with its fix instead of being silently dropped', () => {
    // limits.* were computed since the scheduler was written and read by NO consumer — the learner
    // was never told why the pattern they asked for did not arrive.
    const md = renderDueBatch({
      ...baseBatch,
      limits: { ...baseBatch.limits, newGrammarLimitReached: true },
      withheld: [{ expression: '〜どころか', reason: 'daily-new-cap', focusHit: false }],
      items: [{ ...plainItem, id: 'a', expression: '〜けど', meaningVi: 'nhưng', role: 'TARGET' }],
    });
    expect(md).toContain('HELD BACK: 「〜どころか」');
    expect(md).toContain('settings.dailyNewGrammar');
    expect(md).toContain('update_settings');
  });

  it('an empty batch names the cap that emptied it', () => {
    const md = renderDueBatch({
      ...baseBatch,
      withheld: [{ expression: '〜まいか', reason: 'review-cap', focusHit: false }],
    });
    expect(md).toContain('HELD BACK: 「〜まいか」');
    expect(md).toContain('settings.maxReviewsPerDay');
  });

  it('nothing withheld adds no HELD BACK line (the sheet is re-sent every turn)', () => {
    const md = renderDueBatch({
      ...baseBatch,
      items: [{ ...plainItem, id: 'a', expression: '〜けど', meaningVi: 'nhưng', role: 'TARGET' }],
    });
    expect(md).not.toContain('HELD BACK');
  });

  // THE SHEET MAY NEVER ASK FOR MORE PATTERNS THAN IT HANDS OVER.
  //
  // Measured in the lab 2026-08-12, driving a real session over MCP on a fresh N5 account: every one
  // of the first three sentences got a sheet reading "weave in **3** grammar pattern(s)" above a list
  // of exactly ONE, because `maxNewPerSentence` had held the others back. The protocol simultaneously
  // tells Claude "the number of grammar patterns woven in = exactly the number of items in the batch"
  // and "NEVER compose around a pattern that is not listed in the batch" — so this line was handing it
  // a third, contradicting number for the same decision, on the hottest path in the app.
  //
  // Both directions are pinned: the count must FOLLOW the batch, and it must not gain a spurious
  // explanation when the batch is already full. VOCAB riders are excluded because they are graded but
  // sit outside the grammar-pattern budget.
  it('the pattern count follows the BATCH, not the sentenceSize setting', () => {
    const one = renderDueBatch({
      ...baseBatch,
      items: [{ ...plainItem, id: 'a', expression: '〜けど', meaningVi: 'nhưng', role: 'TARGET' }],
      withheld: [{ expression: '〜のに', reason: 'per-sentence-new-cap', focusHit: false }],
    });
    expect(one).toContain('weave in **1** grammar pattern(s)');
    expect(one).not.toContain('weave in **3**');
    // …and it says WHY the two numbers differ, plus what to do about the leftover length.
    expect(one).toContain('sentenceSize "medium" asks for 3');
    expect(one).toContain('LOWER-level SCAFFOLDING');
    expect(one).toContain('HELD BACK line below names the cap');
  });

  it('a VOCAB rider does not count toward the grammar-pattern budget', () => {
    const md = renderDueBatch({
      ...baseBatch,
      items: [
        { ...plainItem, id: 'a', expression: '〜けど', meaningVi: 'nhưng', role: 'TARGET' },
        { ...plainItem, id: 'v', expression: '台所', meaningVi: 'nhà bếp', role: 'VOCAB' },
      ],
    });
    expect(md).toContain('weave in **1** grammar pattern(s)');
  });

  it('a batch that already matches the size setting gets the plain line, with no excuse attached', () => {
    const md = renderDueBatch({
      ...baseBatch,
      items: ['a', 'b', 'c'].map((id) => ({
        ...plainItem,
        id,
        expression: `〜${id}`,
        meaningVi: id,
        role: 'SECONDARY' as const,
      })),
    });
    expect(md).toContain('weave in **3** grammar pattern(s) ·');
    expect(md).not.toContain('asks for');
  });

  // THE SHEET MUST NOT ARGUE WITH THE PROTOCOL OF THE MODE IT IS SERVING.
  //
  // Measured 2026-08-12 on a real teach-back turn: the sheet shipped `↳ **REQUIRED**: pass
  // suggestedRuby` — which TEACH_BACK_PROTOCOL forbids (it stages sourceRuby) — and `Direction:
  // **VI_JA**`, while that protocol ALWAYS stages JA_VI. Not noise: a contradiction, in the strongest
  // word the sheet has, arriving at the moment of the decision while the protocol arrived at the start
  // of the session. TEACH_BACK_PROTOCOL was spending a paragraph telling Claude to ignore half of this
  // block — prose patching a data problem.
  describe('the composition sheet follows the mode it is serving', () => {
    it('a TEACH-BACK batch carries no sentence spec at all', () => {
      const md = renderDueBatch({
        ...baseBatch,
        forExerciseType: 'TEACH_BACK',
        direction: 'VI_JA', // what ALTERNATING happened to pick — must NOT reach the sheet
        items: [
          { ...plainItem, id: 'a', expression: '〜ばかりに', meaningVi: 'chỉ vì', role: 'TARGET' },
          { ...plainItem, id: 'v', expression: '台所', meaningVi: 'nhà bếp', role: 'VOCAB' },
        ],
        weakSpots: { topTags: [{ tag: 'particle', count: 2 }], byItem: {} },
        settings: { ...DEFAULT_SETTINGS, topics: ['công việc'] },
      });
      expect(md).toContain('TEACH-BACK TURN');
      expect(md).toContain('direction: "JA_VI"');
      // None of the composing spec, and above all not the field the protocol forbids.
      expect(md).not.toContain('suggestedRuby');
      expect(md).not.toContain('Direction: **VI_JA**');
      expect(md).not.toContain('source length');
      expect(md).not.toContain('weave in');
      expect(md).not.toContain('STRUCTURE (difficulty');
      expect(md).not.toContain('Preferred topics');
      // A VOCAB rider may still ride along; the protocol says ignore it, so the sheet must not spend a
      // paragraph telling Claude to weave it into a sentence that does not exist.
      expect(md).not.toContain('USE them NATURALLY in the');
      // What it DOES keep: the item, its enrichment, and the weak spots — reworded for marking.
      expect(md).toContain('〜ばかりに');
      expect(md).toContain('aim your MARKING at these');
      expect(md).not.toContain('design the sentence to TOUCH');
    });

    it('a CONVERSATION batch is pinned to the direction its protocol stages', () => {
      // The half of turns where this bit: `batch.direction` alternates, CONVERSATION_PROTOCOL always
      // stages VI_JA — so on a JA_VI turn the sheet named a direction the tutor was told never to use,
      // and asked for the wrong ruby field with it.
      const md = renderDueBatch({
        ...baseBatch,
        forExerciseType: 'CONVERSATION',
        direction: 'JA_VI',
        items: [{ ...plainItem, id: 'a', expression: '〜ばかりに', meaningVi: 'chỉ vì', role: 'TARGET' }],
      });
      expect(md).toContain('Direction: **VI_JA**');
      expect(md).toContain('suggestedRuby'); // the Japanese here is the ANSWER, so this is the right field
      expect(md).not.toContain('pass `sourceRuby`');
    });

    it('an unqualified batch keeps the full composing sheet — translation practice is the default', () => {
      const md = renderDueBatch({
        ...baseBatch,
        direction: 'JA_VI',
        items: [{ ...plainItem, id: 'a', expression: '〜ばかりに', meaningVi: 'chỉ vì', role: 'TARGET' }],
      });
      expect(md).toContain('Direction: **JA_VI**');
      expect(md).toContain('source length');
      expect(md).toContain('pass `sourceRuby`');
      expect(md).not.toContain('TEACH-BACK TURN');
    });
  });

  it('weakness focus (matched > 0) leads with the WEAK-SPOT DRILL header', () => {
    const md = renderDueBatch({
      ...baseBatch,
      focus: { weak: true, matched: 2, unmatchedPatterns: [], suspendedPatterns: [] },
      items: [
        {
          ...plainItem,
          id: 'a',
          expression: '〜ばかりに',
          meaningVi: 'chỉ vì',
          role: 'TARGET',
          focusHit: true,
        },
      ],
    });
    expect(md).toContain('WEAK-SPOT DRILL');
    expect(md).toContain('the server prioritised 2 pattern(s)');
    expect(md).toContain('rating ≤ 2');
  });

  it('weakness focus with no data (matched = 0) falls back to normal FSRS wording', () => {
    const md = renderDueBatch({
      ...baseBatch,
      focus: { weak: true, matched: 0, unmatchedPatterns: [], suspendedPatterns: [] },
      items: [
        {
          ...plainItem,
          id: 'a',
          expression: '〜ばかりに',
          meaningVi: 'chỉ vì',
          role: 'TARGET',
          focusHit: false,
        },
      ],
    });
    expect(md).toContain('WEAK-SPOT DRILL');
    expect(md).toContain('not enough data yet');
  });

  it('empty batch + weakness focus with no data tells Claude to practice normally, not "not found"', () => {
    const md = renderDueBatch({
      ...baseBatch,
      focus: { weak: true, matched: 0, unmatchedPatterns: [], suspendedPatterns: [] },
    });
    expect(md).toContain('there is NO weakness data yet');
    expect(md).not.toContain('matches NO pattern in the library');
  });

  it('speech-only promptModality tells Claude to read the đề aloud and hide its text', () => {
    const md = renderDueBatch({
      ...baseBatch,
      settings: { ...DEFAULT_SETTINGS, promptModality: 'speech-only' },
      items: [
        {
          ...plainItem,
          id: 'a',
          expression: '〜ばかりに',
          meaningVi: 'chỉ vì',
          role: 'TARGET',
          focusHit: false,
        },
      ],
    });
    expect(md).toContain('speech-only');
    expect(md).toContain('SPEAK the exercise sentence aloud');
    expect(md).toContain('NEVER type or show its text');
  });

  it('default text modality adds no audio reminder to the sheet', () => {
    const md = renderDueBatch({
      ...baseBatch,
      items: [
        {
          ...plainItem,
          id: 'a',
          expression: '〜ばかりに',
          meaningVi: 'chỉ vì',
          role: 'TARGET',
          focusHit: false,
        },
      ],
    });
    expect(md).not.toContain('RA ĐỀ');
  });

  it('JA source with a Claude-showing furigana mode inlines readings and sends sourceRuby', () => {
    const md = renderDueBatch({
      ...baseBatch,
      direction: 'JA_VI',
      settings: { ...DEFAULT_SETTINGS, furiganaMode: 'claude' },
      items: [
        {
          ...plainItem,
          id: 'a',
          expression: '〜ばかりに',
          meaningVi: 'chỉ vì',
          role: 'TARGET',
          focusHit: false,
        },
      ],
    });
    expect(md).toContain('FURIGANA (Claude renders it)');
    expect(md).toContain('（かな）');
    expect(md).toContain('sourceRuby');
  });

  it('JA source still requests sourceRuby when furigana is app-only', () => {
    const md = renderDueBatch({
      ...baseBatch,
      direction: 'JA_VI',
      settings: { ...DEFAULT_SETTINGS, furiganaMode: 'app' },
      items: [
        {
          ...plainItem,
          id: 'a',
          expression: '〜ばかりに',
          meaningVi: 'chỉ vì',
          role: 'TARGET',
          focusHit: false,
        },
      ],
    });
    expect(md).toContain('Claude does NOT insert it');
    expect(md).toContain('sourceRuby');
  });

  it('VI source (no JA đề) carries no furigana directive', () => {
    const md = renderDueBatch({
      ...baseBatch,
      direction: 'VI_JA',
      items: [
        {
          ...plainItem,
          id: 'a',
          expression: '〜ばかりに',
          meaningVi: 'chỉ vì',
          role: 'TARGET',
          focusHit: false,
        },
      ],
    });
    expect(md).not.toContain('FURIGANA');
    // ...but the JA answer still needs hover-furigana → suggestedRuby is requested for VI_JA.
    expect(md).toContain('suggestedRuby');
  });

  it('empty batch + unmatched focus tells Claude to report not-found instead of "done"', () => {
    const md = renderDueBatch({
      ...baseBatch,
      focus: { patterns: ['ぞい'], matched: 0, unmatchedPatterns: ['ぞい'], suspendedPatterns: [] },
    });
    expect(md).toContain('matches NO pattern in the library');
  });

  it('a SUSPENDED pattern is reported as paused, never as missing (it would cause a duplicate)', () => {
    const md = renderDueBatch({
      ...baseBatch,
      focus: {
        patterns: ['ばかりに'],
        matched: 0,
        unmatchedPatterns: [],
        suspendedPatterns: [{ pattern: 'ばかりに', itemId: 'it-9', expression: '〜ばかりに' }],
      },
    });
    expect(md).toContain('SUSPENDED, not missing');
    expect(md).toContain('it-9');
    expect(md).toContain('set_item_suspended');
    // The whole point: the tutor must NOT be told to create it again.
    expect(md).toContain('Do NOT call add_grammar');
    expect(md).not.toContain('NOT in the library: 「ばかりに」');

    // The SAME state on the other code path: the batch is NOT empty (other patterns filled it), so the
    // message comes from the composition sheet instead of the empty-batch line. Both must say it.
    const sheet = renderDueBatch({
      ...baseBatch,
      focus: {
        patterns: ['ばかりに'],
        matched: 0,
        unmatchedPatterns: [],
        suspendedPatterns: [{ pattern: 'ばかりに', itemId: 'it-9', expression: '〜ばかりに' }],
      },
      items: [
        { ...plainItem, id: 'b', expression: '〜つつある', meaningVi: 'dần dần', role: 'TARGET' },
      ],
    });
    expect(sheet).toContain('SUSPENDED, not missing');
    expect(sheet).toContain('set_item_suspended');
  });

  // Eval Scenario G (2026-07-28): the learner-model digest rode this sheet once per SENTENCE to aim
  // the exercise, and measurably aimed nothing — 0 of 6 treatment trials made the named confusion
  // decide the answer, against 1 of 6 CONTROLS. It now renders once per session on `get_stats`. A
  // sheet is the most expensive place in this app to put text, so the absence gets a test.
  it('carries NO learner-model digest — that block is session-open only', () => {
    const md = renderDueBatch({
      ...baseBatch,
      items: [
        {
          ...plainItem,
          id: 'a',
          expression: '〜ざるを得ない',
          meaningVi: 'buộc phải',
          role: 'TARGET',
        },
      ],
    });
    expect(md).not.toContain('LEARNER MODEL');
    expect(md).not.toContain('Reaches for');
  });

  it('whole-level focus: vocab follows the focus level (not settings.grammarLevels) + scaffolding note', () => {
    const md = renderDueBatch({
      ...baseBatch,
      // Study set still N5, but the session focuses N3 — vocab must aim N3, not N5.
      settings: { ...DEFAULT_SETTINGS, grammarLevels: ['N5'] },
      focus: { levels: ['N3'], matched: 2, unmatchedPatterns: [], suspendedPatterns: [] },
      items: [
        {
          ...plainItem,
          id: 'a',
          expression: '〜ばかりに',
          meaningVi: 'chỉ vì',
          level: 'N3',
          role: 'TARGET',
          focusHit: true,
        },
      ],
    });
    expect(md).toContain('VOCABULARY: **target N3 exactly**');
    expect(md).toContain('FOCUS: drilling level N3');
    expect(md).toContain('as scaffolding');
    expect(md).not.toContain('bổ sung');
  });

  it('weak spots land on the sheet: top tags header + per-item "lần trước sai"', () => {
    const md = renderDueBatch({
      ...baseBatch,
      weakSpots: {
        topTags: [
          { tag: 'particle', count: 5 },
          { tag: 'conjugation', count: 3 },
        ],
        byItem: { a: ['particle'] },
      },
      items: [
        {
          ...plainItem,
          id: 'a',
          expression: '〜けど',
          meaningVi: 'nhưng',
          role: 'TARGET',
        },
      ],
    });
    expect(md).toContain('WEAK SPOTS (14 days): Trợ từ (5×) · Chia động từ (3×)');
    expect(md).toContain('missed last time: Trợ từ');
  });

  it('mastery mode leads with the recombine banner and no new-pattern intro', () => {
    const md = renderDueBatch({
      ...baseBatch,
      mode: 'MASTERY',
      items: [
        { ...plainItem, id: 'a', expression: '〜ばかりに', meaningVi: 'chỉ vì', role: 'TARGET' },
        { ...plainItem, id: 'b', expression: '〜わけだ', meaningVi: 'hóa ra', role: 'SECONDARY' },
      ],
    });
    expect(md).toContain('**MASTERY MODE**');
    expect(md).toContain('RECOMBINE');
    expect(md).toContain('NEVER introduce a new grammar pattern');
    expect(md).toContain('〜ばかりに'); // the mastered patterns still render as the lô
    expect(md).toContain('ASK whether they want to switch to'); // announce + ask before the first mastery sentence
    expect(md).toContain('a VARIED sample'); // diverse structures, not the soonest-due ones
  });

  it('empty batch flags new patterns sitting outside the study levels', () => {
    const md = renderDueBatch({
      ...baseBatch,
      newBeyondLevels: 38,
      settings: { ...DEFAULT_SETTINGS, grammarLevels: ['N3', 'N4'] },
    });
    expect(md).toContain('38 unlearned NEW patterns');
    expect(md).toContain('N3, N4');
    expect(md).toContain('Do NOT conclude');
  });

  // The other half, and it is the half that was wrong. `newBeyondLevels > 0` says nothing about
  // whether the learner is out of material at the level they STUDY, so on its own it must not send
  // Claude to offer "widen your levels" or "import grammar at your level".
  //
  // Measured in the lab 2026-08-12 on a fresh N5 account: 12 N5 patterns, 3 learned, the batch emptied
  // by settings.dailyNewGrammar with NINE untouched N5 patterns left — and the sheet asked the tutor to
  // push a day-one N5 learner up to N4, or to import more of the very level they already had plenty
  // of. Neither offer could help; the fix that would (raise the daily cap, or wait out the learning
  // step) was already on the HELD BACK line right beside it.
  it('does NOT offer to widen levels while new patterns remain AT the studied level', () => {
    const md = renderDueBatch({
      ...baseBatch,
      newBeyondLevels: 3,
      newAvailable: { grammar: 9 }, // nine unlearned N5 patterns still sitting there
      withheld: [{ expression: '〜てもいいです', reason: 'daily-new-cap', focusHit: false }],
      settings: { ...DEFAULT_SETTINGS, grammarLevels: ['N5'] },
    });
    expect(md).not.toContain('unlearned NEW patterns');
    expect(md).not.toContain('widen levels');
    // The actionable reason is still there — that is what should carry the turn.
    expect(md).toContain('HELD BACK');
    expect(md).toContain('settings.dailyNewGrammar');
  });

  it('carries the do-not-show warning, enrichment digest, leech marker and context guard', () => {
    const md = renderDueBatch({
      ...baseBatch,
      recentContexts: { a: ['đi mua sắm', 'nói chuyện thời tiết'] },
      items: [
        {
          id: 'a',
          expression: '〜けど',
          reading: null,
          meaningVi: 'nhưng',
          level: 'N5',
          notes: null,
          isNew: true,
          role: 'TARGET',
          lapses: 5,
          // A TutorCard (already trimmed by lib/practice.ts), not the stored card.
          enrichment: {
            structure: [],
            usage: 'Mệnh đề thường + けど',
            collocations: ['行きたいけど'],
            pitfalls: ['nhầm với のに'],
            contrasts: [{ with: 'のに', note: 'のに mang sắc thái tiếc nuối' }],
            examples: [{ ja: '高いけど買う。', vi: 'Đắt nhưng vẫn mua.' }],
          },
        },
      ],
    });
    expect(md).toContain('NEVER show this to the user');
    // Every prompt-enforced knob must be ON the sheet (vocab target, char length, patterns, furigana).
    expect(md).toContain('VOCABULARY: **target N5 exactly**');
    expect(md).toContain('~32 characters (Japanese');
    // ONE item in the batch ⇒ the sheet says ONE, even though sentenceSize "medium" asks for 3. This
    // line used to print the SETTING (3) above a list of one, which is the number Claude then tried to
    // hit — see the pair of tests below.
    expect(md).toContain('weave in **1** grammar pattern(s)');
    expect(md).toContain('FURIGANA (Claude does NOT insert it'); // default mode 'app' → Claude doesn't inline
    expect(md).toContain('〜けど');
    expect(md).toContain('usage: Mệnh đề thường + けど');
    expect(md).toContain('pitfall: nhầm với のに');
    expect(md).toContain('LEECH (forgotten 5×');
    expect(md).toContain('AVOID repeating): đi mua sắm · nói chuyện thời tiết');
  });
});

describe('renderLibraryCheck', () => {
  const okCard = JSON.stringify({
    v: 2,
    structure: ['動詞辞書形 + ばかりに'],
    usage: 'MOT-CAU-GIAI-THICH-RAT-DAC-TRUNG-KHONG-DUOC-LO-RA',
    collocations: [],
    example: { ja: 'あ', vi: 'a' },
    examples: [{ ja: 'い', vi: 'b' }],
    pitfalls: ['x'],
    contrasts: [{ with: 'y', note: 'z' }],
  });

  const baseCheck = {
    query: '〜ばかりに',
    mine: [],
    shared: [],
    grammarLevels: ['N3'],
    suggestions: [],
    remaining: 0,
  };

  const mineEntry = {
    itemId: 'i1',
    kind: 'GRAMMAR',
    expression: '〜ばかりに',
    reading: 'ばかりに',
    meaningVi: 'chỉ vì',
    level: 'N3',
    suspended: false,
    tier: 'ok' as const,
    qualityScore: 80,
    missing: [],
    cardVersion: 2,
    srs: { state: 2, due: new Date('2026-09-01T00:00:00Z'), lapses: 0, reps: 4 },
    levelInStudyRange: true,
    card: okCard,
  };

  it('NEVER renders the card content — that is what enforces "reference, not transcript"', async () => {
    const { renderLibraryCheck } = await import('@/lib/mcp/render');
    const md = renderLibraryCheck({ ...baseCheck, mine: [mineEntry] });
    // The single most important assertion in this file: if the card were rendered, the shortest path
    // for any model is to paste the block and stop, and the learner gets a transcript.
    expect(md).not.toContain('MOT-CAU-GIAI-THICH-RAT-DAC-TRUNG-KHONG-DUOC-LO-RA');
    expect(md).not.toContain('動詞辞書形');
    // But the STATUS is there.
    expect(md).toContain('〜ばかりに');
    expect(md).toContain('thẻ đủ');
  });

  it('states plainly when nothing matched, rather than staying silent', async () => {
    const { renderLibraryCheck } = await import('@/lib/mcp/render');
    const md = renderLibraryCheck(baseCheck);
    expect(md).toContain('chưa có mục nào khớp');
  });

  it('names the review state, the missing card parts, and an out-of-range level', async () => {
    const { renderLibraryCheck } = await import('@/lib/mcp/render');
    const md = renderLibraryCheck({
      ...baseCheck,
      mine: [
        {
          ...mineEntry,
          tier: 'thin' as const,
          missing: ['bẫy hay gặp'],
          level: 'N1',
          levelInStudyRange: false,
          srs: { state: 0, due: new Date('2026-07-01T00:00:00Z'), lapses: 0, reps: 0 },
        },
      ],
    });
    expect(md).toContain('chưa học lần nào');
    expect(md).toContain('thiếu: bẫy hay gặp');
    expect(md).toContain('NGOÀI phạm vi đang học (N3)');
  });

  it('numbers the offers and reports the overflow instead of dropping it silently', async () => {
    const { renderLibraryCheck } = await import('@/lib/mcp/render');
    const md = renderLibraryCheck({
      ...baseCheck,
      mine: [mineEntry],
      suggestions: [
        {
          code: 'PRACTICE_DUE' as const,
          class: 'enable' as const,
          priority: 50,
          line: 'Luyện ngay chứ?',
          tool: 'get_due_items',
          args: {},
        },
      ],
      remaining: 3,
    });
    expect(md).toContain('1. Luyện ngay chứ?');
    expect(md).toContain('còn 3 đề xuất khác');
  });
});

describe('renderStats — the session-open block stays a single control surface', () => {
  const baseStats = {
    totalItems: 10,
    newItems: 3,
    dueNow: 2,
    today: { reviews: 0, newGrammar: 0, sentences: 0 },
    streak: { current: 1, longest: 4, lastStudyDay: null },
    reviewsLast7Days: 5,
    dueForecast7Days: {},
    reviewsByDay: [],
    mastery: { new: 3, learning: 0, review: 7, relearning: 0, suspended: 0 },
    weakItems: [],
    settings: DEFAULT_SETTINGS,
  } as unknown as Parameters<typeof renderStats>[0];

  const health = (over: Record<string, unknown> = {}) =>
    ({
      health: {
        retention: {
          measured: 0.72,
          desired: 0.9,
          reviews: 40,
          verdict: 'Bạn đang quên nhiều hơn mức lịch ôn giả định.',
          gapPts: -18,
        },
      },
      suggestions: [
        {
          code: 'SWEEP_ENRICH',
          class: 'sweep',
          priority: 30,
          line: 'Dọn 7 thẻ chứ?',
          tool: 'x',
          args: {},
        },
        {
          code: 'FASTTRACK',
          class: 'quality',
          priority: 25,
          line: 'Ẩn mẫu dưới cấp chứ?',
          tool: 'y',
          args: {},
        },
      ],
      remaining: 0,
      ...over,
    }) as unknown as Parameters<typeof renderStats>[1];

  it('without the health argument it is exactly the old block', () => {
    const md = renderStats(baseStats);
    expect(md).toContain('### Tiến độ');
    expect(md).not.toContain('Ghi nhớ thực tế');
    expect(md).not.toContain('Gợi ý dọn kho');
  });

  // The session OPENER must carry the day's plan, not just the day's tally. Both numbers matter and
  // for different reasons: the goal is what "done" means, and the daily new-pattern cap is what decides
  // whether the goal is reachable at all. On stock defaults they disagree (goal 10, cap 3 — measured in
  // the lab 2026-08-12 to top out near five sentences on day one), and this line is the only place the
  // learner can see that BEFORE spending the day discovering it.
  it('carries the daily goal and the new-pattern cap, not just the tally', () => {
    const md = renderStats({
      ...baseStats,
      today: { reviews: 4, newGrammar: 3, sentences: 2 },
    } as unknown as Parameters<typeof renderStats>[0]);
    expect(md).toContain('câu **2/10**');
    expect(md).toContain('mẫu mới 3/3 (hạn mức ngày)');
  });

  it('shows retention with its verdict, and AT MOST ONE unnumbered suggestion', () => {
    const md = renderStats(baseStats, health());
    expect(md).toContain('**Ghi nhớ thực tế:** 72% (mục tiêu 90%)');
    expect(md).toContain('**Gợi ý dọn kho:** Dọn 7 thẻ chứ?');
    // The second offer must NOT appear, and nothing here may be numbered — MODE_DISPATCH asks a
    // NUMBERED focus menu right after this block, so "1" would become ambiguous.
    expect(md).not.toContain('Ẩn mẫu dưới cấp');
    expect(md).not.toMatch(/^\d+\. /m);
  });

  it('says nothing about retention until there is enough data for a verdict', () => {
    const md = renderStats(
      baseStats,
      health({
        health: {
          retention: {
            measured: null,
            desired: 0.9,
            reviews: 3,
            verdict: 'Chưa đủ dữ liệu.',
            gapPts: null,
          },
        },
      }),
    );
    expect(md).not.toContain('Ghi nhớ thực tế');
  });
});

/**
 * TEACH-BACK HARVEST (plan step 7.2/7.3) — the note the server appends after a graded teach-back turn.
 *
 * These are COUPLING tests, not formatting tests. The note only works if the protocol tells Claude to
 * watch for it: `TEACH_BACK_PROTOCOL` step 7 quotes the marker verbatim, so a renamed marker on one
 * side and not the other means Claude waits for a heading that never arrives and the whole harvest
 * loop goes silent — with nothing failing. That is exactly the kind of drift a unit test cannot see
 * and a live session finds three weeks later.
 */
/**
 * REGRESSION GUARD for a defect the unit tests could not see and driving the lab found immediately
 * (2026-07-27): the result block labelled EVERY turn from `direction` alone, so a teach-back turn
 * showed the learner "Đề (Nhật → Việt)" over the pattern and called their EXPLANATION "Bạn dịch".
 * This block is the one thing Claude must copy verbatim — a wrong label here is the app telling the
 * learner they did something they did not do.
 */
describe('the result block names what the learner actually DID', () => {
  const teachBackResult: SubmitReviewResult = {
    ratingNotes: [],
    sentenceId: 's2',
    direction: 'JA_VI',
    exerciseType: 'TEACH_BACK',
    sourceText: '〜つつある',
    userAnswer: 'Gắn sau động từ thể ます bỏ ます, diễn tả một quá trình đang dần diễn ra.',
    suggested: 'Diễn tả một quá trình ĐANG dần dần diễn ra và tiếp tục theo một hướng.',
    items: [
      {
        itemId: 'a',
        expression: '〜つつある',
        rating: 4,
        state: 2,
        nextDue: new Date('2026-07-09T10:00:00Z'),
        intervalDays: 3,
      },
    ],
    score: 90,
    today: { reviews: 1, newGrammar: 0, sentences: 1 },
    dueNow: 0,
    nextDueAt: null,
    sessionGoal: 10,
    calibration: null,
    learnerNote: null,
    teachBack: null,
  };

  it('a teach-back turn is never called a translation', () => {
    const md = renderGradeResult(teachBackResult, NOW);
    expect(md).toContain('**Mẫu:** 〜つつある');
    expect(md).toContain('**Bạn giảng:**');
    expect(md).not.toContain('Bạn dịch');
    expect(md).not.toContain('Nhật → Việt');
    expect(md).toContain('1. Mẫu tiếp');
  });

  it('a failed teach-back offers a fuller EXPLANATION, not a rewritten translation', () => {
    const md = renderGradeResult(
      { ...teachBackResult, items: [{ ...teachBackResult.items[0], rating: 1 }] },
      NOW,
    );
    expect(md).toContain('Giảng lại cho đủ phần còn thiếu');
    expect(md).not.toContain('Gõ lại bản dịch');
    expect(md).toContain('KHÔNG chấm lại'); // consolidation-only rule survives the rewording
  });

  it('leaves every other exercise type worded exactly as before', () => {
    const md = renderGradeResult({ ...teachBackResult, exerciseType: 'TRANSLATION' }, NOW);
    expect(md).toContain('**Đề (Nhật → Việt):**');
    expect(md).toContain('**Bạn dịch:**');
    expect(md).toContain('1. Câu tiếp');
  });
});

describe('renderTeachBackHarvest — coupled to the protocol that reads it', () => {
  const harvest = {
    itemId: 'i1',
    expression: '〜ばかりに',
    usage: 'lời giảng của người học',
    rating: 4,
  };

  it('says nothing when the turn produced nothing worth harvesting', () => {
    expect(renderTeachBackHarvest(null)).toBeNull();
  });

  it('emits the exact marker the teach-back protocol tells Claude to watch for', () => {
    const note = renderTeachBackHarvest(harvest)!;
    const marker = 'TEACH-BACK HARVEST';
    expect(note).toContain(marker);
    expect(TEACH_BACK_PROTOCOL).toContain(marker);
  });

  it('names the same tool on both sides — the offer must be actionable', () => {
    expect(renderTeachBackHarvest(harvest)).toContain('enrich_items');
    expect(TEACH_BACK_PROTOCOL).toContain('patch_enrichment');
  });

  it('is a plain instruction, never a numbered option (one control surface per message)', () => {
    // The verbatim result block right above it ends with the numbered "Tiếp theo?" menu; a numbered
    // line here would make the learner's "1" ambiguous.
    expect(renderTeachBackHarvest(harvest)).not.toMatch(/^\d+\. /m);
  });

  it('demands a yes and forbids rewriting the learner into Claude voice', () => {
    const note = renderTeachBackHarvest(harvest)!;
    expect(note).toMatch(/WAIT for a yes/);
    expect(note).toMatch(/never rewrite it into your own voice/);
    // The whole point of the harvest — losing this sentence loses the reason the feature exists.
    expect(TEACH_BACK_PROTOCOL).toMatch(/do NOT rewrite it into your voice/);
  });
});

describe('the teach-back mode is reachable and self-consistent', () => {
  it('MODE_DISPATCH routes to it and names the get_protocol mode that loads it', () => {
    expect(MODE_DISPATCH).toContain('PART D — TEACH-BACK');
    expect(MODE_DISPATCH).toContain('"teachback"');
  });

  it('the protocol stages with an exerciseType the schema actually accepts', () => {
    expect(TEACH_BACK_PROTOCOL).toContain('exerciseType: "TEACH_BACK"');
    expect(EXERCISE_TYPE.options).toContain('TEACH_BACK');
  });

  it('stages JA_VI, so history never reads a Vietnamese explanation aloud in Japanese', () => {
    // History branches on DIRECTION (components/history/history-cards.tsx): under VI_JA the answer is
    // treated as Japanese content and handed to SpokenLine + Japanese TTS. The plan wrote VI_JA; this
    // pins the correction.
    expect(TEACH_BACK_PROTOCOL).toContain('direction: "JA_VI"');
    expect(TEACH_BACK_PROTOCOL).not.toContain('direction: "VI_JA"');
  });

  it('the session prompt carries the dispatcher AND only this loop', () => {
    expect(TEACH_BACK_SESSION).toContain(MODE_DISPATCH);
    expect(TEACH_BACK_SESSION).toContain(TEACH_BACK_PROTOCOL);
    expect(TEACH_BACK_SESSION).not.toContain('PART B — MULTIPLE-CHOICE QUIZ A–D');
  });
});

/**
 * CONSENT GUARD — the gate for the one eval failure that could damage the learner's library.
 *
 * Eval Scenario I, 2026-07-27: 1 of 3 trials called `patch_enrichment` in the SAME message as the
 * offer, with no yes, and then told the learner it had. The prohibition already existed in the
 * `check_library` description — as a NEGATION triggered by an ABSENT field (`auto` unset), sitting next
 * to a positive imperative for the exception. This asserts the fix's actual mechanism: both states are
 * PRESENT and POSITIVE, and each names the exact tool.
 */
describe('renderConsentGuard — a write needs a yes, and absence is not a signal', () => {
  const offer = (over: Partial<Suggestion> = {}): Suggestion => ({
    code: 'MINED_CONTRAST',
    class: 'quality',
    priority: 44,
    line: 'thêm mục phân biệt hai mẫu này vào thẻ chứ?',
    tool: 'patch_enrichment',
    args: { itemId: 'i1' },
    ...over,
  });

  it('says nothing when there was no proposal — a quiet result stays quiet', () => {
    expect(renderConsentGuard([])).toBeNull();
  });

  // An offer the server cannot pin to ONE tool must hold BOTH back. Found in the lab 2026-08-12: the
  // ADD_MISSING offer for a looked-up word named `add_grammar` while the write Claude would actually
  // reach for was `add_vocab` — so the guard printed, looked reassuring, and covered the wrong tool. A
  // consent guard with a hole in it reads exactly like one without.
  it('holds back the second candidate tool too, not just the first', () => {
    const note = renderConsentGuard([
      offer({ code: 'ADD_MISSING', class: 'enable', tool: 'add_vocab', alsoTool: 'add_grammar' }),
    ])!;
    expect(note).toContain('add_vocab');
    expect(note).toContain('add_grammar');
  });

  it('names the exact tool that must WAIT, not just the rule', () => {
    const note = renderConsentGuard([offer()])!;
    expect(note).toContain('patch_enrichment');
    expect(note).toMatch(/CONSENT/);
    expect(note).toMatch(/STOP/);
    // The observed failure was reporting the change as done. Forbid that in words.
    expect(note).toMatch(/as if it happened/);
  });

  it('gives the pre-authorised case its own POSITIVE instruction', () => {
    const note = renderConsentGuard([offer({ auto: true })])!;
    expect(note).toContain('PRE-AUTHORISED');
    expect(note).toContain('patch_enrichment');
    // With every offer pre-authorised there is nothing to hold back, so no prohibition is emitted.
    expect(note).not.toContain('CONSENT:');
  });

  it('emits BOTH halves when a result mixes them, so neither is inferred from the other absence', () => {
    // Cặp tool đứng đây từng là `fork_shared_items` (2026-08-11: tool đó không còn được đăng ký, và mã
    // `FORK_SHARED` đã rời union). Đổi sang một tool CÓ THẬT — điều đang kiểm là "một result trộn hai
    // nửa thì cả hai nửa phải được in ra", không phụ thuộc tool nào.
    const note = renderConsentGuard([
      offer(),
      offer({ code: 'ADD_MISSING', tool: 'add_grammar', auto: true }),
    ])!;
    expect(note).toContain('CONSENT:');
    expect(note).toContain('PRE-AUTHORISED');
    expect(note).toMatch(/may not call patch_enrichment/);
    expect(note).toMatch(/add_grammar may be called NOW/);
  });

  it('lists each tool once however many offers share it', () => {
    const note = renderConsentGuard([offer(), offer({ code: 'ENRICH_THIN' })])!;
    expect(note.match(/patch_enrichment/g)).toHaveLength(1);
  });

  it('is never a numbered list — the block above it owns the numbers', () => {
    expect(renderConsentGuard([offer()])).not.toMatch(/^\d+\. /m);
  });
});

describe('renderScaffold — declared scaffolding', () => {
  const known = {
    expression: '〜ておく',
    status: 'known' as const,
    level: 'N4' as const,
    itemId: 'it-1',
    aboveDrilledLevel: false,
  };

  it('stays SILENT when everything declared is already known and in range', () => {
    // A note that fires on every turn is a note that gets skipped. It competes for attention with
    // the exercise the learner is waiting for, so a quiet turn must stay quiet.
    expect(renderScaffold([known])).toBeNull();
    expect(renderScaffold([])).toBeNull();
  });

  it('names a pattern the learner has never met and asks for ONE line plus an offer', () => {
    const md = renderScaffold([
      { expression: '〜つつ', status: 'newToLearner', level: null, aboveDrilledLevel: false },
    ]);
    expect(md).toContain('〜つつ');
    expect(md).toContain('NOWHERE');
    expect(md).toContain('add_grammar');
    expect(md).toContain('WAIT');
  });

  // Ca "routes a shared-library pattern to fork_shared_items with its real id" đã bị xoá 2026-08-11:
  // `ScaffoldStatus.availableInSharedLibrary` không còn tồn tại, `classifyExtraPatterns` chưa bao giờ
  // gán nó, và `fork_shared_items` không còn được đăng ký. Ca `newToLearner` ngay trên vẫn gác nhánh
  // duy nhất còn lại.

  it('flags scaffolding above the drilled level even when the pattern is KNOWN', () => {
    // The level rule is about difficulty, not about ownership: a pattern the learner owns can still
    // be too hard to use as free material in a sentence drilling something easier.
    const md = renderScaffold([
      { ...known, expression: '〜ざるを得ない', level: 'N2', aboveDrilledLevel: true },
    ]);
    expect(md).toContain('HARDER than the level');
    expect(md).toContain('N2');
  });

  it('reminds that offering is what turns scaffolding into something graded', () => {
    const md = renderScaffold([
      { expression: '〜つつ', status: 'newToLearner', level: null, aboveDrilledLevel: false },
    ]);
    expect(md).toContain('NOT graded');
  });
});
