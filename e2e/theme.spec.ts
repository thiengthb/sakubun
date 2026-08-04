import path from 'node:path';
import { expect, test } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

/**
 * One grammar item, so the app has a piece of learner-facing Japanese to check the JP font stack against.
 * Written over SQL for the same reason `seedE2eAccount` writes over SQL: the `@/` alias does not resolve
 * in the Playwright node context, so the app's own modules are out of reach here.
 * `INSERT OR IGNORE`-style guard: specs share one DB, and Item is unique on [kind, expression].
 */
async function seedOneItem(): Promise<void> {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  db.prepare(
    `INSERT INTO "Item" (id, kind, expression, meaningVi, level, source, suspended, starred, createdAt)
     SELECT 'theme-ja', 'GRAMMAR', '〜ばかりに', 'chỉ vì ~', 'N2', 'MANUAL', 0, 0, ?
     WHERE NOT EXISTS (SELECT 1 FROM "Item" WHERE kind = 'GRAMMAR' AND expression = '〜ばかりに')`,
  ).run(Date.now());
  db.close();
}

/**
 * The TYPE SYSTEM is load-bearing for the app's look (globals.css: display serif for headings, Inter for
 * UI, a system Japanese stack for `lang="ja"`), and all three ride on CSS variables that a browser has to
 * actually resolve. Nothing else catches a break: dropping `displaySerif.variable` from `<html>` in
 * app/layout.tsx, or renaming `--font-serif-display`, typechecks and lints clean and renders a page that
 * is merely... plainer. Every heading in the app quietly falls back to Inter and no test says a word.
 *
 * So the assertion is on COMPUTED style in a real browser — the one place the variable chain is proven.
 * Companion gates: lib/contrast.test.ts (token contrast) and lib/type-scale.test.ts (which sizes exist).
 */
test('the type system resolves in the browser', async ({ page }) => {
  await seedE2eAccount();
  await seedOneItem();
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL('/', { timeout: 30_000 });

  const fonts = await page.evaluate(() => {
    const family = (el: Element | null | undefined) =>
      el ? getComputedStyle(el).fontFamily : 'ELEMENT NOT FOUND';
    // The wordmark by its TEXT: `a span span` in the sidebar header matches the 作文 logo badge first,
    // and that badge is Japanese, so it is supposed to resolve to the JP stack instead.
    const wordmark = Array.from(
      document.querySelectorAll('[data-slot="sidebar-header"] span'),
    ).find((el) => el.textContent?.trim() === 'sakubun');
    return {
      wordmark: family(wordmark),
      logoBadge: family(document.querySelector('[data-slot="sidebar-header"] a span span')),
      // Any real heading: which of h1/h2/h3 a page happens to render depends on its data (a dashboard
      // with content has chart h2s; an empty one has the EmptyState h3). The base-layer rule covers all.
      heading: family(document.querySelector('h1, h2, h3')),
      body: getComputedStyle(document.body).fontFamily,
      eyebrow: family(document.querySelector('.eyebrow')),
    };
  });

  expect(fonts.wordmark, 'the wordmark is the display serif').toContain('Newsreader');
  expect(fonts.heading, 'h1-h3 are the display serif (globals.css base layer)').toContain(
    'Newsreader',
  );
  expect(fonts.body, 'body copy stays on Inter').toContain('Inter');
  expect(fonts.eyebrow, 'the eyebrow utility forces the sans back on').toContain('Inter');
  expect(fonts.logoBadge, 'Japanese text gets the JP stack, not Inter').toContain('Hiragino');

  // Japanese the LEARNER reads (not just the logo) must land on the JP stack too — this is the selector
  // that would break if a component ever renders JA text without lang="ja".
  await page.goto('/resources');
  const ja = page.locator('[lang="ja"]').first();
  await expect(ja).toBeVisible();
  await expect
    .poll(async () => ja.evaluate((el) => getComputedStyle(el).fontFamily))
    .toContain('Hiragino');
});
