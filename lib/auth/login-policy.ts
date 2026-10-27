// Who may sign in, and how. Anyone with a Google account may sign up (roadmap 7.2, thien bans when he
// needs to); ALLOWED_EMAIL names the admin. Unset ALLOWED_EMAIL leaves the app without an admin.

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

// How many accounts sakubun takes in all (MAX_ACCOUNTS, default 50): sign-up closes at the cap, so
// nobody can fill the NUC's disk with throwaway Google accounts. Each learner is a few MB.
export function maxAccounts(): number {
  const n = Number(process.env.MAX_ACCOUNTS);
  return Number.isInteger(n) && n > 0 ? n : 50;
}
