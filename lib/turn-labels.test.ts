import { describe, expect, it } from 'vitest';
import { EXERCISE_TYPE } from '@/lib/mcp/tool-kit';
import { TURN_LABELS_BY_TYPE, turnLabels, type TurnLabels } from '@/lib/turn-labels';

// The two surfaces' own translation wording. Deliberately different — the chat block names the
// direction because nothing else on screen does; the history card has a direction badge above it.
const CHAT: TurnLabels = {
  prompt: 'Đề (Nhật → Việt)',
  answer: 'Bạn dịch',
  reference: 'Tham khảo',
  retry: 'Gõ lại bản dịch đã sửa lỗi',
};
const WEB: TurnLabels = { prompt: 'Đề', answer: 'Bạn dịch', reference: 'Tham khảo', retry: '' };

/** Types where the learner really does translate a given source → each surface's own defaults apply. */
const TRANSLATIONS = new Set([
  'TRANSLATION',
  'CLOZE',
  'DIALOGUE',
  'CLOZE_PRODUCTION',
  'GUIDED_PRODUCTION',
]);

describe('turnLabels', () => {
  it('falls back to the surface’s own wording for the types that ARE translations', () => {
    for (const type of TRANSLATIONS) {
      expect(turnLabels(type, CHAT)).toEqual(CHAT);
      expect(turnLabels(type, WEB)).toEqual(WEB);
    }
  });

  it('an unknown type falls back rather than throwing', () => {
    expect(turnLabels('SOMETHING_NEW', WEB)).toEqual(WEB);
  });

  // THE POINT OF THE SHARED FILE. Four instances of one defect, three of them fixed one flag at a time
  // in the chat renderer while the web kept its own hardcoded copy — so the fourth was invisible from
  // where the first three were fixed. Both surfaces must agree, and this is what makes "agree" checkable
  // instead of a thing someone remembers.
  it('every NON-translation type is renamed on BOTH surfaces, never on just one', () => {
    for (const type of EXERCISE_TYPE.options) {
      if (TRANSLATIONS.has(type)) continue;
      const chat = turnLabels(type, CHAT);
      const web = turnLabels(type, WEB);
      expect(TURN_LABELS_BY_TYPE[type], `${type} needs an entry`).toBeDefined();
      // The learner did not translate, so neither surface may say they did.
      expect(chat.answer, `${type} chat answer`).not.toBe('Bạn dịch');
      expect(web.answer, `${type} web answer`).not.toBe('Bạn dịch');
      // And neither may head the prompt as a translation đề.
      expect(chat.prompt, `${type} chat prompt`).not.toContain('Đề');
      expect(web.prompt, `${type} web prompt`).not.toBe('Đề');
      // Both surfaces read ONE table, so they cannot drift apart.
      expect(chat).toEqual(web);
    }
  });

  it('names each part of the three renamed types the way that turn actually went', () => {
    expect(turnLabels('QUIZ', WEB)).toMatchObject({
      prompt: 'Câu hỏi',
      answer: 'Bạn chọn',
      reference: 'Đáp án', // not a "reference translation" — it is the answer key
    });
    expect(turnLabels('TEACH_BACK', WEB)).toMatchObject({ prompt: 'Mẫu', answer: 'Bạn giảng' });
    expect(turnLabels('CONVERSATION', WEB)).toMatchObject({
      prompt: 'Tình huống',
      answer: 'Bạn nói',
      reference: 'Câu mẫu',
    });
  });

  it('no entry is half-filled — a blank label would render as a bare colon', () => {
    for (const [type, labels] of Object.entries(TURN_LABELS_BY_TYPE)) {
      for (const key of ['prompt', 'answer', 'reference', 'retry'] as const) {
        expect(labels[key].trim(), `${type}.${key}`).not.toBe('');
      }
    }
  });
});
