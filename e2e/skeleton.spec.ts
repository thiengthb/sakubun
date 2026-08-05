// Loading-skeleton parity gate.
//
// A `loading.tsx` is the only UI in the app that NOBODY reviews: it shows for one paint, on a fast local
// server it is nearly invisible, and nothing breaks when it stops matching the page. So it drifted for
// weeks, and the drift was not subtle — measured 2026-08-05, before the fix:
//   · /settings   — the 5-tab rail was drawn at EVERY width: 134px of horizontal overflow at 390px, and a
//                   header row 64px tall (two lines) where the real page is 32px (one).
//   · every page  — no MobileTopBar placeholder, so below md the crumb started 41px left of where the
//                   real one starts, and the whole row shifted the moment data arrived.
//   · every page  — the aside was `ml-auto` at every width while PageShell pins it beside the crumb from
//                   md up, so on a 1440px desktop the tab rail flew ~900px left on load.
//   · /history    — a 2-tab rail on a page whose tabs were deleted with the community feed.
//   · /guide, /resources/new, /resources/<id>/edit, /groups/new, /groups/<id>/edit, /groups/<id>/add —
//                   no loading.tsx at all, so all six fell back to the ROOT one and flashed a DASHBOARD
//                   (four stat cards + three charts, full width) before rendering a form.
//
// The skeletons are measured through `/dev-skeleton/<key>` (dev-only route) because a real loading state
// cannot be held still: its payload is prefetched, and every way of delaying it either raced or made Next
// fall back to a hard navigation that renders the finished page. What is being gated is geometry, and
// geometry needs a layout, not a moment in time.
import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

interface Pair {
  name: string;
  page: string;
  skeleton: string;
  /** How far the aside may sit from the real one at md+ (px). Loose where the real crumb ends in data
   *  we do not have yet (a group's name), tight everywhere else. */
  asideTol?: number;
  /**
   * Compare the fitted item COUNT too — a wrong count re-flows the whole page when data lands.
   *
   * ONLY CHECKED AT md AND UP, because only there is the real count geometric. `DataTable` measures its
   * `<tbody>` to fit the viewport, and below `md` that tbody is inside the `max-md:hidden` wrapper: it
   * measures 0, `useFitRows` skips it (by design — a hidden tab must not clobber a good value), and the
   * page falls back to its FIXED page size. Measured 2026-08-05 at 390px with 40 rows seeded: the real
   * card list renders "1–40 / 40" and the page scrolls 4916px. So on a phone the real count is DATA, not
   * layout, and a skeleton cannot know it — it renders a viewport's worth and stops. (That the mobile
   * auto-fit is inert is a separate finding about the page, not about the skeleton.)
   *
   * The two sides need different selectors: the real list is `<li>`/`<tr>`, the skeleton is tagged divs.
   */
  items?: boolean;
}

const PAIRS: Pair[] = [
  { name: 'dashboard', page: '/', skeleton: 'dashboard' },
  {
    name: 'resources',
    page: '/resources?tab=grammar',
    skeleton: 'resources',
    items: true,
  },
  { name: 'item detail', page: '/resources/sk0', skeleton: 'item' },
  { name: 'item edit', page: '/resources/sk0/edit', skeleton: 'item-edit' },
  { name: 'resources/new', page: '/resources/new?kind=grammar', skeleton: 'resources-new' },
  { name: 'history', page: '/history', skeleton: 'history' },
  { name: 'settings', page: '/settings', skeleton: 'settings' },
  { name: 'guide', page: '/guide', skeleton: 'guide' },
  // The group's own name is the last crumb, so the skeleton renders a placeholder pill for it and the
  // aside cannot land in the same place at md+ (below md both are pinned right, which IS asserted).
  { name: 'group detail', page: '/groups/grp-sk/', skeleton: 'group', asideTol: 260 },
  { name: 'group new', page: '/groups/new', skeleton: 'group-new' },
  { name: 'group edit', page: '/groups/grp-sk/edit', skeleton: 'group-edit' },
  { name: 'group add', page: '/groups/grp-sk/add', skeleton: 'group-add' },
];

/**
 * Both PageShell and PageSkeleton render `pt-6 pb-6` on the page container, which is what makes one
 * selector work for a page and its skeleton even though the DOM around them differs (a tabbed page wraps
 * the shell in a `<Tabs>` root; a skeleton does not).
 */
const MEASURE = () => {
  const de = document.documentElement;
  const shell = document.querySelector('main .pt-6.pb-6') as HTMLElement | null;
  if (!shell) return null;
  const row = shell.firstElementChild as HTMLElement | null;
  const box = (el: Element | null | undefined) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), right: Math.round(r.right), y: Math.round(r.y), h: Math.round(r.height), w: Math.round(r.width) };
  };
  const kids = row ? Array.from(row.children) : [];
  // The aside is the row's last child when the row has more than the top-bar + crumb.
  const aside = kids.length > 2 ? kids[kids.length - 1] : null;
  // First body block with a real box: an inactive Radix TabsContent stays mounted at display:none.
  const body =
    Array.from(shell.children)
      .slice(1)
      .find((el) => el.getBoundingClientRect().height > 0) ?? null;
  return {
    shell: box(shell),
    row: box(row),
    firstKid: box(kids[0]),
    aside: box(aside),
    body: box(body),
    overflow: de.scrollWidth - de.clientWidth,
  };
};

test.beforeAll(async () => {
  await seedE2eAccount();
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  const iso = (ms: number) => new Date(ms).toISOString().replace('Z', '+00:00');
  const now = Date.now();
  try {
    for (const t of ['GroupMember', 'Group', 'ReviewLog', 'SrsState', 'Sentence', 'Item'])
      db.exec(`DELETE FROM "${t}"`);
    const item = db.prepare(
      `INSERT INTO Item (id, kind, expression, reading, hanviet, meaningVi, level, notes, source,
         captureReason, suspended, starred, createdAt, challengeObservations)
       VALUES (?, 'GRAMMAR', ?, NULL, NULL, ?, 'N2', NULL, 'MCP', NULL, 0, 0, ?, 0)`,
    );
    // 40 rows: every list page must be SATURATED, otherwise the real page renders fewer items than fit
    // and the item-count comparison below would be measuring "ran out of data", not the fit.
    for (let n = 0; n < 40; n++)
      item.run(`sk${n}`, `〜ばかりに${n}`, `chỉ vì ${n} (một nghĩa dài vừa phải để card cao như thật)`, iso(now - n * 1000));
    db.prepare(
      `INSERT INTO "Group" (id, name, kind, color, note, createdAt, updatedAt)
       VALUES ('grp-sk', 'Nhóm đo skeleton', 'grammar', NULL, 'ghi chú', ?, ?)`,
    ).run(iso(now), iso(now));
    const mem = db.prepare(`INSERT INTO GroupMember (groupId, itemId, addedAt) VALUES ('grp-sk', ?, ?)`);
    for (let n = 0; n < 20; n++) mem.run(`sk${n}`, iso(now));
  } finally {
    db.close();
  }
});

for (const width of [1440, 390]) {
  test(`skeletons match their pages at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/login');
    await page.getByLabel('Email').fill(E2E_EMAIL);
    await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

    const failures: string[] = [];
    for (const pair of PAIRS) {
      // The tab a page restores from sessionStorage decides its body shape, and the skeleton reads the
      // same keys — clear them so both sides start from the documented default.
      await page.evaluate(() => sessionStorage.clear());

      await page.goto(pair.page, { waitUntil: 'networkidle' });
      await page.waitForTimeout(450);
      const R = await page.evaluate(MEASURE);
      const realItems = pair.items
        ? await page.locator('main ul.md\\:hidden > li:visible, main tbody tr:visible').count()
        : 0;

      await page.goto(`/dev-skeleton/${pair.skeleton}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(450);
      const S = await page.evaluate(MEASURE);
      const skelItems = pair.items ? await page.locator('[data-skeleton-row]:visible').count() : 0;

      const at = (m: string) => `${pair.name} @${width}px: ${m}`;
      if (!R || !S) {
        failures.push(at(`no PageShell/PageSkeleton found (page=${!!R} skeleton=${!!S})`));
        continue;
      }
      // 1. the skeleton must fit the viewport. This is the check that caught /settings' 134px.
      if (S.overflow > 1) failures.push(at(`skeleton overflows the viewport by ${S.overflow}px`));
      // 2. same header row height — a wrapped row is the drift a screenshot hides.
      if (Math.abs(S.row!.h - R.row!.h) > 2)
        failures.push(at(`header row is ${S.row!.h}px, page is ${R.row!.h}px`));
      // 3. same start — the MobileTopBar placeholder below md, the crumb above it.
      if (Math.abs(S.firstKid!.x - R.firstKid!.x) > 1)
        failures.push(at(`row starts at x=${S.firstKid!.x}, page at x=${R.firstKid!.x}`));
      // 4. same container width tier (a form must not flash full-bleed).
      if (Math.abs(S.shell!.w - R.shell!.w) > 1)
        failures.push(at(`shell is ${S.shell!.w}px wide, page is ${R.shell!.w}px`));
      // 5. the body starts on the same line.
      if (R.body && S.body && Math.abs(S.body.y - R.body.y) > 4)
        failures.push(at(`body starts at y=${S.body.y}, page at y=${R.body.y}`));
      // 6. the aside sits where the page puts it: pinned right below md, beside the crumb above it.
      if (R.aside && S.aside) {
        if (width < 768) {
          if (Math.abs(S.aside.right - R.aside.right) > 2)
            failures.push(at(`aside ends at x=${S.aside.right}, page at x=${R.aside.right}`));
        } else if (Math.abs(S.aside.x - R.aside.x) > (pair.asideTol ?? 8)) {
          failures.push(at(`aside starts at x=${S.aside.x}, page at x=${R.aside.x}`));
        }
      } else if (Boolean(R.aside) !== Boolean(S.aside)) {
        failures.push(at(`aside present on ${R.aside ? 'the page' : 'the skeleton'} only`));
      }
      // 7. list pages at md+: the same number of rows, so data arriving doesn't re-flow the page.
      if (pair.items && width >= 768 && Math.abs(skelItems - realItems) > 1)
        failures.push(at(`skeleton shows ${skelItems} items, page shows ${realItems}`));
    }

    expect(failures, `skeleton/page mismatches:\n${failures.join('\n')}`).toEqual([]);
  });
}
