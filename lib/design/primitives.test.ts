import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// UI v2, phase 1 (docs/plans/2026-11-08-ui-v2.md › Component): components/ui moves from Radix to
// Base UI, the primitive thienui is built on. As in thienui (`primitives-only-in-base`), only
// components/ui may import a primitive library, so the next change of primitive stays inside it.
const PRIMITIVE = /from '(?:radix-ui|@base-ui\/react[^']*)'/;

// The files still on Radix. Only ever shrinks: a file that leaves Radix comes off this list, and
// nothing new may join it. Empty at the end of phase 1, when radix-ui leaves package.json.
const STILL_ON_RADIX = [
  'components/ui/select.tsx',
  'components/ui/sidebar.tsx',
];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'generated' || name === 'node_modules') return [];
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const FILES = ['app', 'components', 'lib'].flatMap(sources);

describe('UI primitives', () => {
  it('are imported only in components/ui', () => {
    const outside = FILES.filter(
      (f) => !f.startsWith('components/ui/') && PRIMITIVE.test(readFileSync(f, 'utf8')),
    );
    expect(outside, 'wrap the primitive in components/ui and import that').toEqual([]);
  });

  it('leave Radix one file at a time, never back', () => {
    const onRadix = FILES.filter((f) => /from 'radix-ui'/.test(readFileSync(f, 'utf8'))).sort();
    expect(onRadix, 'move the file to Base UI, or take it off STILL_ON_RADIX').toEqual(
      [...STILL_ON_RADIX].sort(),
    );
  });
});
