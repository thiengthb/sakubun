import { describe, expect, it } from 'vitest';
import {
  CLUSTER_MIN_MISSES,
  coach,
  coachLibrary,
  coachTeachBack,
  MAX_SUGGESTIONS,
  MAX_SUGGESTIONS_MID_SESSION,
  type CoachInput,
  type ItemFacts,
  SWEEP_MIN_NEEDS_WORK,
  type LibraryHealthFacts,
  type SuggestionCode,
  type TeachBackFacts,
  TEACH_BACK_MAX_CHARS,
  TEACH_BACK_MIN_RATING,
} from '@/lib/session/coach';
import { scoreEnrichment } from '@/lib/library/enrichment-quality';
import { GRAMMAR_KIND } from '@/lib/library/item-kinds';

const scoreGrammarCard = (raw: string | null | undefined) => scoreEnrichment(raw, GRAMMAR_KIND);
import { CURRENT_ENRICHMENT_VERSION } from '@/lib/library/enrichment';
import { LEECH_LAPSES } from '@/lib/srs/srs';

const NOW = new Date('2026-07-27T10:00:00Z');

const OK_CARD = JSON.stringify({
  v: CURRENT_ENRICHMENT_VERSION,
  structure: ['動詞辞書形 + ばかりに'],
  usage: 'Diễn tả chỉ vì một lý do nhỏ mà dẫn đến kết quả xấu ngoài ý muốn.',
  collocations: [],
  example: { ja: 'あ', vi: 'a' },
  examples: [{ ja: 'い', vi: 'b' }],
  pitfalls: ['x'],
  contrasts: [{ with: 'y', note: 'z' }],
});

function item(patch: Partial<ItemFacts> = {}): ItemFacts {
  return {
    itemId: 'i1',
    kind: 'GRAMMAR',
    expression: '〜ばかりに',
    level: 'N3',
    suspended: false,
    hasKanji: false,
    hanviet: null,
    quality: scoreGrammarCard(OK_CARD),
    contrastTargets: ['y'],
    srs: { state: 2, due: new Date('2026-08-01T00:00:00Z'), lapses: 0 },
    ...patch,
  };
}

function input(patch: Partial<CoachInput> = {}): CoachInput {
  return {
    query: '〜ばかりに',
    mine: [item()],
    settings: { grammarLevels: ['N3'] },
    now: NOW,
    ...patch,
  };
}

const codes = (i: CoachInput): SuggestionCode[] => coach(i).suggestions.map((s) => s.code);

const THIN_CARD = JSON.stringify({
  v: CURRENT_ENRICHMENT_VERSION,
  structure: [],
  usage: 'Ngắn quá.',
  collocations: [],
  example: { ja: 'あ', vi: 'a' },
  examples: [],
  pitfalls: [],
  contrasts: [],
});

describe('coach — the scenarios the flagship depends on', () => {
  it('not mine and not shared → offer to ADD it', () => {
    expect(codes(input({ mine: [] }))).toContain('ADD_MISSING');
  });

  describe('ADD_MISSING names the right tool', () => {
    const missing = (kind?: 'GRAMMAR' | 'VOCAB') =>
      coach({ ...input({ mine: [] }), kind }).suggestions.find((s) => s.code === 'ADD_MISSING')!;

    it('a VOCAB lookup points at add_vocab, with add_vocab’s own argument key', () => {
      const s = missing('VOCAB');
      expect(s.tool).toBe('add_vocab');
      expect(s.alsoTool).toBeUndefined();
      expect(s.args).toHaveProperty('vocab');
    });

    it('a GRAMMAR lookup points at add_grammar, with add_grammar’s own argument key', () => {
      const s = missing('GRAMMAR');
      expect(s.tool).toBe('add_grammar');
      expect(s.alsoTool).toBeUndefined();
      expect(s.args).toHaveProperty('grammar');
    });

    it('an unqualified lookup defaults to vocabulary and still names grammar', () => {
      const s = missing();
      expect(s.tool).toBe('add_vocab');
      expect(s.alsoTool).toBe('add_grammar');
    });

    it('never proposes the argument key that belongs to neither tool', () => {
      for (const kind of ['GRAMMAR', 'VOCAB', undefined] as const) {
        expect(missing(kind).args).not.toHaveProperty('items');
      }
    });
  });

  it('suspended → the BLOCKER wins over any card-polish offer', () => {
    const result = coach(
      input({ mine: [item({ suspended: true, quality: scoreGrammarCard(null) })] }),
    );
    expect(result.suggestions[0].code).toBe('UNSUSPEND');
    expect(result.suggestions[0].class).toBe('blocker');
  });

  it('never studied + level outside the study range → say WHY, and offer to widen', () => {
    const result = coach(
      input({
        mine: [item({ level: 'N1', srs: { state: 0, due: NOW, lapses: 0 } })],
        settings: { grammarLevels: ['N3'] },
      }),
    );
    const widen = result.suggestions.find((s) => s.code === 'WIDEN_LEVELS');
    expect(widen).toBeTruthy();
    expect(widen!.line).toContain('N1');
    expect(widen!.args).toEqual({ grammarLevels: ['N3', 'N1'] });
  });

  it('a leech is offered as an isolation drill', () => {
    const result = coach(
      input({ mine: [item({ srs: { state: 2, due: NOW, lapses: LEECH_LAPSES } })] }),
    );
    const drill = result.suggestions.find((s) => s.code === 'LEECH_DRILL');
    expect(drill).toBeTruthy();
    expect(drill!.tool).toBe('get_due_items');
    expect(drill!.args).toEqual({ focusPatterns: ['〜ばかりに'] });
  });

  it('never studied and in range → offer to learn it now', () => {
    expect(codes(input({ mine: [item({ srs: { state: 0, due: NOW, lapses: 0 } })] }))).toContain(
      'PRACTICE_NEW',
    );
  });

  it('a NEVER-STUDIED item is never offered as "due for review"', () => {
    const result = coach(
      input({
        mine: [item({ level: 'N1', srs: { state: 0, due: NOW, lapses: 0 } })],
        settings: { grammarLevels: ['N3'] },
      }),
    );
    const emitted = result.suggestions.map((s) => s.code);
    expect(emitted).not.toContain('PRACTICE_DUE');
    expect(emitted).toContain('WIDEN_LEVELS');
  });

  it('due now → offer to practise it', () => {
    expect(
      codes(input({ mine: [item({ srs: { state: 2, due: new Date(NOW), lapses: 0 } })] })),
    ).toContain('PRACTICE_DUE');
  });

  it('not due, card fine → nothing at all is proposed (silence is a valid answer)', () => {
    const result = coach(input());
    expect(result.suggestions).toEqual([]);
    expect(result.remaining).toBe(0);
  });
});

describe('coach — the four card states each get their OWN repair', () => {
  const withCard = (raw: string | null) =>
    codes(input({ mine: [item({ quality: scoreGrammarCard(raw) })] }));

  it('no card → enrich_items', () => {
    expect(withCard(null)).toContain('ENRICH_MISSING');
  });

  it('unparseable card → REWRITE, and it outranks the other card offers', () => {
    const result = coach(
      input({ mine: [item({ quality: scoreGrammarCard('{"collocations":["x"]}') })] }),
    );
    expect(result.suggestions[0].code).toBe('ENRICH_BROKEN');
    expect(result.suggestions[0].tool).toBe('enrich_items');
  });

  it('thin card → PATCH the named gaps, never overwrite', () => {
    const thin = JSON.stringify({ usage: 'Chỉ vì gì đó xảy ra.', example: { ja: 'あ', vi: 'a' } });
    const result = coach(input({ mine: [item({ quality: scoreGrammarCard(thin) })] }));
    const s = result.suggestions.find((x) => x.code === 'ENRICH_THIN');
    expect(s).toBeTruthy();
    expect(s!.tool).toBe('patch_enrichment'); // NOT enrich_items — that would wipe the rest
    expect(s!.line).toContain('bẫy hay gặp');
  });

  it('card complete but on an older format → offer the version upgrade', () => {
    const old = JSON.parse(OK_CARD) as Record<string, unknown>;
    old.v = 1;
    const result = coach(
      input({ mine: [item({ quality: scoreGrammarCard(JSON.stringify(old)) })] }),
    );
    const s = result.suggestions.find((x) => x.code === 'ENRICH_OUTDATED');
    expect(s).toBeTruthy();
    expect(s!.line).toContain('v1');
  });

  it('một item KHÔNG có thẻ đọc được thì nhận đề nghị ghi đủ, không phải một merge', () => {
    for (const raw of [null, '{"collocations":["x"]}']) {
      const result = coach(input({ mine: [item({ quality: scoreGrammarCard(raw) })] }));
      const emitted = result.suggestions.map((s) => s.code);
      expect(emitted.some((c) => c === 'ENRICH_MISSING' || c === 'ENRICH_BROKEN')).toBe(true);
    }
  });

  it('a kanji VOCAB word without âm Hán Việt is offered the fill', () => {
    const result = coach(
      input({
        mine: [item({ kind: 'VOCAB', expression: '遠慮', hasKanji: true, hanviet: null })],
      }),
    );
    expect(result.suggestions.map((s) => s.code)).toContain('VOCAB_SINOVIET');
  });

  it('a kana VOCAB word is NOT asked for âm Hán Việt', () => {
    const result = coach(
      input({ mine: [item({ kind: 'VOCAB', expression: 'ください', hasKanji: false })] }),
    );
    expect(result.suggestions.map((s) => s.code)).not.toContain('VOCAB_SINOVIET');
  });
});

describe('coach — a mined confusion is evidence the SERVER holds, so it IS a code here', () => {
  const pair = {
    used: 'ほかに',
    required: '〜ばかりに',
    count: 4,
    weight: 3.2,
    evidence: ['s1'],
    itemIds: ['i1'],
  };

  it('offers the contrast the learner keeps getting wrong, with the count in the line', () => {
    const result = coach(input({ minedPairs: [pair] }));
    const s = result.suggestions.find((x) => x.code === 'MINED_CONTRAST');
    expect(s).toBeTruthy();
    expect(s!.tool).toBe('patch_enrichment'); // it MERGES — the card is otherwise fine
    expect(s!.line).toContain('4 lần');
    expect(s!.line).toContain('ほかに');
  });

  it('stays quiet when the card ALREADY draws that distinction', () => {
    const result = coach(
      input({ mine: [item({ contrastTargets: ['「ほかに」'] })], minedPairs: [pair] }),
    );
    expect(result.suggestions.map((s) => s.code)).not.toContain('MINED_CONTRAST');
  });

  it('does not fire for a different pattern', () => {
    const other = { ...pair, required: '〜どころか' };
    expect(codes(input({ minedPairs: [other] }))).not.toContain('MINED_CONTRAST');
  });

  it('with no card to patch it is NOT dropped — it rides the write-a-card offer instead', () => {
    for (const [raw, code] of [
      [null, 'ENRICH_MISSING'],
      ['{"collocations":["x"]}', 'ENRICH_BROKEN'],
    ] as const) {
      const result = coach(
        input({
          mine: [item({ quality: scoreGrammarCard(raw), contrastTargets: [] })],
          minedPairs: [pair],
        }),
      );
      expect(result.suggestions.map((s) => s.code)).not.toContain('MINED_CONTRAST');
      const write = result.suggestions.find((s) => s.code === code);
      expect(write, `${code} should carry the evidence`).toBeTruthy();
      expect(write!.line).toContain('ほかに');
      expect(write!.line).toContain('4 lần');
    }
  });
});

describe('coach — ranking and caps', () => {
  it('a blocker always outranks enable, quality and sweep', () => {
    const result = coach(
      input({
        mine: [
          item({
            suspended: true,
            quality: scoreGrammarCard(null),
            srs: { state: 2, due: NOW, lapses: LEECH_LAPSES },
          }),
        ],
      }),
    );
    expect(result.suggestions[0].class).toBe('blocker');
  });

  it('never more than MAX_SUGGESTIONS, and the overflow is COUNTED not dropped silently', () => {
    const result = coach(
      input({
        mine: [
          item({
            itemId: 'a',
            suspended: true,
            quality: scoreGrammarCard(null),
            srs: { state: 0, due: NOW, lapses: 0 },
            level: 'N1',
          }),
          item({ itemId: 'b', expression: '〜つつある', quality: scoreGrammarCard(null) }),
        ],
      }),
    );
    expect(result.suggestions.length).toBeLessThanOrEqual(MAX_SUGGESTIONS);
    expect(result.remaining).toBeGreaterThan(0);
  });

  it('at most ONE per class — two offers are never both "enrich something"', () => {
    const result = coach(
      input({
        mine: [
          item({ itemId: 'a', quality: scoreGrammarCard(null) }),
          item({ itemId: 'b', expression: '〜つつある', quality: scoreGrammarCard(null) }),
        ],
      }),
    );
    const qualityCount = result.suggestions.filter((s) => s.class === 'quality').length;
    expect(qualityCount).toBeLessThanOrEqual(1);
  });

  it('mid-session shows ONE offer — there is a pending exercise to return to', () => {
    const result = coach(
      input({
        midSession: true,
        mine: [item({ suspended: true, quality: scoreGrammarCard(null) })],
      }),
    );
    expect(result.suggestions.length).toBeLessThanOrEqual(MAX_SUGGESTIONS_MID_SESSION);
  });

  it('a pattern withheld by the daily new cap becomes an actionable blocker', () => {
    const result = coach(input({ mine: [], withheldByNewCap: ['〜かねる'] }));
    const raise = result.suggestions.find((s) => s.code === 'RAISE_NEW_CAP');
    expect(raise).toBeTruthy();
    expect(raise!.class).toBe('blocker');
    expect(raise!.line).toContain('〜かねる');
  });
});

const TOOL_ARGS: Record<string, readonly string[]> = {
  add_grammar: ['grammar'],
  add_vocab: ['vocab'],
  get_due_items: ['maxItems', 'focusLevels', 'focusPatterns', 'focusWeak', 'groupId'],
  set_item_suspended: ['itemId', 'suspended'],
  set_below_target_suspended: ['suspended'],
  suggest_group: ['name', 'kind', 'itemIds'],
  list_grammar: ['level', 'search', 'suspended', 'enriched', 'quality', 'limit'],
  update_settings: [
    'grammarLevels',
    'vocabCeiling',
    'direction',
    'difficulty',
    'sentenceSize',
    'translationStyle',
    'register',
    'topics',
    'dailyNewGrammar',
    'maxNewPerSentence',
    'maxReviewsPerDay',
    'vocabPerSentence',
    'sessionGoal',
    'desiredRetention',
    'furiganaMode',
    'promptModality',
    'answerModality',
    'voiceSpeaker',
    'speechRate',
    'dayCutoffHour',
    'autoCapture',
    'patch',
  ],
  enrich_items: ['items'],
  patch_enrichment: ['itemId', 'add', 'set'],
  update_vocab: ['itemId', 'expression', 'reading', 'sinoVietnamese', 'meaningVi', 'notes', 'level'],
};

const HEALTH_BASE: LibraryHealthFacts = {
  needsWorkAtStudiedLevels: 0,
  outdatedCards: 0,
  belowTargetActive: 0,
  retention: { kind: 'on-target', gapPts: 0 },
  desiredRetention: 0.9,
  weakCluster: null,
};
const SWEEP_CASES: LibraryHealthFacts[] = [
  { ...HEALTH_BASE, needsWorkAtStudiedLevels: 99 }, // SWEEP_ENRICH
  { ...HEALTH_BASE, outdatedCards: 99 }, // SWEEP_MIGRATE
  { ...HEALTH_BASE, belowTargetActive: 99 }, // FASTTRACK
  { ...HEALTH_BASE, retention: { kind: 'below', gapPts: -18 } }, // TUNE_RETENTION (tighten)
  { ...HEALTH_BASE, retention: { kind: 'above', gapPts: 8 } }, // TUNE_RETENTION (loosen)
  {
    ...HEALTH_BASE,
    weakCluster: { tag: 'particle', label: 'Trợ từ', misses: 12, itemIds: ['a', 'b', 'c', 'd'] },
  }, // SUGGEST_GROUP
];

describe('coach — every suggestion is a call that would actually work', () => {
  it('pre-fills only arguments the named tool accepts', () => {
    const cases: CoachInput[] = [
      input({ mine: [] }),
      input({ mine: [item({ suspended: true })] }),
      input({ mine: [item({ level: 'N1', srs: { state: 0, due: NOW, lapses: 0 } })] }),
      input({ mine: [item({ quality: scoreGrammarCard(THIN_CARD) })] }),
      input({ mine: [item({ kind: 'VOCAB', hasKanji: true, hanviet: null })] }),
      input({ withheldByNewCap: ['〜かねる'] }),
      input({ mine: [], kind: 'GRAMMAR' }), // the other ADD_MISSING branch — a different tool + key
    ];
    const seen = new Set<string>();
    const produced = [...cases.map((c) => coach(c)), ...SWEEP_CASES.map(coachLibrary)];
    for (const c of produced) {
      for (const s of c.suggestions) {
        const allowed = TOOL_ARGS[s.tool];
        expect(allowed, `no arg contract known for tool ${s.tool}`).toBeDefined();
        for (const [key, value] of Object.entries(s.args)) {
          expect(allowed, `${s.code} → ${s.tool} { ${key} }`).toContain(key);
          expect(value, `${s.code} → ${s.tool} { ${key}: ${String(value)} } is a placeholder`).not
            .toBeNull();
          expect(value, `${s.code} → ${s.tool} { ${key} } is undefined`).toBeDefined();
        }
        seen.add(s.code);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(11);
  });
});

describe('coach — every suggestion is actionable', () => {
  it('carries a real tool name, pre-filled args, and a Vietnamese line', () => {
    const cases: CoachInput[] = [
      input({ mine: [] }),
      input({ mine: [item({ suspended: true })] }),
      input({ mine: [item({ quality: scoreGrammarCard(null) })] }),
      input({ mine: [item({ srs: { state: 0, due: NOW, lapses: 0 } })] }),
      input({ mine: [item({ srs: { state: 2, due: NOW, lapses: LEECH_LAPSES } })] }),
    ];
    for (const c of cases) {
      for (const s of coach(c).suggestions) {
        expect(s.tool).toMatch(/^[a-z_]+$/); // a real snake_case tool name
        expect(typeof s.args).toBe('object');
        expect(s.line.length).toBeGreaterThan(10);
        expect(s.line).not.toMatch(/[A-Z_]{4,}/); // no code names leaking into learner-facing copy
      }
    }
  });
});

describe('coachLibrary — the whole-kho sweeps', () => {
  const healthy: LibraryHealthFacts = {
    needsWorkAtStudiedLevels: 0,
    outdatedCards: 0,
    belowTargetActive: 0,
    retention: { kind: 'on-target', gapPts: 1 },
    desiredRetention: 0.9,
    weakCluster: null,
  };

  it('a healthy library gets NO offers — silence is the normal answer', () => {
    expect(coachLibrary(healthy)).toEqual({ suggestions: [], remaining: 0 });
  });

  it('stays quiet just below each threshold, and speaks at it', () => {
    expect(
      coachLibrary({ ...healthy, needsWorkAtStudiedLevels: SWEEP_MIN_NEEDS_WORK - 1 }).suggestions,
    ).toEqual([]);
    const at = coachLibrary({ ...healthy, needsWorkAtStudiedLevels: SWEEP_MIN_NEEDS_WORK });
    expect(at.suggestions[0].code).toBe('SWEEP_ENRICH');
    expect(at.suggestions[0].tool).toBe('list_grammar');
    expect(at.suggestions[0].args).toMatchObject({ quality: 'missing' });
  });

  it('retention off target proposes the move in the RIGHT direction, both ways', () => {
    const below = coachLibrary({
      ...healthy,
      retention: { kind: 'below', gapPts: -12 },
      desiredRetention: 0.9,
    }).suggestions[0];
    expect(below.code).toBe('TUNE_RETENTION');
    expect(below.args.desiredRetention).toBeGreaterThan(0.9);

    const above = coachLibrary({
      ...healthy,
      retention: { kind: 'above', gapPts: 9 },
      desiredRetention: 0.9,
    }).suggestions[0];
    expect(above.args.desiredRetention).toBeLessThan(0.9);

    expect(
      coachLibrary({ ...healthy, retention: { kind: 'insufficient', gapPts: null } }).suggestions,
    ).toEqual([]);
  });

  it('a tag cluster on too FEW items is a hard pattern, not a group worth creating', () => {
    const oneItem = coachLibrary({
      ...healthy,
      weakCluster: { tag: 'particle', label: 'Trợ từ', misses: 20, itemIds: ['a'] },
    });
    expect(oneItem.suggestions).toEqual([]);

    const spread = coachLibrary({
      ...healthy,
      weakCluster: {
        tag: 'particle',
        label: 'Trợ từ',
        misses: CLUSTER_MIN_MISSES,
        itemIds: ['a', 'b', 'c'],
      },
    }).suggestions[0];
    expect(spread.code).toBe('SUGGEST_GROUP');
    expect(spread.args).toMatchObject({ itemIds: ['a', 'b', 'c'] });
  });

  it('never floods: the same caps as a lookup, and the count of what was dropped', () => {
    const messy = coachLibrary({
      needsWorkAtStudiedLevels: 50,
      outdatedCards: 50,
      belowTargetActive: 200,
      retention: { kind: 'below', gapPts: -20 },
      desiredRetention: 0.9,
      weakCluster: { tag: 'particle', label: 'Trợ từ', misses: 30, itemIds: ['a', 'b', 'c'] },
    });
    expect(messy.suggestions.length).toBeLessThanOrEqual(MAX_SUGGESTIONS);
    expect(new Set(messy.suggestions.map((s) => s.class)).size).toBe(messy.suggestions.length);
    expect(messy.remaining).toBeGreaterThan(0);
  });
});

describe('autoCapture — pre-authorisation marks the offer, it never writes', () => {
  const off = { vocab: false, enrichPatch: false };
  const thinOne = () => input({ mine: [item({ quality: scoreGrammarCard(THIN_CARD) })] });

  it('defaults ask first — nothing is marked auto', () => {
    const r = coach(thinOne());
    expect(r.suggestions[0].code).toBe('ENRICH_THIN');
    expect(r.suggestions[0].auto).toBeUndefined();
  });

  it('marks ONLY the class the learner turned on', () => {
    const r = coach(
      input({
        mine: [item({ quality: scoreGrammarCard(THIN_CARD) })],
        settings: { grammarLevels: ['N3'], autoCapture: { ...off, enrichPatch: true } },
      }),
    );
    expect(r.suggestions[0].auto).toBe(true);

    const other = coach(
      input({
        mine: [item({ quality: scoreGrammarCard(THIN_CARD) })],
        settings: { grammarLevels: ['N3'], autoCapture: { ...off, vocab: true } },
      }),
    );
    expect(other.suggestions[0].auto).toBeUndefined();
  });

  it('enrichPatch covers the MERGE tool and never the overwrite tool', () => {
    const settings = { grammarLevels: ['N3'] as const, autoCapture: { ...off, enrichPatch: true } };
    const thin = coach(
      input({
        mine: [item({ quality: scoreGrammarCard(THIN_CARD) })],
        settings: { grammarLevels: [...settings.grammarLevels], autoCapture: settings.autoCapture },
      }),
    ).suggestions.find((s) => s.tool === 'patch_enrichment');
    expect(thin?.auto).toBe(true);

    const broken = coach(
      input({
        mine: [item({ quality: scoreGrammarCard('{"collocations":["x"]}') })],
        settings: {
          grammarLevels: [...settings.grammarLevels],
          autoCapture: { vocab: true, enrichPatch: true },
        },
      }),
    ).suggestions.find((s) => s.tool === 'enrich_items');
    expect(broken).toBeTruthy();
    expect(broken?.auto).toBeUndefined();
  });
});

describe('coachTeachBack — the learner own words become card content, or nothing does', () => {
  const GOOD =
    'Mẫu này gắn sau động từ thể từ điển, diễn tả chỉ vì một chuyện nhỏ mà dẫn tới hậu quả xấu ' +
    'ngoài ý muốn — người nói thường mang giọng tiếc nuối.';

  const facts = (over: Partial<TeachBackFacts> = {}): TeachBackFacts => ({
    itemId: 'i1',
    expression: '〜ばかりに',
    rating: 4,
    explanation: GOOD,
    hasCard: false,
    ...over,
  });

  it('offers a well-graded explanation on a pattern that has no card', () => {
    const harvest = coachTeachBack(facts());
    expect(harvest).toMatchObject({ itemId: 'i1', expression: '〜ばかりに', rating: 4 });
    expect(harvest?.usage).toBe(GOOD);
  });

  it('never touches a pattern that ALREADY has a card', () => {
    expect(coachTeachBack(facts({ hasCard: true }))).toBeNull();
  });

  it.each([1, 2])('refuses to harvest an explanation graded %i', (rating) => {
    expect(coachTeachBack(facts({ rating }))).toBeNull();
  });

  it('fires at exactly the minimum rating, not one above it', () => {
    expect(coachTeachBack(facts({ rating: TEACH_BACK_MIN_RATING }))).not.toBeNull();
  });

  it('rejects an answer too short to be a usage line', () => {
    expect(coachTeachBack(facts({ explanation: 'Nghĩa là buộc phải làm.' }))).toBeNull();
  });

  it('rejects an essay — the usage field is one line of nuance, not a transcript', () => {
    expect(coachTeachBack(facts({ explanation: 'a'.repeat(TEACH_BACK_MAX_CHARS + 1) }))).toBeNull();
  });

  it('collapses the whitespace a chat answer arrives with, and keeps the wording', () => {
    const harvest = coachTeachBack(
      facts({ explanation: `\n  ${GOOD.replace(' — ', '\n\n— ')}  ` }),
    );
    expect(harvest?.usage).toBe(GOOD);
  });

  it('measures length AFTER trimming, so padding cannot buy its way past the floor', () => {
    expect(
      coachTeachBack(facts({ explanation: `${' '.repeat(200)}ngắn quá${' '.repeat(200)}` })),
    ).toBeNull();
  });
});
