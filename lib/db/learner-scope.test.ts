import { describe, expect, it } from 'vitest';
import { isLearningModel, LEARNING_MODELS, scopeArgs } from '@/lib/db/learner-scope';

describe('scopeArgs', () => {
  it('adds the owner to the filter of reads, updates and deletes', () => {
    expect(scopeArgs('Item', 'findMany', undefined, 'u1')).toEqual({ where: { userId: 'u1' } });
    expect(scopeArgs('Item', 'findUnique', { where: { id: 'i1' } }, 'u1')).toEqual({
      where: { id: 'i1', userId: 'u1' },
    });
    expect(scopeArgs('Group', 'deleteMany', { where: { name: 'x' } }, 'u1')).toEqual({
      where: { name: 'x', userId: 'u1' },
    });
  });

  it('writes the owner into created rows, one or many', () => {
    expect(scopeArgs('Turn', 'create', { data: { ja: 'あ' } }, 'u1')).toEqual({
      data: { ja: 'あ', userId: 'u1' },
    });
    expect(
      scopeArgs('Group', 'createMany', { data: [{ name: 'a' }, { name: 'b' }] }, 'u1'),
    ).toEqual({
      data: [
        { name: 'a', userId: 'u1' },
        { name: 'b', userId: 'u1' },
      ],
    });
    expect(
      scopeArgs(
        'Settings',
        'upsert',
        { where: { userId: 'u1' }, create: { data: '{}' }, update: {} },
        'u1',
      ),
    ).toEqual({ where: { userId: 'u1' }, create: { data: '{}', userId: 'u1' }, update: {} });
  });

  it('a caller cannot widen the filter to another owner', () => {
    expect(scopeArgs('Item', 'findMany', { where: { userId: 'u2' } }, 'u1')).toEqual({
      where: { userId: 'u1' },
    });
  });

  it('refuses an update that moves a row to another owner', () => {
    expect(() =>
      scopeArgs('Item', 'update', { where: { id: 'i' }, data: { userId: 'u2' } }, 'u1'),
    ).toThrow(/cannot change userId/);
    expect(() =>
      scopeArgs(
        'Item',
        'upsert',
        { where: { id: 'i' }, create: {}, update: { userId: 'u2' } },
        'u1',
      ),
    ).toThrow(/cannot change userId/);
  });

  it('fails closed on an operation it does not know', () => {
    expect(() => scopeArgs('Item', 'findRaw', {}, 'u1')).toThrow(/not scoped/);
  });

  it('knows exactly the eight learning tables', () => {
    expect(LEARNING_MODELS).toHaveLength(8);
    expect(isLearningModel('Item')).toBe(true);
    expect(isLearningModel('McpToolCall')).toBe(false);
    expect(isLearningModel('User')).toBe(false);
    expect(isLearningModel(undefined)).toBe(false);
  });
});
