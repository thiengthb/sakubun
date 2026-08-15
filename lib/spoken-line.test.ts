import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Enforces invariant #9 — "Japanese content is ALWAYS SpokenLine" (see CLAUDE.md) — as a GATE, not a
 * doc. Written after the rule was stated, documented in `components/_INDEX.md`, and violated anyway:
 * the learner's OWN answer (`userAnswer`) shipped as bare text in BOTH history cards and the community
 * feed, so the one sentence they most want to hear back had no audio, no karaoke, no furigana. The
 * other invariants that kept regressing already have gates (`no-emoji.test.ts`,
 * `layout-standard.test.ts`); this one did not, which is exactly why it drifted.
 *
 * If a raw render here is legitimate, add it to the check's allow-list WITH a reason and add the row to
 * the "playable rule" table in `components/_INDEX.md` — do not weaken the check.
 */

const SKIP_DIRS = new Set(['node_modules', 'generated', '.next']);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(entry)) out.push(full);
  }
  return out;
}

const rel = (file: string) => relative(process.cwd(), file).split(sep).join('/');

const sources = (): { path: string; src: string }[] =>
  ['app', 'components']
    .flatMap((root) => walk(root))
    .map((file) => ({ path: rel(file), src: readFileSync(file, 'utf8') }))
    .filter(({ path }) => !path.endsWith('.test.tsx'));

/**
 * A JSX interpolation that prints a field as TEXT — `{x.field}` or `{field}`.
 * Excludes `={...}` (an attribute value, e.g. SpokenLine's own `text={x.field}`) and `${...}`
 * (a template literal, e.g. a search haystack or an aria-label).
 */
function rawRenderRe(field: string): RegExp {
  return new RegExp(String.raw`(?<![=$])\{\s*(?:[A-Za-z_$][\w$]*\.)?${field}\s*\}`);
}

/** The same field handed to a component as content — `text={x.field}` is SpokenLine's content prop. */
function playableRenderRe(field: string): RegExp {
  return new RegExp(String.raw`text=\{\s*(?:[A-Za-z_$][\w$]*\.)?${field}\s*\}`);
}

describe('invariant #9 — Japanese content renders through SpokenLine', () => {
  /**
   * `sourceText` / `suggested` / `userAnswer` are Japanese or Vietnamese depending on the sentence's
   * `direction`, so a bare render is legitimate for the Vietnamese side. What is NOT legitimate is a
   * file that ONLY ever prints the field as text: that means the Japanese side is unplayable too.
   * Requiring a `text={...}` render of the SAME field in the SAME file is what caught the userAnswer gap.
   */
  it('a direction-dependent sentence field is never rendered ONLY as bare text', () => {
    const FIELDS = ['sourceText', 'suggested', 'userAnswer'];
    const offenders: string[] = [];

    for (const { path, src } of sources()) {
      for (const field of FIELDS) {
        if (!rawRenderRe(field).test(src)) continue;
        if (playableRenderRe(field).test(src)) continue;
        offenders.push(`${path} — renders {${field}} as plain text with no SpokenLine of it`);
      }
    }

    expect(
      offenders,
      'These print a sentence field as bare text and never render it through <SpokenLine>, so when ' +
        'that field holds Japanese (VI_JA / CONVERSATION answers, JA_VI source) the learner gets no ' +
        'audio, no karaoke and no furigana. Branch on `direction` and give the Japanese side a ' +
        `SpokenLine (see components/history/history-cards.tsx):\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  /**
   * Using SpokenLine is NOT the rule — the rule is all THREE signals (furigana + audio + karaoke).
   * A SpokenLine given no `ruby` silently degrades to audio + karaoke, which is why the whole community
   * feed shipped without furigana while every check above stayed green: `lib/feed.ts` never selected
   * `sourceRuby`/`suggestedRuby`, so the props were simply absent. These two fields HAVE ruby columns on
   * Sentence, so rendering them without their ruby is always a bug.
   *
   * `userAnswer` is deliberately NOT in this list: no `userAnswerRuby` column exists (decided
   * 2026-07-23), so it is audio + karaoke by design until one is added.
   */
  it('a SpokenLine for a field that HAS furigana data actually passes it', () => {
    const RUBY_BACKED = new Set(['sourceText', 'suggested']);
    const offenders: string[] = [];

    for (const { path, src } of sources()) {
      for (const [block] of src.matchAll(/<SpokenLine[\s\S]*?\/>/g)) {
        const field = block.match(/text=\{\s*(?:[A-Za-z_$][\w$]*\.)?(\w+)\s*\}/)?.[1];
        if (!field || !RUBY_BACKED.has(field)) continue;
        if (/\bruby=/.test(block)) continue;
        offenders.push(
          `${path} — <SpokenLine text={...${field}}> renders no furigana (no ruby= prop)`,
        );
      }
    }

    expect(
      offenders,
      'Invariant #9 requires furigana AND audio AND karaoke. These SpokenLines render a field that has ' +
        'a ruby column on Sentence but never receive it, so the learner gets no furigana. Pass ' +
        '`ruby={...sourceRuby}` / `ruby={...suggestedRuby}` — and make sure the query SELECTs the ' +
        `column (lib/feed.ts once did not):\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  /**
   * `expression` (a term / grammar pattern) is ALWAYS Japanese — there is no direction to branch on, so
   * any bare render is a violation unless it is one of the enumerated exceptions.
   */
  it('an item expression is never rendered as bare text outside the declared exceptions', () => {
    const ALLOW = new Map([
      [
        'components/shared/weak-item-badge.tsx',
        'dense summary badge; links to the item page, which is playable',
      ],
      [
        'components/history/history-cards.tsx',
        'RatingChip — a dense per-item tag on the card, same exception',
      ],
      [
        'components/dashboard/learner-profile.tsx',
        'the CONFUSION PAIR row (used -> required) — a dense summary like the weakness badges ' +
          'beside it. The evidence quote in the same file IS a SpokenLine when the source is Japanese',
      ],
      [
        'components/resources/resource-add-form.tsx',
        'add/import surface — the bulk-import preview table and the field-entry inputs, not study content',
      ],
      ['components/resources/item-edit-dialog.tsx', 'editing surface'],
      [
        'components/resources/row-actions.tsx',
        'delete-confirmation prose («X» sẽ bị xóa…) — a warning sentence, not study content',
      ],
    ]);
    const offenders: string[] = [];

    for (const { path, src } of sources()) {
      if (ALLOW.has(path)) continue;
      if (path.startsWith('components/landing/')) continue;
      if (!rawRenderRe('expression').test(src)) continue;
      if (playableRenderRe('expression').test(src)) continue;
      offenders.push(path);
    }

    expect(
      offenders,
      'An `expression` is always Japanese, so it must render through <SpokenLine> (play button + ' +
        'karaoke + furigana). If a site is a genuine exception, add it to ALLOW above WITH a reason ' +
        `and to the "playable rule" table in components/_INDEX.md:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
