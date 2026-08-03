import { prisma } from '@/lib/db';

/**
 * Is account creation still open? True only while the DB holds zero users — this app is single-user,
 * so the door closes for good once that one account exists.
 *
 * This is the READ used to render UI (the /register page). It is NOT the enforcement point: the real
 * gate is the `user.create` before-hook in lib/auth.ts, which every sign-up path (email+password and
 * Google OAuth) must pass through. Keep both — this one gives an honest page instead of a form that
 * submits into a 403, and the hook makes the rule impossible to walk around.
 *
 * Fail-closed on error, matching the hook: an unreadable DB reports "closed".
 */
export async function isRegistrationOpen(): Promise<boolean> {
  try {
    return (await prisma.user.count()) === 0;
  } catch {
    return false;
  }
}
