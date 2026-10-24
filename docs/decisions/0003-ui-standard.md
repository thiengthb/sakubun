# 0003. One written UI standard, locked by tests and a shrink-only debt list

- Status: proposed (thien merges; plan approved 2026-10-24, option "Nền tảng trước, luật sau")
- Date: 2026-10-24

## Context

The UI drifted page by page: radius, button heights and icon sizes changed between pages, icon-only
buttons were hard to guess, and add/edit forms lived in some dialogs and some pages. thien redid the
UI in six steps (taste, three directions, tokens, four page templates, this standard, then each page).
Steps 1 to 4 set the numbers; PR #113 moved the control language (2px edge, raised pressables, flat
fields, the chosen wash) into the shared components. Prose rules alone had already drifted once.

## Decision

- `docs/ui-standard.md` is the one place the rules live, each with the test that locks it or "ảnh"
  when only thien's before/after screenshots can judge it.
- The checkable rules run in `npm test` (`lib/design/ui-standard.test.ts`, pure checks in
  `ui-standard.ts`): radius scale and classes, no round controls, control-language classes only in
  shared components, create buttons say "Thêm", icon-only buttons use a plain icon and an
  aria-label, no form inside a dialog. Each check has a sample that proves it goes red.
- `e2e/control-size.spec.ts` measures real control heights (36px at 390, 28px at 1440).
- Code from before the standard is recorded in `lib/design/ui-standard-debt.json`, which only
  shrinks, the same ratchet as `thienui-debt.json`. Each step-6 page PR pays off its page.
- The template rules (`page-template`, `phone-header`, baseline shots of the four templates) land
  with the PageShell templates in the first step-6 PR (Settings). Locking them now would test code
  that is not on `main` yet.

## Consequences

- A new page or component that breaks a checkable rule fails CI with the rule and a fix.
- The icon list (`PLAIN_ICONS`) is a judgement; changing it is a UI-standard change that thien reviews.
- e2e is not in CI (`npm run verify` only), so `control-size` runs locally before a UI PR.
