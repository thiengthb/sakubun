import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

const VIEWPORT = { width: 390, height: 844 };

const GRAMMAR: [string, string, string][] = [
  ['〜ばかりに', 'chỉ vì (dẫn tới kết quả xấu)', 'N2'],
  ['〜ざるを得ない', 'không thể không, buộc phải', 'N2'],
  ['〜にもかかわらず', 'mặc dù vậy', 'N2'],
  ['〜つつある', 'đang dần dần', 'N2'],
  ['〜てからでないと', 'nếu chưa ... thì không thể', 'N3'],
  ['〜わけではない', 'không phải là', 'N3'],
  ['〜に違いない', 'chắc chắn là', 'N3'],
  ['〜としても', 'cho dù là', 'N3'],
  ['〜ようになる', 'trở nên (có thể)', 'N4'],
  ['〜たばかり', 'vừa mới', 'N4'],
  ['〜ながら', 'vừa ... vừa', 'N4'],
  ['〜てしまう', 'làm mất rồi, đã xong', 'N5'],
];

const VOCAB: [string, string, string, string, string, string | null][] = [
  ['曖昧', 'あいまい', 'ái muội', 'mơ hồ, không rõ ràng', 'N2', 'unclear'],
  ['把握', 'はあく', 'bả ác', 'nắm bắt, hiểu rõ', 'N2', 'unknown'],
  ['矛盾', 'むじゅん', 'mâu thuẫn', 'sự mâu thuẫn', 'N2', 'misused'],
  ['妥当', 'だとう', 'thỏa đáng', 'thích đáng, hợp lý', 'N1', 'unclear'],
  ['懸念', 'けねん', 'huyền niệm', 'lo ngại', 'N1', 'unknown'],
  ['配慮', 'はいりょ', 'phối lự', 'sự quan tâm, chu đáo', 'N2', null],
  ['収穫', 'しゅうかく', 'thu hoạch', 'thu hoạch, thành quả', 'N3', 'misused'],
  ['丁寧', 'ていねい', 'đinh ninh', 'lịch sự, cẩn thận', 'N4', null],
  ['準備', 'じゅんび', 'chuẩn bị', 'sự chuẩn bị', 'N5', null],
  ['約束', 'やくそく', 'ước thúc', 'lời hứa, cuộc hẹn', 'N5', 'unclear'],
];

test.beforeAll(async () => {
  await seedE2eAccount();

  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  try {
    if (process.env.AUDIT_SEED_DB) {
      db.exec(`ATTACH DATABASE '${process.env.AUDIT_SEED_DB}' AS snap`);
      for (const t of ['Item', 'SrsState', 'Sentence', 'ReviewLog', 'Settings']) {
        db.exec(`DELETE FROM "${t}"`);
        db.exec(`INSERT INTO "${t}" SELECT * FROM snap."${t}"`);
      }
      db.exec('DETACH DATABASE snap');
      return;
    }

    for (const t of ['GroupMember', 'Group', 'ReviewLog', 'SrsState', 'Sentence', 'Item'])
      db.exec(`DELETE FROM "${t}"`);

    const item = db.prepare(
      `INSERT INTO Item (id, kind, expression, reading, hanviet, meaningVi, level, notes, source,
                         captureReason, suspended, starred, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'MCP', ?, 0, ?, ?)`,
    );
    const srs = db.prepare(
      `INSERT INTO SrsState (id, itemId, due, stability, difficulty, scheduledDays, learningSteps,
                             reps, lapses, state, lastReview)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
    );
    const log = db.prepare(
      `INSERT INTO ReviewLog (id, itemId, rating, state, role, due, stability, difficulty, reviewedAt)
       VALUES (?, ?, ?, ?, 'TARGET', ?, ?, ?, ?)`,
    );

    const DAY = 86_400_000;
    const now = Date.now();
    const iso = (ms: number) => new Date(ms).toISOString().replace('Z', '+00:00');
    GRAMMAR.forEach(([expression, meaningVi, level], n) => {
      const id = `g${n}`;
      item.run(
        id,
        'GRAMMAR',
        expression,
        null,
        null,
        meaningVi,
        level,
        null,
        n % 4 === 0 ? 1 : 0,
        iso(now - n * DAY),
      );
      srs.run(
        `sg${n}`,
        id,
        iso(now + ((n % 14) + 1) * DAY),
        3 + n,
        5 + (n % 5),
        n,
        n % 7,
        1 + (n % 3),
        1 + (n % 3),
        iso(now - n * DAY),
      );
      for (let r = 0; r < 3; r++)
        log.run(
          `lg${n}-${r}`,
          id,
          1 + ((n + r) % 4),
          (n + r) % 4,
          iso(now + DAY),
          3 + n,
          5,
          iso(now - (r * 2 + (n % 5)) * DAY),
        );
    });
    db.prepare(
      `INSERT INTO "Group" (id, name, kind, color, note, createdAt, updatedAt)
       VALUES ('grp-e2e', 'Mẫu N2 hay sai khi viết mail công việc', 'grammar', NULL, 'ghi chú nhóm', ?, ?)`,
    ).run(iso(now), iso(now));
    db.prepare(
      `INSERT INTO GroupMember (groupId, itemId, addedAt) VALUES ('grp-e2e', 'g0', ?)`,
    ).run(iso(now));

    VOCAB.forEach(([expression, reading, hanviet, meaningVi, level, reason], n) => {
      const id = `v${n}`;
      item.run(
        id,
        'VOCAB',
        expression,
        reading,
        hanviet,
        meaningVi,
        level,
        reason,
        n % 5 === 0 ? 1 : 0,
        iso(now - n * DAY),
      );
      srs.run(
        `sv${n}`,
        id,
        iso(now + (n - 3) * DAY),
        2 + n,
        4 + (n % 6),
        n,
        n % 5,
        n % 3,
        n % 4,
        iso(now - n * DAY),
      );
      for (let r = 0; r < 3; r++)
        log.run(
          `lv${n}-${r}`,
          id,
          1 + ((n + r + 2) % 4),
          (n + r) % 4,
          iso(now + DAY),
          2 + n,
          6,
          iso(now - (r * 3 + (n % 6)) * DAY),
        );
    });
  } finally {
    db.close();
  }
});

const PAGES: [string, string][] = [
  ['dashboard', '/'],
  ['resources', '/resources'],
  ['vocab', '/vocab'],
  ['items', '/items'],
  ['history', '/history'],
  ['settings', '/settings'],
  ['resources/new', '/resources/new?kind=grammar'],
  ['resources/new (vocab)', '/resources/new?kind=vocab'],
  ['resources/edit', '/resources/g0/edit'],
  ['resources/g0 (detail)', '/resources/g0'],
  ['resources/v0 (detail)', '/resources/v0'],

  ['settings (data)', '/settings?tab=data'],
  ['settings (account)', '/settings?tab=account'],

  ['resources (groups tab)', '/resources?tab=groups'],
  ['group detail', '/groups/grp-e2e'],
  ['group new', '/groups/new'],
  ['group edit', '/groups/grp-e2e/edit'],
  ['group add items', '/groups/grp-e2e/add'],
];

test('the header row stays one line at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

  const CASES: [string, string, string | null][] = [
    ['dashboard', '/', null],
    ['resources', '/resources', null],
    ['history', '/history', null],
    ['settings', '/settings', null],
    ['new (grammar)', '/resources/new?kind=grammar', 'Dán danh sách'],
    ['new (vocab)', '/resources/new?kind=vocab', 'Dán danh sách'],
    ['item detail (long name)', '/resources/g4', null],
  ];

  const wrapped: string[] = [];
  for (const [name, url, tab] of CASES) {
    await page.goto(url, { waitUntil: 'networkidle' });
    if (tab) {
      await page.getByRole('tab', { name: tab }).click();
      await page.waitForTimeout(300);
    }
    const row = await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="Breadcrumb"]');
      const box = nav?.closest('div.flex.flex-wrap.items-center') as HTMLElement | null;
      return box ? Math.round(box.getBoundingClientRect().height) : 0;
    });
    if (row > 40) wrapped.push(`${name}${tab ? ` [${tab}]` : ''}: header row is ${row}px tall`);
  }

  expect(
    wrapped,
    `the breadcrumb row wrapped at 360px — the tab control fell off the crumb's row:\n${wrapped.join('\n')}`,
  ).toEqual([]);
});

test('item detail: star on the title row; meaning, level and actions below it', async ({
  page,
}) => {
  await page.setViewportSize(VIEWPORT);
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

  await page.goto('/resources/g4', { waitUntil: 'networkidle' });

  // docs/ui-standard.md › Đầu trang: a nested page's phone row is logo, trail over title, star.
  // What does not fit the row (meaning, level, state, the two actions) goes below it.
  const header = page.locator('[data-template] header');
  const box = async (l: import('@playwright/test').Locator) => l.boundingBox();
  const title = await box(header.locator('h1'));
  const star = await box(page.getByRole('button', { name: /đánh dấu sao/i }));
  const level = await box(header.getByText('N3', { exact: true }).locator('visible=true'));
  const actions = await header
    .getByRole('button', { name: 'Luyện riêng' })
    .locator('visible=true')
    .boundingBox();
  const tabs = await box(page.getByRole('tab', { name: /Chỉ số/ }));
  expect(
    title && star && level && actions && tabs,
    'title, star, level badge, actions and tabs must all render',
  ).toBeTruthy();

  const mid = (b: { y: number; height: number }) => b.y + b.height / 2;
  expect(Math.abs(mid(star!) - mid(title!)), 'the star sits on the title row').toBeLessThan(12);
  const rowBottom = Math.max(title!.y + title!.height, star!.y + star!.height);
  expect(level!.y, 'the level badge sits below the title row').toBeGreaterThanOrEqual(rowBottom);
  expect(actions!.y, 'the actions sit below the meta line').toBeGreaterThan(level!.y);
  expect(actions!.y).toBeLessThan(tabs!.y);
});

test('every page renders clean and fits a 390px viewport', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize(VIEWPORT);

  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message.split('\n')[0]}`));
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console.error: ${m.text().split('\n')[0]}`);
  });

  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

  const failures: string[] = [];
  for (const [name, url] of PAGES) {
    problems.length = 0;
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    const m = await page.evaluate(() => {
      const de = document.documentElement;
      const vw = de.clientWidth;
      const contained = (el: HTMLElement) => {
        for (let p = el.parentElement; p; p = p.parentElement) {
          const ox = getComputedStyle(p).overflowX;
          if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return true;
        }
        return false;
      };
      const offenders: string[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if ((r.right > vw + 1 || r.left < -1) && !contained(el)) {
          const cls =
            typeof el.className === 'string' ? el.className.split(/\s+/).slice(0, 4).join('.') : '';
          offenders.push(
            `${el.tagName.toLowerCase()}.${cls} at ${Math.round(r.left)}..${Math.round(r.right)} "${el.textContent?.trim().slice(0, 30)}"`,
          );
        }
      }
      return { scrollW: de.scrollWidth, clientW: vw, offenders: offenders.slice(0, 6) };
    });

    if (problems.length) failures.push(`${name}: ${problems.join(' | ')}`);
    if (m.scrollW > m.clientW + 1)
      failures.push(
        `${name}: page is ${m.scrollW - m.clientW}px wider than the ${m.clientW}px viewport` +
          (m.offenders.length ? ` — widened by: ${m.offenders.join(' ; ')}` : ''),
      );
    else if (m.offenders.length)
      failures.push(`${name}: outside the viewport: ${m.offenders.join(' ; ')}`);
  }

  expect(
    failures,
    `mobile layout problems at ${VIEWPORT.width}px:\n${failures.join('\n')}`,
  ).toEqual([]);
});

async function signIn(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

test('mobile: the filter panel is a bottom sheet, full width, anchored to the bottom edge', async ({
  page,
}) => {
  await page.setViewportSize(VIEWPORT);
  await signIn(page);
  await page.goto('/resources?tab=grammar', { waitUntil: 'networkidle' });

  await page.getByRole('button', { name: /^Bộ lọc/ }).click();
  const sheet = page.locator('[data-slot="sheet-content"][data-side="bottom"]');
  await expect(sheet).toBeVisible();

  await expect
    .poll(
      async () => {
        const b = (await sheet.boundingBox())!;
        return Math.round(b.y + b.height - VIEWPORT.height);
      },
      { message: "the sheet's bottom edge settles on the screen's bottom edge" },
    )
    .toBe(0);

  const box = (await sheet.boundingBox())!;
  expect(Math.round(box.x), 'the sheet starts at the left edge').toBe(0);
  expect(Math.round(box.width), 'the sheet spans the full viewport width').toBe(VIEWPORT.width);
  expect(box.y, 'the list is still visible above the sheet').toBeGreaterThan(0);
  expect(box.height).toBeLessThanOrEqual(VIEWPORT.height * 0.85 + 1);

  const firstSelect = sheet.getByRole('combobox').first();
  await expect(firstSelect).toBeVisible();
  expect((await firstSelect.boundingBox())!.height).toBeGreaterThanOrEqual(36);

  await firstSelect.click(); // "Cấp JLPT"
  await page.getByRole('option', { name: 'N5', exact: true }).click();
  await page.getByRole('button', { name: 'Xem kết quả' }).click();
  await expect(sheet).toBeHidden();
  await expect(page.locator('[data-slot="data-table-cards"] > li')).toHaveCount(1);
});

test('mobile: the sort sheet reorders the card list', async ({ page }) => {
  await page.setViewportSize(VIEWPORT);
  await signIn(page);
  await page.goto('/resources?tab=grammar', { waitUntil: 'networkidle' });

  const cards = page.locator('[data-slot="data-table-cards"] > li');
  await expect(cards.first()).toBeVisible();

  await page.getByRole('button', { name: /^Sắp xếp/ }).click();
  const sheet = page.locator('[data-slot="sheet-content"][data-side="bottom"]');
  await expect(sheet).toBeVisible();

  await sheet.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'Cấp', exact: true }).click();
  await page.getByRole('button', { name: 'Giảm dần' }).click();
  await page.getByRole('button', { name: 'Xem kết quả' }).click();
  await expect(cards.first()).toContainText('N5');

  await page.getByRole('button', { name: /^Sắp xếp/ }).click();
  await page.getByRole('button', { name: 'Tăng dần' }).click();
  await page.getByRole('button', { name: 'Xem kết quả' }).click();
  await expect(cards.first()).toContainText('N2');
});

const TABBED: [string, string][] = [
  ['settings', '/settings'],
  ['dashboard', '/'],
];

test('switching tabs raises no client error — the state the page sweep never enters', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signIn(page);

  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message.split('\n')[0]}`));
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console.error: ${m.text().split('\n')[0]}`);
    else if (/hydrat|server rendered HTML/i.test(m.text()))
      problems.push(`console.${m.type()}: ${m.text().slice(0, 400)}`);
  });

  const failures: string[] = [];
  for (const [name, url] of TABBED) {
    problems.length = 0;
    await page.goto(url, { waitUntil: 'networkidle' });

    const tabs = page.getByRole('tab');
    const count = await tabs.count();
    if (count < 2) {
      failures.push(
        `${name}: found ${count} tab(s) — this route is in TABBED but has nothing to switch`,
      );
      continue;
    }

    for (let i = 0; i < count; i++) {
      const tab = tabs.nth(i);
      const label = (await tab.textContent())?.trim() ?? `#${i}`;
      await expect(async () => {
        await tab.click();
        await expect(tab).toHaveAttribute('data-state', 'active', { timeout: 2000 });
      }).toPass({ timeout: 20_000 });
      await page.waitForTimeout(400);
      if (problems.length) {
        failures.push(`${name} → tab "${label}": ${problems.join(' | ')}`);
        problems.length = 0;
      }
    }
  }

  expect(failures, `client errors while switching tabs:\n${failures.join('\n')}`).toEqual([]);
});

test('mobile: a tap opens the (i) explanations and the ring tooltips', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();
  await signIn(page);
  // The tooltip that is open now; one closing from the previous tap is still in the DOM.
  const open = page.locator('[data-slot="tooltip-content"]:not([data-state="closed"])');
  await page.goto('/', { waitUntil: 'networkidle' });

  // Radix Tooltip alone opens on hover/focus only, so on a phone these were unreachable.
  await page.getByRole('button', { name: 'Giải thích: Đến hạn' }).tap();
  await expect(open).toContainText('chưa học');

  await page.getByRole('button', { name: /Lượt ôn/ }).tap();
  await expect(open).toContainText(/Đúng|Còn|Chưa/);

  await page.goto('/settings', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Giải thích: Hướng dịch' }).tap();
  await expect(open).toContainText('Tự động');

  await context.close();
});
