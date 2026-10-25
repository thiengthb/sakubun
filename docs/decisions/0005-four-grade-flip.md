# 0005. A flip card has the four FSRS buttons

- Status: accepted (thien asked for it 2026-10-25, Ôn nhanh review round 1)
- Date: 2026-10-25
- Amends: 0001 ("flip card, two buttons")

## Context

Quick review on the web graded a flip card with two buttons, Chưa nhớ (Again) and Nhớ (Good). A
learner who recalled a word with effort, or knew it at a glance, had no way to say so, and FSRS got
the same Good for both. Turns with Claude over MCP were already rated 1 to 4.

## Decision

- A flip card shows four buttons: Quên (Again, 1), Khó (Hard, 2), Nhớ (Good, 3), Dễ (Easy, 4), each
  with when the item comes back. Keys 1 to 4 press them; Enter is Nhớ.
- The rating goes to `recordReviews()` as pressed (`lib/domain/quick-review.ts`).
- A cloze stays graded by the server: the right choice is Good, a wrong one Again.
- "Nhớ" in the session summary and the progress bar counts Good and Easy, as true retention does
  (`lib/srs/retention.ts`); Hard counts as not remembered there.

## Consequences

- The answer action takes `rating` (1 to 4) for a flip instead of `remembered`.
- Hard and Easy now reach the schedule from the web, so intervals spread more than with two buttons.
