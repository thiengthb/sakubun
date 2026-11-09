import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// thien picked palette A (2026-11-09): grammar, vocab and kanji have their own hues (--kind-*), so a
// kind never borrows a status colour. Before this, Ngữ pháp wore "Đúng" green on one screen and
// "Thông tin" blue on another. Each file below draws a kind in colour.
const KIND_FILES = [
  'components/common/group-kind-badge.tsx',
  'components/features/dashboard/library-tile.tsx',
];
const STATUS_COLOUR = /\b(?:text|bg|border|fill|stroke)-(?:ok|warn|alert|info)\b/;

describe('item kinds use the kind colours', () => {
  it.each(KIND_FILES)('%s draws kinds with --kind-* and no status colour', (file) => {
    const src = readFileSync(file, 'utf8');
    expect(src, 'uses a kind token').toMatch(/\b(?:text|bg|border)-kind-(?:grammar|vocab|kanji)\b/);
    const hits = src.split('\n').filter((line) => STATUS_COLOUR.test(line));
    expect(hits, 'status colours are for grades and states').toEqual([]);
  });

  it('every kind token is defined for both themes and exposed to Tailwind', () => {
    const css = readFileSync('app/globals.css', 'utf8');
    for (const kind of ['grammar', 'vocab', 'kanji']) {
      for (const name of [`kind-${kind}`, `kind-${kind}-wash`]) {
        expect(css.match(new RegExp(`\\n  --${name}: oklch`, 'g'))?.length, name).toBe(2);
        expect(css).toContain(`--color-${name}: var(--${name});`);
      }
    }
  });
});
