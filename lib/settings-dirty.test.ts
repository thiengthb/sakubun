import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, settingsPatchSchema, type Settings } from './settings-schema';

// Reproduce the settings-form dirty comparison end-to-end: the client edits `settings`, the server
// `saveSettings` returns `{...oldDb, ...parse(patch)}`, and the form clears `dirty` by
// JSON.stringify-comparing the client settings to that returned object. If the round-trip is not
// byte-identical (key order / Zod coercion), `dirty` never clears and Save stays enabled — the bug.
describe('settings save round-trip clears dirty', () => {
  const edits: Partial<Settings>[] = [
    { sessionGoal: 15 },
    { difficulty: 4 },
    { grammarLevels: ['N5', 'N4'] },
    { topics: ['anime', 'công việc'] },
    { desiredRetention: 0.85 },
    { reminderTime: '09:30' },
    { furiganaMode: 'both' },
    { autoShareSentences: true },
    { speechRate: 1.25 },
    { maxReviewsPerDay: 120 },
  ];

  for (const edit of edits) {
    it(`edit ${JSON.stringify(edit)} → client === saved`, () => {
      const initial = DEFAULT_SETTINGS;
      const clientSettings: Settings = { ...initial, ...edit };
      // saveSettingsAction sends the whole settings object as the patch; saveSettings merges it over
      // the pre-save DB row (here `initial`) and returns that as `result.data`.
      const validated = settingsPatchSchema.parse(clientSettings);
      const savedReturned = { ...initial, ...validated };
      expect(JSON.stringify(savedReturned)).toBe(JSON.stringify(clientSettings));
    });
  }
});
