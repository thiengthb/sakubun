import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, settingsPatchSchema, type Settings } from './settings-schema';

describe('settings save round-trip clears dirty', () => {
  const edits: Partial<Settings>[] = [
    { sessionGoal: 15 },
    { difficulty: 4 },
    { grammarLevels: ['N5', 'N4'] },
    { topics: ['anime', 'công việc'] },
    { desiredRetention: 0.85 },
    { furiganaMode: 'both' },
    { autoCapture: { vocab: true, enrichPatch: false } },
    { speechRate: 1.25 },
    { maxReviewsPerDay: 120 },
  ];

  for (const edit of edits) {
    it(`edit ${JSON.stringify(edit)} → client === saved`, () => {
      const initial = DEFAULT_SETTINGS;
      const clientSettings: Settings = { ...initial, ...edit };
      const validated = settingsPatchSchema.parse(clientSettings);
      const savedReturned = { ...initial, ...validated };
      expect(JSON.stringify(savedReturned)).toBe(JSON.stringify(clientSettings));
    });
  }
});
