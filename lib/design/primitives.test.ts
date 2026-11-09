import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// UI v2, phase 1 (docs/plans/2026-11-08-ui-v2.md › Component): components/ui moves from Radix to
// Base UI, the primitive thienui is built on. As in thienui (`primitives-only-in-base`), only
// components/ui may import a primitive library, so the next change of primitive stays inside it.
const PRIMITIVE = /from '(?:radix-ui|@base-ui\/react[^']*)'/;

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

  // Phase 1 moved every file off Radix and took radix-ui out of package.json; it must not return.
  it('do not include Radix', () => {
    const onRadix = FILES.filter((f) =>
      /from '(?:radix-ui|@radix-ui\/[^']+)'/.test(readFileSync(f, 'utf8')),
    );
    expect(onRadix, 'build it on Base UI (@base-ui/react) instead').toEqual([]);
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as Record<
      string,
      Record<string, string> | undefined
    >;
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(deps.filter((d) => d === 'radix-ui' || d.startsWith('@radix-ui/'))).toEqual([]);
  });
});
