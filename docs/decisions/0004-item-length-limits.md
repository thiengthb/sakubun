# 0004. A word or pattern is short: length limits on items

- Status: accepted (thien chose the numbers 2026-10-25, item detail review round 2)
- Date: 2026-10-25

## Context

The library held items whose "expression" was a whole clause and whose meaning was an explanation.
On the item page such a title wrapped over three lines and the meaning pushed the facts off the first
screen. A vocab word or a grammar pattern is not a sentence; the long explanation belongs in the tutor
card's "Cách dùng".

## Decision

- Limits, counted in characters as a reader sees them (`textLength`, NFC): expression 20, meaning 60,
  reading 30, Hán Việt 30. The reasons for each number sit beside them in `lib/library/item-limits.ts`.
- The server enforces them where items are written: `addItems` (web form, paste, Excel, MCP
  `add_items`) skips the entry with a short reason naming the fix; `updateItem` refuses a changed
  value over the limit. Paste and Excel previews show the same reason per row before anything is sent.
- A Mazii meaning keeps only the whole senses that fit 60 characters, marked "…" when cut.
- Hán Việt is stored upper case.
- Old items are kept: only a value that is set or changed is checked, so an old long item can still be
  edited (its level, its notes) without being forced short. Restoring a backup copies rows verbatim.

## Consequences

- An AI tutor sending a long expression gets the entry back in `skipped` with the reason and can
  resend a shorter one.
- Old long items stay until someone shortens them; a later cleanup could list them.
