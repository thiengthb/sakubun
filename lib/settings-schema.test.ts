import { describe, expect, it } from 'vitest';
import {
  COMPOSITION_SETTING_KEYS,
  DEFAULT_SETTINGS,
  hardestLevel,
  migrateSettingsInput,
  parseStoredSettings,
  resolveVocabCeiling,
  settingsPatchSchema,
  settingsSchema,
  toCompositionSettings,
} from '@/lib/settings-schema';

describe('settingsSchema', () => {
  it('fills every default from an empty object', () => {
    expect(DEFAULT_SETTINGS.direction).toBe('ALTERNATING');
    expect(DEFAULT_SETTINGS.grammarLevels).toEqual(['N5']);
    expect(DEFAULT_SETTINGS.vocabCeiling).toBe(null);
    expect(DEFAULT_SETTINGS.desiredRetention).toBe(0.9);
    expect(DEFAULT_SETTINGS.dayCutoffHour).toBe(4);
    expect(DEFAULT_SETTINGS.vocabPerSentence).toBe(2);
    expect(DEFAULT_SETTINGS.promptModality).toBe('text');
    expect(DEFAULT_SETTINGS.answerModality).toBe('speak-or-write');
  });

  it('rejects out-of-range values', () => {
    expect(settingsSchema.safeParse({ difficulty: 6 }).success).toBe(false);
    expect(settingsSchema.safeParse({ desiredRetention: 0.5 }).success).toBe(false);
    expect(settingsSchema.safeParse({ grammarLevels: [] }).success).toBe(false);
  });

  it('maxNewPerSentence defaults to 1 and cannot be switched off', () => {
    // The per-EXERCISE novelty guard (2026-07-26). 0 would mean "never introduce anything new",
    // which silently contradicts dailyNewGrammar > 0 — hence min 1, not min 0.
    expect(DEFAULT_SETTINGS.maxNewPerSentence).toBe(1);
    expect(settingsSchema.safeParse({ maxNewPerSentence: 0 }).success).toBe(false);
    expect(settingsSchema.safeParse({ maxNewPerSentence: 3 }).success).toBe(true);
  });

  it('a settings blob stored BEFORE maxNewPerSentence existed gets the safe default', () => {
    // Migration safety: every existing user's stored JSON predates the field, so parseStoredSettings
    // must fill it rather than leaving it undefined (pickBatch would then cap novelty at NaN).
    const legacy = JSON.stringify({
      grammarLevels: ['N3'],
      dailyNewGrammar: 5,
      sentenceSize: 'long',
    });
    const parsed = parseStoredSettings(legacy);
    expect(parsed.maxNewPerSentence).toBe(1);
    expect(parsed.dailyNewGrammar).toBe(5);
  });

  it('the PRE-split `levels` blob migrates to grammarLevels with identical behaviour', () => {
    // 2026-07-26 split. Without migrateSettingsInput the Zod default would silently reset a learner
    // studying N3 back to N5 — data loss on every existing account, not a cosmetic rename.
    const preSplit = JSON.stringify({ levels: ['N3', 'N2'], register: 'keigo' });
    const parsed = parseStoredSettings(preSplit);
    expect(parsed.grammarLevels).toEqual(['N3', 'N2']);
    expect(parsed.register).toBe('keigo');
    // null ceiling ⇒ derived from grammarLevels ⇒ exactly what the single old field produced.
    expect(parsed.vocabCeiling).toBe(null);
    expect(resolveVocabCeiling(parsed)).toBe('N2');
  });

  it('an explicit vocabCeiling decouples vocabulary from the grammar levels', () => {
    const settings = settingsSchema.parse({ grammarLevels: ['N3'], vocabCeiling: 'N2' });
    expect(resolveVocabCeiling(settings)).toBe('N2');
    expect(hardestLevel(settings.grammarLevels)).toBe('N3');
  });

  it('a patch still naming `levels` is accepted (older client / habit)', () => {
    const migrated = settingsPatchSchema.parse(migrateSettingsInput({ levels: ['N4'] }));
    expect(migrated.grammarLevels).toEqual(['N4']);
  });

  it('an explicit grammarLevels wins over a stale `levels` in the same object', () => {
    const migrated = migrateSettingsInput({ levels: ['N5'], grammarLevels: ['N1'] });
    expect(settingsPatchSchema.parse(migrated).grammarLevels).toEqual(['N1']);
  });

  it('patch schema accepts a single field', () => {
    const result = settingsPatchSchema.safeParse({ register: 'keigo' });
    expect(result.success).toBe(true);
    expect(result.success && result.data.register).toBe('keigo');
  });
});

describe('toCompositionSettings', () => {
  // The projection rides on EVERY get_due_items result, so a field with no composition reader is a
  // per-TURN token tax. This test is the gate that keeps it from silently refilling.
  it('drops the fields no composition path reads', () => {
    const projected = toCompositionSettings(DEFAULT_SETTINGS);
    for (const dead of [
      'voiceSpeaker',
      'speechRate',
      'dayCutoffHour',
      'desiredRetention',
    ]) {
      expect(projected).not.toHaveProperty(dead);
    }
  });

  it('keeps everything composition actually steers by, including the pace caps it must name', () => {
    const projected = toCompositionSettings(DEFAULT_SETTINGS);
    for (const key of COMPOSITION_SETTING_KEYS) expect(projected).toHaveProperty(key);
    // The HELD BACK lines offer to raise these, so Claude needs their current values.
    expect(projected.dailyNewGrammar).toBe(DEFAULT_SETTINGS.dailyNewGrammar);
    expect(projected.maxNewPerSentence).toBe(DEFAULT_SETTINGS.maxNewPerSentence);
    expect(projected.maxReviewsPerDay).toBe(DEFAULT_SETTINGS.maxReviewsPerDay);
  });

  it('is measurably smaller on the wire than the full object', () => {
    const full = JSON.stringify(DEFAULT_SETTINGS).length;
    const projected = JSON.stringify(toCompositionSettings(DEFAULT_SETTINGS)).length;
    expect(projected).toBeLessThan(full);
  });
});

describe('parseStoredSettings', () => {
  it('returns defaults on null/garbage', () => {
    expect(parseStoredSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseStoredSettings('not json')).toEqual(DEFAULT_SETTINGS);
  });

  it('salvages valid fields from a partially invalid blob', () => {
    const stored = JSON.stringify({ difficulty: 4, unknownField: true });
    const parsed = parseStoredSettings(stored);
    expect(parsed.difficulty).toBe(4);
    expect(parsed.direction).toBe(DEFAULT_SETTINGS.direction);
  });
});
