# 0007. Anyone may sign up; the admin bans

- Status: accepted (thien approved the 7.2 plan 2026-10-27)
- Date: 2026-10-27
- Amends: 0006 ("sign-up that thien approves"), roadmap 7.2

## Context

After 7.1 every learning row has an owner and no query can read another learner's rows. The roadmap
said 7.2 would open sign-up with thien approving each account. Asked to choose, thien chose no approval
queue: anyone with a Google account gets in, and he bans whoever he needs to.
Plan: `docs/plans/2026-10-27-phase7-2-sign-up.md`

## Decision

- **Open sign-up with Google**, up to `MAX_ACCOUNTS` accounts (default 50) so throwaway accounts cannot
  fill the NUC's disk. A new account gets `role = user`; `ALLOWED_EMAIL` gets `role = admin`.
- **One question at every door**: `accountAccess()` (`lib/auth/access.ts`) says admin, learner or none.
  Pages, API routes, MCP keys, OAuth tokens and new sessions all ask it. Banned, or a role it does not
  know, is none.
- **A new learner starts with their own OpenJLPT deck**, built from `data/openjlpt` with fresh ids, never
  copied from another learner. If building it fails, the account is removed so the next sign-in starts
  clean. The admin keeps the deck they have.
- **The admin bans from `/admin`** (sessions end, data stays) or deletes an account after typing its email
  (its learning data goes with it, as in 0006). Whole-database backup, restore and MCP tool stats are
  admin only.

## Consequences

- `ALLOWED_EMAIL` no longer limits who may log in; it only names the admin. Unset, the app has no admin.
- The Google OAuth app must be published ("In production") for strangers to sign in.
- Hán Việt fixes after the import (`lib/import/hanviet-fill.ts`) find rows by expression, so they reach
  every learner's copy.
