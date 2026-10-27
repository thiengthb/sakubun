import { afterEach, describe, expect, it, vi } from 'vitest';
import { oauthAccountAllowed, oauthClientId, oauthSubject } from './mcp-oauth';

describe('oauthSubject', () => {
  it('lấy user từ sub của token bearer', () => {
    expect(oauthSubject({ sub: 'user-1', aud: 'x', azp: 'c' })).toBe('user-1');
  });

  it('từ chối token không có user (client_credentials) hoặc gắn DPoP', () => {
    expect(oauthSubject({ aud: 'x', azp: 'c' })).toBeNull();
    expect(oauthSubject({ sub: '' })).toBeNull();
    expect(oauthSubject({ sub: 42 })).toBeNull();
    expect(oauthSubject({ sub: 'user-1', cnf: { jkt: 'abc' } })).toBeNull();
  });
});

describe('oauthClientId', () => {
  it('lấy app từ client_id, hoặc azp khi thiếu client_id', () => {
    expect(oauthClientId({ client_id: 'c1', azp: 'c1' })).toBe('c1');
    expect(oauthClientId({ azp: 'c2' })).toBe('c2');
  });

  it('không có app thì null', () => {
    expect(oauthClientId({ sub: 'user-1' })).toBeNull();
    expect(oauthClientId({ client_id: '' })).toBeNull();
    expect(oauthClientId({ client_id: 7 })).toBeNull();
  });
});

describe('oauthAccountAllowed', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('cho mọi tài khoản còn quyền vào app, chặn tài khoản bị khoá hoặc không rõ vai trò', () => {
    vi.stubEnv('ALLOWED_EMAIL', 'owner@example.test');
    expect(oauthAccountAllowed({ banned: false, email: 'Owner@example.test' })).toBe(true);
    expect(oauthAccountAllowed({ banned: null, email: 'b@example.test', role: 'user' })).toBe(true);
    expect(oauthAccountAllowed({ banned: true, email: 'b@example.test', role: 'user' })).toBe(
      false,
    );
    expect(oauthAccountAllowed({ banned: true, email: 'owner@example.test' })).toBe(false);
    expect(oauthAccountAllowed({ banned: false, email: 'old@example.test', role: null })).toBe(
      false,
    );
    expect(oauthAccountAllowed(null)).toBe(false);
  });
});
