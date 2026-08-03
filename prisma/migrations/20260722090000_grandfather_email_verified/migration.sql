-- Existing accounts predate email verification: the multi-user go-live (2026-07-21) shipped open
-- sign-up with NO verification, so every current user has emailVerified = false. Turning on
-- requireEmailVerification (lib/auth.ts) would lock all of them out on their next sign-in. Grandfather
-- every account that exists at this migration as verified — they were created inside the trusted
-- friend group before the feature existed. Sign-ups AFTER this migration still go through the full
-- verification flow (they start emailVerified = false). Data-only; no schema change.
UPDATE "user" SET "emailVerified" = 1 WHERE "emailVerified" = 0;
