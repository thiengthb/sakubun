import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { cleanIds, err, ok, parseInput, zodErrorMessage } from '@/lib/core/action-result';

describe('action-result helpers', () => {
  it('ok / err build the tagged union', () => {
    expect(ok(42)).toEqual({ ok: true, data: 42 });
    expect(err('nope')).toEqual({ ok: false, error: 'nope' });
  });

  it('zodErrorMessage joins issue messages with "; "', () => {
    const schema = z.object({ a: z.string().min(1, 'a trống'), b: z.number() });
    const r = schema.safeParse({ a: '', b: 'x' });
    expect(r.success).toBe(false);
    if (!r.success) expect(zodErrorMessage(r.error)).toContain('a trống');
  });

  describe('parseInput', () => {
    const schema = z.object({ name: z.string().trim().min(1, 'tên trống') });

    it('returns ok+typed data on success', () => {
      const p = parseInput(schema, { name: 'hi' });
      expect(p).toEqual({ ok: true, data: { name: 'hi' } });
    });

    it('returns err with the derived message on failure', () => {
      const p = parseInput(schema, { name: '' });
      expect(p.ok).toBe(false);
      if (!p.ok) expect(p.error).toBe('tên trống');
    });

    it('uses the fallback message when provided', () => {
      const p = parseInput(z.array(z.string()).min(1), 'not-an-array', 'Danh sách không hợp lệ');
      expect(p).toEqual({ ok: false, error: 'Danh sách không hợp lệ' });
    });
  });

  describe('cleanIds', () => {
    it('keeps only non-empty strings', () => {
      expect(cleanIds(['a', '', 'b', 3, null, undefined, 'c'])).toEqual(['a', 'b', 'c']);
    });
    it('tolerates non-array input', () => {
      expect(cleanIds(undefined)).toEqual([]);
      expect(cleanIds('abc')).toEqual([]);
      expect(cleanIds(null)).toEqual([]);
    });
  });
});
