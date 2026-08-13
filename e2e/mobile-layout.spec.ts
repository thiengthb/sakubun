// Mobile layout regression gate. Two failures this catches, both of which shipped to the live site and
// were invisible to `npm run verify` (601 unit tests + a clean production build) AND to a curl smoke test
// of the deployed URL — an unauthenticated request to /resources answers 200 because it streams a
// redirect to /login, so "200" proves nothing about the page a signed-in user gets:
//
//   1. /resources, /vocab and /items rendered the error boundary. A Radix `Slot` with three element
//      children threw during SSR ("Slot failed to slot onto its children"). Reachable only while
//      authenticated, so only a browser with a session sees it.
//   2. The dashboard scrolled sideways 136px at 390px wide. The forecast chart's 14 unbreakable "08/14"
//      labels set a min-content width of ~484px, which no `flex-1` can shrink past.
//
// Both are the same class of bug: it needs a REAL browser, a REAL session, and a phone-sized viewport.
import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

// A phone that exists and is on the narrow end of what people actually hold (iPhone 12/13/14 class).
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

/**
 * This spec NEEDS a populated store: every layout break found so far came from content (14 axis labels,
 * a long grammar name, a wrapped card title), and an empty dashboard renders the empty state instead of
 * a single chart. Rows go in with plain SQL rather than through the app because there is no web path that
 * creates an Item — Claude does it over MCP.
 *
 * Dates are relative to NOW on purpose: the heatmap and the 14-day forecast are windows around today, so
 * a fixed past epoch renders both of them empty and hides exactly what this spec measures.
 *
 * `AUDIT_SEED_DB=/path/to/snapshot.db` swaps the synthetic rows for the real learning tables out of a
 * production snapshot. The learning tables carry no userId so they graft onto the e2e account as-is.
 * That is how the dashboard overflow was found — synthetic rows draw every chart in its easy case.
 */
test.beforeAll(async () => {
  await seedE2eAccount();

  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  try {
    if (process.env.AUDIT_SEED_DB) {
      db.exec(`ATTACH DATABASE '${process.env.AUDIT_SEED_DB}' AS snap`);
      for (const t of [
        'Item',
        'SrsState',
        'Sentence',
        'ReviewLog',
        'Settings',
        'LearnerAbility',
        'LearnerNote',
        'CalibrationProposal',
      ]) {
        db.exec(`DELETE FROM "${t}"`);
        db.exec(`INSERT INTO "${t}" SELECT * FROM snap."${t}"`);
      }
      db.exec('DETACH DATABASE snap');
      return;
    }

    // Re-runnable: a failing test restarts the worker, which runs this hook AGAIN against a DB that
    // already has the rows — and `Item` is unique on [kind, expression], so the retry died with a
    // SqliteError that buried the ACTUAL failure. Clear first; the hook then always describes the DB.
    for (const t of ['GroupMember', 'Group', 'ReviewLog', 'SrsState', 'Sentence', 'Item'])
      db.exec(`DELETE FROM "${t}"`);

    const item = db.prepare(
      `INSERT INTO Item (id, kind, expression, reading, hanviet, meaningVi, level, notes, source,
                         captureReason, suspended, starred, createdAt, challengeObservations)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'MCP', ?, 0, ?, ?, 0)`,
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
    // Prisma stores SQLite DateTime as an ISO STRING with an explicit offset ("2026-08-04T18:38:17.240
    // +00:00"), not as epoch ms. Writing numbers here silently breaks every date filter: SQLite orders
    // every INTEGER before every TEXT, so `due > now` (a string) matches nothing and the dashboard draws
    // every chart in its EMPTY state — which is how this fixture first passed while proving nothing.
    const iso = (ms: number) => new Date(ms).toISOString().replace('Z', '+00:00');
    GRAMMAR.forEach(([expression, meaningVi, level], n) => {
      const id = `g${n}`;
      item.run(id, 'GRAMMAR', expression, null, null, meaningVi, level, null, n % 4 === 0 ? 1 : 0, iso(now - n * DAY));
      // due spread over the NEXT 14 days (state 1..3, never 0): that is exactly the window the forecast
      // chart reads, and a chart with 14 populated columns is the case that broke the phone layout.
      srs.run(`sg${n}`, id, iso(now + ((n % 14) + 1) * DAY), 3 + n, 5 + (n % 5), n, n % 7, 1 + (n % 3), 1 + (n % 3), iso(now - n * DAY));
      for (let r = 0; r < 3; r++)
        log.run(`lg${n}-${r}`, id, 1 + ((n + r) % 4), (n + r) % 4, iso(now + DAY), 3 + n, 5, iso(now - (r * 2 + (n % 5)) * DAY));
    });
    // A study group with a long name + one member, so the group routes below render their real shapes:
    // the detail page's toolbar and tab control, the edit form, and a non-empty add picker. The name is
    // deliberately long — the 99px overflow this spec now guards was a header row where the tab control
    // sat beside a long group name.
    db.prepare(
      `INSERT INTO "Group" (id, name, kind, color, note, createdAt, updatedAt)
       VALUES ('grp-e2e', 'Mẫu N2 hay sai khi viết mail công việc', 'grammar', NULL, 'ghi chú nhóm', ?, ?)`,
    ).run(iso(now), iso(now));
    db.prepare(
      `INSERT INTO GroupMember (groupId, itemId, addedAt) VALUES ('grp-e2e', 'g0', ?)`,
    ).run(iso(now));

    VOCAB.forEach(([expression, reading, hanviet, meaningVi, level, reason], n) => {
      const id = `v${n}`;
      item.run(id, 'VOCAB', expression, reading, hanviet, meaningVi, level, reason, n % 5 === 0 ? 1 : 0, iso(now - n * DAY));
      srs.run(`sv${n}`, id, iso(now + (n - 3) * DAY), 2 + n, 4 + (n % 6), n, n % 5, n % 3, n % 4, iso(now - n * DAY));
      for (let r = 0; r < 3; r++)
        log.run(`lv${n}-${r}`, id, 1 + ((n + r + 2) % 4), (n + r) % 4, iso(now + DAY), 2 + n, 6, iso(now - (r * 3 + (n % 6)) * DAY));
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
  ['guide', '/guide'],
  ['resources/new', '/resources/new?kind=grammar'],
  ['resources/new (vocab)', '/resources/new?kind=vocab'],
  // The edit route, on a seeded grammar id. Both form routes now render their tab switcher / breadcrumb
  // action crumb in the PageShell header row, which is the row this spec measures.
  ['resources/edit', '/resources/g0/edit'],
  // The two ITEM DETAIL routes — the densest pages in the app (an 8-card metric grid, an SVG chart and a
  // 6-column review log) and, until 2026-08-05, the only signed-in pages this spec never opened. Both
  // kinds are listed because they render different bodies: grammar gets the enrichment card, vocab gets
  // âm Hán Việt. `g0` has reviews (so the log renders rows), `v0` has none (so the empty state does).
  ['resources/g0 (detail)', '/resources/g0'],
  ['resources/v0 (detail)', '/resources/v0'],

  // NON-DEFAULT TABS, reached by `?tab=` (every tabbed page mirrors its active tab to the URL, so no
  // clicking is needed). Added 2026-08-05 because this sweep only ever opened each page's FIRST tab, and
  // two hard overflows were living in tabs it never reached:
  //   · /guide?tab=reference — 234px. Two <pre> config blocks have a min-content width of ~600px, and
  //     PageShell (a flex item of the Tabs root) was sized from its CONTENT, so the PAGE scrolled
  //     sideways instead of the code block scrolling inside itself. Fixed with `w-full` on the shell.
  //   · /settings?tab=data — carries the only other code block in the app, same shape.
  // Guide "features" is included as the widest PROSE tab (the topic browser), and settings "account"
  // as the one settings tab built from cards + inline forms rather than fields.
  ['guide (reference)', '/guide?tab=reference'],
  ['guide (features)', '/guide?tab=features'],
  ['settings (data)', '/settings?tab=data'],
  ['settings (account)', '/settings?tab=account'],

  // GROUPS — five surfaces, none of which this spec opened before 2026-08-05. The detail page shipped a
  // hand-rolled <TabsList> in its header row and overflowed a 390px phone by 99px; the other three are
  // the routes that replaced its create/edit/add-items dialogs, so they are new surface with no history.
  ['resources (groups tab)', '/resources?tab=groups'],
  ['group detail', '/groups/grp-e2e'],
  ['group new', '/groups/new'],
  ['group edit', '/groups/grp-e2e/edit'],
  ['group add items', '/groups/grp-e2e/add'],
];

/**
 * The header row (breadcrumb + the page's tab control) must stay ONE line on a phone.
 *
 * It is a layout invariant, not a nicety: the standard is "where I am · what I can switch" on a single
 * row, and when it wraps the tab control drops onto its own line and reads as page content. The overflow
 * test above cannot see this — a wrapped row is perfectly inside the viewport.
 *
 * 360px, not 390: /resources/new is the tightest case in the app (a two-crumb trail "Ngữ pháp › Thêm"
 * PLUS a three-option tab select) and it fit at 390 while wrapping at 360.
 */
test('the header row stays one line at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

  // Every page that puts something in PageShell's `headerAside`, plus the longest tab label on the
  // add form — the label is what pushes the row over, so measuring only the default tab proves little.
  const CASES: [string, string, string | null][] = [
    ['dashboard', '/', null],
    ['resources', '/resources', null],
    ['history', '/history', null],
    ['settings', '/settings', null],
    ['guide', '/guide', null],
    ['new (grammar)', '/resources/new?kind=grammar', 'Dán danh sách'],
    ['new (vocab)', '/resources/new?kind=vocab', 'Dán danh sách'],
    // The item detail page, on the LONGEST seeded pattern name. It has nothing in `headerAside` since
    // 2026-08-05 — its level/state tags and star moved down to the item's own header — and it is here
    // precisely because it used to: the crumb ends in the item's name, so a long name plus two badges
    // plus a star was the crowded case that got them moved (see the test below).
    ['item detail (long name)', '/resources/g4', null],
  ];

  const wrapped: string[] = [];
  for (const [name, url, tab] of CASES) {
    await page.goto(url, { waitUntil: 'networkidle' });
    if (tab) {
      await page.getByRole('combobox', { name: 'Cách nhập' }).click();
      await page.getByRole('option', { name: tab }).click();
      await page.waitForTimeout(300);
    }
    const row = await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="Breadcrumb"]');
      const box = nav?.closest('div.flex.flex-wrap.items-center') as HTMLElement | null;
      return box ? Math.round(box.getBoundingClientRect().height) : 0;
    });
    // One line is the h-8 (32px) tab control. Two lines land at 44px+ (a wrapped crumb) or 64px+.
    if (row > 40) wrapped.push(`${name}${tab ? ` [${tab}]` : ''}: header row is ${row}px tall`);
  }

  expect(
    wrapped,
    `the breadcrumb row wrapped at 360px — the tab control fell off the crumb's row:\n${wrapped.join('\n')}`,
  ).toEqual([]);
});

/**
 * The item detail page's identity tags (JLPT level · SRS state) and its star belong to the ITEM, not to
 * the breadcrumb — asserted geometrically, because "it looks cramped" is the kind of complaint no other
 * check in this file can see: the row never overflowed and never wrapped, it just spent its last 170px on
 * three things that were not navigation, so a long name squeezed them against the edge (reported
 * 2026-08-05). They now sit in the page header with the term they describe.
 *
 * Geometry rather than "is it inside element X": the claim the user made is about POSITION, and a future
 * refactor that keeps the tags in some other container on that row would pass a containment check while
 * putting the squeeze right back.
 */
test('item detail: level, state and star sit below the breadcrumb row', async ({ page }) => {
  await page.setViewportSize(VIEWPORT);
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

  // g4 = the longest seeded pattern name (〜てからでないと), i.e. the case that crowded the row.
  await page.goto('/resources/g4', { waitUntil: 'networkidle' });

  const crumb = await page.locator('nav[aria-label="Breadcrumb"]').first().boundingBox();
  const star = await page.getByRole('button', { name: /đánh dấu sao/i }).boundingBox();
  const level = await page.getByText('N3', { exact: true }).first().boundingBox();
  const tabs = await page.getByRole('tab', { name: /Chỉ số/ }).boundingBox();
  expect(crumb && star && level && tabs, 'header, star, level badge and tabs must all render').toBeTruthy();

  const rowBottom = crumb!.y + crumb!.height;
  expect(star!.y, 'the star is back on the breadcrumb row').toBeGreaterThanOrEqual(rowBottom);
  expect(level!.y, 'the level badge is back on the breadcrumb row').toBeGreaterThanOrEqual(rowBottom);
  // …and they are part of the item HEADER, above the tab bar — not stranded somewhere further down.
  expect(star!.y).toBeLessThan(tabs!.y);
  expect(level!.y).toBeLessThan(tabs!.y);
});

// This one test walks EVERY page, so its wall clock is the sum of a dozen navigations against `next
// dev` — measured 2026-08-12 at 50.9s running alone, i.e. inside the 60s global timeout by 9 seconds.
// Under the full suite it crossed it and failed on `page.goto`, which reads as "a page hung" and sends
// the next person hunting a bug that is not there. The budget belongs to THIS test, not to the global
// timeout: raising the global one would hide a genuine hang in the other 45 tests, all of which finish
// well under 30s.
test('every page renders clean and fits a 390px viewport', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize(VIEWPORT);

  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message.split('\n')[0]}`));
  page.on('console', (m) => {
    // React reports a render crash through console.error, and the error boundary then swallows it — so
    // WITHOUT this listener the page still returns 200 and looks merely empty. This is the listener that
    // caught the Slot crash.
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
    // The error boundary is a client render, so give it a beat to appear before declaring the page clean.
    await page.waitForTimeout(600);

    const m = await page.evaluate(() => {
      const de = document.documentElement;
      const vw = de.clientWidth;
      // Content inside an `overflow-x: auto|scroll|hidden` box legitimately extends past the viewport:
      // it is scrolled (the year heatmap) or deliberately clipped with an ellipsis (a `truncate`d
      // preview line). Only elements with no such ancestor actually widen the page.
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
          const cls = typeof el.className === 'string' ? el.className.split(/\s+/).slice(0, 4).join('.') : '';
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
    else if (m.offenders.length) failures.push(`${name}: outside the viewport: ${m.offenders.join(' ; ')}`);
  }

  expect(failures, `mobile layout problems at ${VIEWPORT.width}px:\n${failures.join('\n')}`).toEqual([]);
});

/** Sign in on the current page. Every test here needs a session and none can share one (worker: 1). */
async function signIn(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

/**
 * The filter panel on a phone is a BOTTOM SHEET — asserted geometrically, because that is the whole
 * claim (user report 2026-08-05): it used to be the desktop's Popover, anchored to a trigger in the TOP
 * toolbar, so on a phone it opened up there as a floating 80vw panel reading like a modal dropped
 * mid-page. "Rises from the bottom edge, full width" is a position and a size, so position and size are
 * what this measures; a future refactor back to an anchored panel would pass any containment check.
 */
test('mobile: the filter panel is a bottom sheet, full width, anchored to the bottom edge', async ({
  page,
}) => {
  await page.setViewportSize(VIEWPORT);
  await signIn(page);
  await page.goto('/resources?tab=grammar', { waitUntil: 'networkidle' });

  await page.getByRole('button', { name: /^Bộ lọc/ }).click();
  const sheet = page.locator('[data-slot="sheet-content"][data-side="bottom"]');
  await expect(sheet).toBeVisible();

  // POLLED, not read once: the sheet SLIDES up (`slide-in-from-bottom-10`, 200ms), so a single
  // boundingBox right after "visible" measures it mid-animation ~50px short of the bottom edge — which
  // is the assertion's own subject, so a one-shot read would fail on a correct sheet.
  await expect
    .poll(async () => {
      const b = (await sheet.boundingBox())!;
      return Math.round(b.y + b.height - VIEWPORT.height);
    }, { message: "the sheet's bottom edge settles on the screen's bottom edge" })
    .toBe(0);

  const box = (await sheet.boundingBox())!;
  expect(Math.round(box.x), 'the sheet starts at the left edge').toBe(0);
  expect(Math.round(box.width), 'the sheet spans the full viewport width').toBe(VIEWPORT.width);
  // A sheet, not a full-screen takeover: the list stays visible above it, and its height is capped
  // (max-h-85dvh) so the body scrolls inside instead of pushing the footer button off-screen.
  expect(box.y, 'the list is still visible above the sheet').toBeGreaterThan(0);
  expect(box.height).toBeLessThanOrEqual(VIEWPORT.height * 0.85 + 1);

  // The controls inside are select menus, and they are touch-sized (SHEET_CONTROL_CLASS lifts the
  // desktop's 28px `size="sm"` triggers to 40px — 28px is under every platform's minimum target).
  const firstSelect = sheet.getByRole('combobox').first();
  await expect(firstSelect).toBeVisible();
  expect((await firstSelect.boundingBox())!.height).toBeGreaterThanOrEqual(36);

  // A filter chosen in the sheet actually filters, and the sheet closes from its own footer button.
  await firstSelect.click(); // "Cấp JLPT"
  await page.getByRole('option', { name: 'N5', exact: true }).click();
  await page.getByRole('button', { name: 'Xem kết quả' }).click();
  await expect(sheet).toBeHidden();
  // One seeded N5 grammar pattern (see GRAMMAR above).
  await expect(page.locator('[data-slot="data-table-cards"] > li')).toHaveCount(1);
});

/**
 * SORTING EXISTS ON A PHONE. Below md a DataTable is replaced by a card list, which has no column
 * headers — and clicking a header is the only way a desktop sorts, so the phone had none at all (user
 * report 2026-08-05). The control is a bottom sheet: a field select plus a direction pair.
 *
 * Asserted on the ORDER of the cards, not on the control's state: "the sort control is set to Level"
 * would pass while sorting nothing.
 */
test('mobile: the sort sheet reorders the card list', async ({ page }) => {
  await page.setViewportSize(VIEWPORT);
  await signIn(page);
  await page.goto('/resources?tab=grammar', { waitUntil: 'networkidle' });

  const cards = page.locator('[data-slot="data-table-cards"] > li');
  await expect(cards.first()).toBeVisible();

  await page.getByRole('button', { name: /^Sắp xếp/ }).click();
  const sheet = page.locator('[data-slot="sheet-content"][data-side="bottom"]');
  await expect(sheet).toBeVisible();

  // Cấp (JLPT), descending. The seeded grammar spans N2..N5 with exactly ONE N5 (〜てしまう), so
  // descending puts a known row first — and ascending puts an N2 one there instead. (Nhãn đổi từ
  // "Level" sang "Cấp" ngày 2026-08-11: nó là tiêu đề cột duy nhất còn tiếng Anh.)
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

/**
 * Tab switching — the state the page sweep above never enters (issue #25).
 *
 * `every page renders clean` does `goto` then measures. It opens /settings, and it is green — which is
 * exactly why the hydration warning reported on 2026-08-11 slipped past it: that warning appeared AFTER
 * a tab switch, and no test in this suite had ever clicked a tab while listening.
 *
 * Nine attempts on 2026-08-13 (6 warm + 3 with `.next` deleted, across both the original repro spec and
 * a throwaway probe) failed to reproduce it, so the cause is NOT diagnosed and this test is not a fix.
 * It is the thing worth having either way: a timing-dependent mismatch that shows up in 1 of 3 runs is
 * precisely the kind that comes back, and the cost of noticing it next time should not be "someone
 * happened to be reading the dev server log".
 *
 * Deliberately generic over `role=tab` rather than hardcoding /settings: the report was about /settings,
 * but nothing about the failure mode is. A route that LOSES its tabs is reported too — a sweep that goes
 * quiet because it found nothing to click is the same silent pass this test exists to remove.
 */
const TABBED: [string, string][] = [
  ['settings', '/settings'],
  ['dashboard', '/'],
  ['guide', '/guide'],
];

test('switching tabs raises no client error — the state the page sweep never enters', async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page);

  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message.split('\n')[0]}`));
  page.on('console', (m) => {
    // React 19 throws hydration failures (caught above as `pageerror`) but prints the DIFF — the half
    // that says WHERE — as a separate console message. Keep both: the throw proves it happened, the
    // message is the only thing that makes it debuggable.
    if (m.type() === 'error') problems.push(`console.error: ${m.text().split('\n')[0]}`);
    else if (/hydrat|server rendered HTML/i.test(m.text())) problems.push(`console.${m.type()}: ${m.text().slice(0, 400)}`);
  });

  const failures: string[] = [];
  for (const [name, url] of TABBED) {
    problems.length = 0;
    await page.goto(url, { waitUntil: 'networkidle' });

    const tabs = page.getByRole('tab');
    const count = await tabs.count();
    if (count < 2) {
      failures.push(`${name}: found ${count} tab(s) — this route is in TABBED but has nothing to switch`);
      continue;
    }

    for (let i = 0; i < count; i++) {
      const tab = tabs.nth(i);
      const label = (await tab.textContent())?.trim() ?? `#${i}`;
      // Retry the click: a click landing BEFORE hydration finishes is dropped silently — Playwright sees
      // the element, React has not attached the handler yet. `mcp.spec.ts` hit exactly that.
      await expect(async () => {
        await tab.click();
        await expect(tab).toHaveAttribute('data-state', 'active', { timeout: 2000 });
      }).toPass({ timeout: 20_000 });
      // The panel is a client render; give it the same beat the sweep above gives the error boundary.
      await page.waitForTimeout(400);
      if (problems.length) {
        failures.push(`${name} → tab "${label}": ${problems.join(' | ')}`);
        problems.length = 0;
      }
    }
  }

  expect(failures, `client errors while switching tabs:\n${failures.join('\n')}`).toEqual([]);
});
