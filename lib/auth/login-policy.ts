// Who may sign in, and how. sakubun is single-user and signs in with Google only; the one Google
// account allowed in is ALLOWED_EMAIL. Unset ALLOWED_EMAIL fails closed: nobody gets in.

export function allowedEmail(): string | null {
  const v = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
  return v ? v : null;
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  const allowed = allowedEmail();
  return !!allowed && !!email && email.trim().toLowerCase() === allowed;
}

export function isGoogleEnabled(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

// Email + password exists only so Playwright and vitest can get a session without Google. It is
// never on in a production build, whatever the env says.
export function isPasswordLoginEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.TEST_PASSWORD_LOGIN === '1';
}
