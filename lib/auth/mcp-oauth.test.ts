import { describe, expect, it } from 'vitest';
import { oauthSubject } from './mcp-oauth';

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
