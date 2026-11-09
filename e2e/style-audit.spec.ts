import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';
import {
  judgePage,
  newFindings,
  paidDebt,
  shrinkAuditDebt,
  type AuditDebt,
  type PageSample,
} from '../lib/design/style-audit';

// UI v2 phase U0 (docs/plans/2026-11-08-ui-v2.md): the style audit the plan measured by hand, as a
// test. On every page below, at laptop and phone width: no font size outside the type roles, no
// flex/grid gap off the 4px grid, nothing to press under 24px. What pages had before the roles sits
// in e2e/style-audit-debt.json. That list only shrinks: a new finding fails, and a finding fixed
// fails too until the list is lowered with
//   UPDATE_STYLE_AUDIT_DEBT=1 npx playwright test e2e/style-audit.spec.ts

const DEBT_FILE = 'e2e/style-audit-debt.json';
const LOWER = 'UPDATE_STYLE_AUDIT_DEBT=1 npx playwright test e2e/style-audit.spec.ts';

const PAGES = [
  '/',
  '/review',
  '/resources?tab=grammar',
  '/resources?tab=vocab',
  '/library',
  '/kaiwa',
  '/progress',
  '/settings',
];
const WIDTHS = [1440, 390] as const;

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

/** The same data on every run: OpenJLPT's first two level groups (N5 grammar and vocabulary). */
async function takeN5(page: Page) {
  await page.goto('/library', { waitUntil: 'networkidle' });
  const hrefs = await page
    .locator('a[href^="/library/"]')
    .evaluateAll((as) => as.map((a) => a.getAttribute('href')!).slice(0, 2));
  for (const href of hrefs) {
    await page.goto(href, { waitUntil: 'networkidle' });
    const take = page.getByRole('button', { name: /Lấy cả nhóm|Lấy phần còn thiếu/ });
    if (await take.count()) {
      await take.first().click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
    }
  }
}

function sample(page: Page): Promise<PageSample> {
  return page.evaluate(() => {
    const out = { fontSizes: [] as number[], gaps: [] as number[], smallTargets: [] as string[] };
    for (const el of document.querySelectorAll('main *')) {
      if (el.closest('rt')) continue; // furigana is half the size it reads by, on purpose
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim());
      if (hasText) out.fontSizes.push(parseFloat(cs.fontSize));
      if (cs.display.includes('flex') || cs.display.includes('grid')) {
        for (const g of [cs.rowGap, cs.columnGap])
          if (g.endsWith('px')) out.gaps.push(parseFloat(g));
      }
      if (el.matches('button, a[href], [role=button], input:not([type=hidden]), select')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.width < 24 || r.height < 24)) {
          const label = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 24);
          out.smallTargets.push(`${label} ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
      }
    }
    return out;
  });
}

test('style audit: type roles, 4px gaps, 24px targets on every page', async ({ page }) => {
  test.setTimeout(300_000);
  await seedE2eAccount();
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  await takeN5(page);

  const exists = existsSync(DEBT_FILE);
  let debt: AuditDebt = exists ? JSON.parse(readFileSync(DEBT_FILE, 'utf8')) : {};
  const found: AuditDebt = {};
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    for (const path of PAGES) {
      await page.goto(path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      found[`${path}@${width}`] = judgePage(await sample(page));
    }
  }

  if (!exists) {
    // First run only: the file records what pages have today. Once it exists, nothing adds to it.
    writeFileSync(DEBT_FILE, JSON.stringify(found, null, 2) + '\n');
    throw new Error(`${DEBT_FILE} did not exist; written from this run. Review it and commit.`);
  }

  if (process.env.UPDATE_STYLE_AUDIT_DEBT) {
    for (const [key, f] of Object.entries(found)) debt = shrinkAuditDebt(key, f, debt);
    writeFileSync(DEBT_FILE, JSON.stringify(debt, null, 2) + '\n');
  }

  const fresh = Object.entries(found).flatMap(([key, f]) => newFindings(key, f, debt));
  expect(
    fresh,
    'New style findings. Use a type role (text-xs/sm/body, text-title…), a gap on the 4px grid, ' +
      `and a 24px or larger target (docs/ui-standard.md):\n${fresh.join('\n')}`,
  ).toEqual([]);
  const paid = Object.entries(found).flatMap(([key, f]) => paidDebt(key, f, debt));
  expect(paid, `Fixed, so lower the list (${LOWER}):\n${paid.join('\n')}`).toEqual([]);
});
