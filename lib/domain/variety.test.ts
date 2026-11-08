import { describe, expect, it } from 'vitest';
import { sceneFor, SCENES, sentenceKey, usedBefore } from '@/lib/domain/variety';

describe('sceneFor', () => {
  it('turns through the scenes, one per sentence the item has had', () => {
    expect(sceneFor(0, [])).toBe(SCENES[0]);
    expect(sceneFor(1, [])).toBe(SCENES[1]);
    expect(sceneFor(SCENES.length, [])).toBe(SCENES[0]);
  });

  it('uses the learner’s own topics when there are some', () => {
    expect(sceneFor(0, ['công việc', 'du lịch'])).toBe('công việc');
    expect(sceneFor(3, ['công việc', 'du lịch'])).toBe('du lịch');
  });
});

describe('usedBefore', () => {
  it('matches a sentence that differs only in spaces and punctuation', () => {
    expect(sentenceKey('友達と、映画を 見た。')).toBe('友達と映画を見た');
    expect(usedBefore('友達と映画を見た', ['先週行った。', '友達と、映画を見た。'])).toBe(true);
    expect(usedBefore('友達と映画を見に行った。', ['友達と映画を見た。'])).toBe(false);
    expect(usedBefore('。', ['。'])).toBe(false);
  });
});
