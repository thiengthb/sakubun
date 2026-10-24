import { expect, test, type Page } from '@playwright/test';
import { E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

// docs/ui-standard.md: buttons and fields are 36px tall on a phone and 28px from 768px, as SEEN:
// a raised control's 2px lip counts, so a button is exactly as tall as the flat field beside it.
// The unit tests read class names; this measures what the browser actually draws, so a caller's
// className that overrides the height shows up here.

const PAGES = [
  '/settings',
  '/settings?tab=data',
  '/settings?tab=account',
  '/resources',
  '/resources?tab=grammar',
  '/groups',
  '/groups/new',
];

const CONTROLS = [
  'button[data-slot="button"][data-size="default"]',
  'a[data-slot="button"][data-size="default"]',
  'button[data-slot="button"][data-size="icon"]',
  'button[data-slot="select-trigger"][data-size="default"]',
  'button[data-slot="toggle-group-item"][data-size="default"]',
  // The stepper's number field sits inside its 2px frame; the frame is the control.
  'input[data-slot="input"]:not([data-slot="stepper"] *)',
  '[data-slot="stepper"]',
].join(',');

// Controls that share a row with a field. Choice chips built from choiceChipClass carry aria-pressed.
const ROW_CONTROLS = [CONTROLS, 'button[aria-pressed]'].join(',');

test.beforeAll(async () => {
  await seedE2eAccount();
});

async function login(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

for (const [width, px] of [
  [390, 36],
  [1440, 28],
] as const) {
  test(`controls are ${px}px tall at ${width}px, lip included`, async ({ page }) => {
    test.setTimeout(120_000);
    await login(page, width);

    const wrong: string[] = [];
    let measured = 0;
    for (const path of PAGES) {
      await page.goto(path, { waitUntil: 'networkidle' });
      const sizes = await page.evaluate((selector) => {
        // Tailwind stacks ring and drop shadows in one box-shadow list: the lip is the largest
        // downward offset of a shadow that is not transparent.
        const lip = (el: Element) => {
          let y = 0;
          for (const sh of getComputedStyle(el).boxShadow.split(/,(?![^(]*\))/)) {
            if (sh.includes('inset') || /rgba\([^)]*,\s*0\)/.test(sh)) continue;
            const px = sh.match(/-?[\d.]+px/g) ?? [];
            if (px.length >= 2) y = Math.max(y, parseFloat(px[1]));
          }
          return y;
        };
        return [...document.querySelectorAll<HTMLElement>(selector)]
          .filter((el) => el.offsetParent !== null)
          .map((el) => ({
            what: `${el.dataset.slot} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}"`,
            height: Math.round(el.getBoundingClientRect().height + lip(el)),
          }));
      }, CONTROLS);
      measured += sizes.length;
      for (const s of sizes) if (s.height !== px) wrong.push(`${path}  ${s.what}: ${s.height}px`);
    }

    expect(
      measured,
      'no control found: the selectors no longer match the components',
    ).toBeGreaterThan(10);
    expect(wrong, `Controls must be ${px}px tall at ${width}px:\n${wrong.join('\n')}`).toEqual([]);
  });

  test(`a field and the controls in its row share top and bottom edges at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await login(page, width);

    const wrong: string[] = [];
    let rows = 0;
    for (const path of PAGES) {
      await page.goto(path, { waitUntil: 'networkidle' });
      const found = await page.evaluate((selector) => {
        const lip = (el: Element) => {
          let y = 0;
          for (const sh of getComputedStyle(el).boxShadow.split(/,(?![^(]*\))/)) {
            if (sh.includes('inset') || /rgba\([^)]*,\s*0\)/.test(sh)) continue;
            const px = sh.match(/-?[\d.]+px/g) ?? [];
            if (px.length >= 2) y = Math.max(y, parseFloat(px[1]));
          }
          return y;
        };
        const seen = (el: Element) => {
          const r = el.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom + lip(el), left: r.left, right: r.right };
        };
        // The row is the nearest ancestor that lays its children out side by side.
        const rowOf = (el: Element) => {
          let node = el.parentElement;
          for (let i = 0; node && i < 4; i++, node = node.parentElement) {
            const s = getComputedStyle(node);
            if ((s.display.includes('flex') && s.flexDirection === 'row') || s.display.includes('grid'))
              return node;
          }
          return null;
        };
        const out: { field: string; control: string; dTop: number; dBottom: number }[] = [];
        let count = 0;
        const fields = [
          ...document.querySelectorAll<HTMLInputElement>(
            'input[data-slot="input"]:not([data-slot="stepper"] *)',
          ),
        ].filter((el) => el.offsetParent !== null);
        for (const field of fields) {
          const row = rowOf(field);
          if (!row) continue;
          const f = seen(field);
          const others = [...row.querySelectorAll<HTMLElement>(selector)].filter((el) => {
            if (el === field || el.offsetParent === null || el.contains(field)) return false;
            const c = seen(el);
            // Same line (vertical overlap) and outside the field (not its clear button).
            const overlaps = c.top < f.bottom && c.bottom > f.top;
            const inside = c.left >= f.left && c.right <= f.right;
            return overlaps && !inside;
          });
          if (others.length) count++;
          for (const el of others) {
            const c = seen(el);
            out.push({
              field: field.getAttribute('aria-label') ?? field.placeholder ?? 'field',
              control: `${el.dataset.slot ?? el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}"`,
              dTop: Math.round(c.top - f.top),
              dBottom: Math.round(c.bottom - f.bottom),
            });
          }
        }
        return { count, out };
      }, ROW_CONTROLS);
      rows += found.count;
      for (const o of found.out)
        if (o.dTop !== 0 || o.dBottom !== 0)
          wrong.push(
            `${path}  "${o.field}" vs ${o.control}: top ${o.dTop}px, bottom ${o.dBottom}px`,
          );
    }

    expect(rows, 'no field shares a row with a control: the check is blind').toBeGreaterThan(0);
    expect(wrong, `Edges must line up:\n${wrong.join('\n')}`).toEqual([]);
  });
}
