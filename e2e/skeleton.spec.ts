import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

interface Pair {
  name: string;
  page: string;
  skeleton: string;
  asideTol?: number;
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
  { name: 'group detail', page: '/groups/grp-sk/', skeleton: 'group', asideTol: 260 },
  { name: 'group new', page: '/groups/new', skeleton: 'group-new' },
  { name: 'group edit', page: '/groups/grp-sk/edit', skeleton: 'group-edit' },
  { name: 'group add', page: '/groups/grp-sk/add', skeleton: 'group-add' },
];

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
  const aside = kids.length > 2 ? kids[kids.length - 1] : null;
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
    test.setTimeout(180_000);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/login');
    await page.getByLabel('Email').fill(E2E_EMAIL);
    await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

    const failures: string[] = [];
    for (const pair of PAIRS) {
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
      if (S.overflow > 1) failures.push(at(`skeleton overflows the viewport by ${S.overflow}px`));
      if (Math.abs(S.row!.h - R.row!.h) > 2)
        failures.push(at(`header row is ${S.row!.h}px, page is ${R.row!.h}px`));
      if (Math.abs(S.firstKid!.x - R.firstKid!.x) > 1)
        failures.push(at(`row starts at x=${S.firstKid!.x}, page at x=${R.firstKid!.x}`));
      if (Math.abs(S.shell!.w - R.shell!.w) > 1)
        failures.push(at(`shell is ${S.shell!.w}px wide, page is ${R.shell!.w}px`));
      if (R.body && S.body && Math.abs(S.body.y - R.body.y) > 4)
        failures.push(at(`body starts at y=${S.body.y}, page at y=${R.body.y}`));
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
      if (pair.items && width >= 768 && Math.abs(skelItems - realItems) > 1)
        failures.push(at(`skeleton shows ${skelItems} items, page shows ${realItems}`));
    }

    expect(failures, `skeleton/page mismatches:\n${failures.join('\n')}`).toEqual([]);
  });
}
