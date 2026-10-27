import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteConfirmed, moderationRefusal } from './moderation';

describe('moderationRefusal', () => {
  beforeEach(() => vi.stubEnv('ALLOWED_EMAIL', 'owner@example.test'));
  afterEach(() => vi.unstubAllEnvs());

  const learner = { id: 'b', email: 'b@example.test', role: 'user', banned: false };

  it('quản trị chặn hoặc xoá được người học, kể cả người đã bị chặn', () => {
    expect(moderationRefusal('a', learner)).toBeNull();
    expect(moderationRefusal('a', { ...learner, banned: true })).toBeNull();
  });

  it('không tự chặn mình, không đụng tài khoản quản trị, không có tài khoản thì báo', () => {
    expect(moderationRefusal('b', learner)).toBe('Không tự chặn hay xoá tài khoản của mình.');
    expect(moderationRefusal('a', { ...learner, role: 'admin' })).toBe(
      'Không chặn hay xoá được tài khoản quản trị.',
    );
    expect(moderationRefusal('x', { ...learner, email: 'Owner@example.test' })).toBe(
      'Không chặn hay xoá được tài khoản quản trị.',
    );
    expect(moderationRefusal('a', null)).toBe('Không tìm thấy tài khoản.');
  });
});

describe('deleteConfirmed', () => {
  it('khớp email không phân biệt hoa thường và khoảng trắng', () => {
    expect(deleteConfirmed('b@example.test', ' B@Example.test ')).toBe(true);
    expect(deleteConfirmed('b@example.test', 'b@example.tes')).toBe(false);
    expect(deleteConfirmed('b@example.test', '')).toBe(false);
  });
});
