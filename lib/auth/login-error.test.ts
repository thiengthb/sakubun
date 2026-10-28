import { describe, expect, it } from 'vitest';
import { LINK_ERROR_TEXT, loginErrorText, NOT_ALLOWED_TEXT } from '@/lib/auth/login-error';

describe('loginErrorText', () => {
  it('says the connect link is broken for an OAuth authorize error', () => {
    expect(loginErrorText('invalid_redirect')).toBe(LINK_ERROR_TEXT);
    expect(loginErrorText('invalid_client')).toBe(LINK_ERROR_TEXT);
    expect(loginErrorText('INVALID_REQUEST')).toBe(LINK_ERROR_TEXT);
  });

  it('keeps the refusal for anything else, and nothing without an error', () => {
    expect(loginErrorText('unable_to_create_session')).toBe(NOT_ALLOWED_TEXT);
    expect(loginErrorText('blocked')).toBe(NOT_ALLOWED_TEXT);
    expect(loginErrorText(null)).toBeNull();
    expect(loginErrorText('')).toBeNull();
  });
});
