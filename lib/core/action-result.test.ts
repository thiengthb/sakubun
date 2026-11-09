import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  UNREACHABLE_ERROR,
  callAction,
  cleanIds,
  err,
  ok,
  parseInput,
  zodErrorMessage,
} from '@/lib/core/action-result';

describe('action-result helpers', () => {
  it('ok / err build the tagged union', () => {
    expect(ok(42)).toEqual({ ok: true, data: 42 });
    expect(err('nope')).toEqual({ ok: false, error: 'nope' });
  });

  it('err carries the field and retryable only when given', () => {
    expect(err('Tên trống', { field: 'name' })).toEqual({
      ok: false,
      error: 'Tên trống',
      field: 'name',
    });
    expect(err('Mất mạng', { retryable: true })).toEqual({
      ok: false,
      error: 'Mất mạng',
      retryable: true,
    });
    expect(Object.keys(err('x', { field: undefined, retryable: false }))).toEqual(['ok', 'error']);
  });

  describe('callAction', () => {
    it('passes the arguments and returns the result unchanged', async () => {
      const action = async (a: number, b: number) => ok(a + b);
      expect(await callAction(action, 2, 3)).toEqual({ ok: true, data: 5 });
      const refused = async () => err('Không được');
      expect(await callAction(refused)).toEqual({ ok: false, error: 'Không được' });
    });

    it('turns a thrown call (offline, server down) into a retryable failure', async () => {
      const offline = async (): Promise<ReturnType<typeof ok<number>>> => {
        throw new TypeError('Failed to fetch');
      };
      expect(await callAction(offline)).toEqual({
        ok: false,
        error: UNREACHABLE_ERROR,
        retryable: true,
      });
    });
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

    it('names the field of the first issue, so a form can show the message under it', () => {
      const p = parseInput(schema, { name: '' });
      expect(p).toEqual({ ok: false, error: 'tên trống', field: 'name' });
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
