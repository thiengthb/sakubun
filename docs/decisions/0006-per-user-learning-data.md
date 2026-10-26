# 0006. Learning data belongs to one account

- Status: accepted (thien approved the 7.1 plan 2026-10-25)
- Date: 2026-10-25
- Amends: CLAUDE.md "Một người dùng" (learning data had no `userId`)

## Context

Sakubun had one learner, and logging in (`ALLOWED_EMAIL`) was the only boundary, so no learning row
said whose it was. thien wants more learners later (roadmap 7.2: sign-up that he approves). Before
anyone else can log in, every learning row needs an owner, and no query may read another
learner's rows.

An Item is not shared content: it carries the learner's own state (suspended, starred, notes, and
the explanation card their Claude filled in). Plan: `docs/plans/2026-10-25-phase7-1-per-user-data.md`

## Decision

- **Each learner has their own items.** `userId` goes on the eight learning tables: Item, SrsState,
  ReviewLog, Sentence, Turn, Group, GroupMember, Settings (one Settings row per learner). It
  references `user` and is deleted with the account.
- **Expand, then contract.** 7.1a adds the column as nullable and gives every existing row to the
  first account: the admin, or the oldest account if none is admin. 7.1b and 7.1c move every query
  to a client bound to one user, `userDb(userId)`. 7.1d backfills rows written in between and makes
  the column required. It also moves the Item unique key from (kind, expression) to (userId, kind,
  expression), and makes the bare Prisma client throw on learning tables.
- **Shared and admin only:** MCP tool statistics (`McpToolCall`) stay one table for the whole app,
  and only an admin sees them. Database backup and restore stay whole-database, and only an admin
  sees that section of Settings. The admin role (`user.role`) comes with 7.2.

## Consequences

- Until 7.1d, rows the app writes have no owner. That is safe only because one account can log in.
  7.2 must not open sign-up before 7.1d is merged.
- Deleting an account deletes its learning rows, review history included. `ReviewLog` stays
  append-only for a living account.
- A backup restore remaps `userId` like any other column that points at `user`
  (`lib/transfer/import.ts`). Rows from a backup made before 7.1a arrive with no owner, and 7.1d
  assigns them.
- 7.1a and 7.1d are two migrations that touch learning data, so the NUC database is backed up
  before each one is deployed.
