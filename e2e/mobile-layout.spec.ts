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
];

test('every page renders clean and fits a 390px viewport', async ({ page }) => {
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
