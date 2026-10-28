// What /login says for the ?error= it was sent back with. better-auth sends every failure here
// (onAPIError in auth.ts, errorCallbackURL of the Google button), so the code tells a broken
// connect link from claude.ai or ChatGPT apart from an account that may not sign in.

// OAuth errors of the authorize step (RFC 6749 4.1.2.1, and better-auth's own for a redirect it
// does not know): the link the app opened is wrong, the account is fine.
const LINK_ERRORS = new Set([
  'invalid_request',
  'invalid_client',
  'invalid_redirect',
  'invalid_scope',
  'unauthorized_client',
  'unsupported_response_type',
]);

export const LINK_ERROR_TEXT =
  'Liên kết kết nối không hợp lệ. Mở lại phần kết nối Sakubun trong ứng dụng (claude.ai, ChatGPT).';
export const NOT_ALLOWED_TEXT = 'Tài khoản này không được phép vào Sakubun.';

/** The line to show, or null when there is no error. Anything not known stays the refusal it was. */
export function loginErrorText(code: string | null | undefined): string | null {
  if (!code) return null;
  return LINK_ERRORS.has(code.toLowerCase()) ? LINK_ERROR_TEXT : NOT_ALLOWED_TEXT;
}
