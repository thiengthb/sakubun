import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cn, TYPE_SCALE } from '@/lib/core/utils';

describe('cn() knows the theme type scale', () => {
  it('keeps a type-scale size next to a text colour', () => {
    expect(cn('text-body text-card-foreground')).toBe('text-body text-card-foreground');
    expect(cn('text-subhead', 'text-muted-foreground')).toBe('text-subhead text-muted-foreground');
  });

  it('lets a later size win over an earlier one, either way round', () => {
    expect(cn('text-sm', 'text-subhead')).toBe('text-subhead');
    expect(cn('text-body', 'text-sm')).toBe('text-sm');
    expect(cn('text-base md:text-sm', 'text-body md:text-body')).toBe('text-body md:text-body');
  });

  it('covers every --text-* size the theme declares', () => {
    const css = readFileSync('app/globals.css', 'utf8');
    const declared = [...css.matchAll(/^\s*--text-([a-z0-9-]+):/gm)]
      .map((m) => m[1])
      .filter((name) => !name.includes('--'));
    expect([...new Set(declared)].sort()).toEqual([...TYPE_SCALE].sort());
  });
});
