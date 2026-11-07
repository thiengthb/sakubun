import { describe, expect, it } from 'vitest';
import { loginPath, safeReturnPath } from '@/lib/auth/login-return';

describe('safeReturnPath', () => {
  it('giữ đường dẫn trong app', () => {
    expect(safeReturnPath('/library/script/abc')).toBe('/library/script/abc');
    expect(safeReturnPath('/library?tab=scripts')).toBe('/library?tab=scripts');
  });

  it.each([
    undefined,
    null,
    '',
    'library',
    'https://evil.example/x',
    '//evil.example/x',
    '/\\evil.example',
    '/login',
    '/login?next=/x',
    '/api/backup',
    'javascript:void(0)',
  ])('trả về / cho %s', (next) => {
    expect(safeReturnPath(next)).toBe('/');
  });
});

describe('loginPath', () => {
  it('kèm đường quay lại', () => {
    expect(loginPath('/library/script/abc')).toBe('/login?next=%2Flibrary%2Fscript%2Fabc');
  });

  it('không có đường quay lại thì là /login', () => {
    expect(loginPath()).toBe('/login');
    expect(loginPath('https://evil.example')).toBe('/login');
  });
});
