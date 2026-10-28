import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test, type Page } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, E2E_OWNER, seedE2eAccount } from './fixtures';

// thien, 7.4 (docs/ui-standard.md › Thẻ): a grammar or vocab card is the level chip, the title with
// its speaker, the meaning on one line (in full in a tooltip only when cut), the menu over the star;
// an item never reviewed has a red "Mới" tag; choosing many is the table's job, not the cards'.

const LONG =
  'làm cho...; quyết định làm... (biến đổi trạng thái hoặc chọn lựa giữa nhiều khả năng)';

function seed() {
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  const iso = (ms: number) => new Date(ms).toISOString().replace('Z', '+00:00');
  const now = Date.now();
  try {
    for (const t of ['GroupMember', 'Group', 'ReviewLog', 'SrsState', 'Turn', 'Sentence', 'Item'])
      db.exec(`DELETE FROM "${t}"`);
    const item = db.prepare(
      `INSERT INTO Item (userId, id, kind, expression, reading, hanviet, meaningVi, level, source, suspended, starred, createdAt)
       VALUES (${E2E_OWNER}, ?, 'GRAMMAR', ?, NULL, NULL, ?, 'N4', 'MCP', 0, 0, ?)`,
    );
    const srs = db.prepare(
      `INSERT INTO SrsState (userId, id, itemId, due, stability, difficulty, scheduledDays, learningSteps,
         reps, lapses, state, lastReview)
       VALUES (${E2E_OWNER}, ?, ?, ?, 3, 5, 3, 0, ?, 0, ?, ?)`,
    );
    item.run('fresh', '〜ないで', 'mà không làm...', iso(now));
    srs.run('s1', 'fresh', iso(now), 0, 0, null);
    item.run('seen', '〜くする', LONG, iso(now - 1000));
    srs.run('s2', 'seen', iso(now + 86_400_000), 3, 2, iso(now - 3_600_000));
  } finally {
    db.close();
  }
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

test.beforeAll(async () => {
  await seedE2eAccount();
  seed();
});

test('card view: Mới on the new item, no tick boxes, the cut meaning in a tooltip', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  await page.goto('/resources?tab=grammar', { waitUntil: 'networkidle' });
  // The table chooses many; pick a row, then switch to cards: the choice does not linger unseen.
  await page.locator('table tbody').getByRole('checkbox').first().click();
  await expect(page.getByRole('button', { name: 'Bỏ chọn' })).toBeVisible();
  await page.getByRole('button', { name: 'Xem dạng thẻ' }).click();

  const list = page.locator('[data-slot="data-table-cards"]');
  await expect(list).toBeVisible();
  await expect(list.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Bỏ chọn' })).toHaveCount(0);

  const fresh = list.locator('li').filter({ hasText: '〜ないで' });
  const seen = list.locator('li').filter({ hasText: '〜くする' });
  await expect(fresh.getByText('Mới', { exact: true })).toBeVisible();
  await expect(seen.getByText('Mới', { exact: true })).toHaveCount(0);
  // No status line: the schedule is the table's.
  await expect(list.getByText(/Ôn tập|giờ nữa/)).toHaveCount(0);

  // The tag sits on the card's top edge.
  const card = (await fresh.boundingBox())!;
  const tag = (await fresh.getByText('Mới', { exact: true }).boundingBox())!;
  expect(tag.y).toBeLessThan(card.y);
  expect(tag.y + tag.height).toBeGreaterThan(card.y);

  // A meaning that fits has no tooltip; a cut one shows in full, and a click on it still opens the item.
  const short = fresh.getByText('mà không làm...');
  // Text that fits stays under the card's link, so the mouse rests on the link there.
  const at = (await short.boundingBox())!;
  await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
  await page.waitForTimeout(800);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  const cut = seen.getByText(LONG);
  await cut.hover();
  await expect(page.getByRole('tooltip').filter({ hasText: LONG })).toBeVisible();
  await cut.click();
  await page.waitForURL(/\/resources\/seen$/);
});

for (const width of [1440, 390]) {
  test(`while loading, the chosen card view waits as cards of the same height at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    await page.goto('/resources?tab=grammar&view=cards', { waitUntil: 'networkidle' });
    const real = page.locator('[data-slot="data-table-cards"] > li').filter({ visible: true });
    const realHeight = (await real.first().boundingBox())!.height;

    await page.goto('/dev-skeleton/resources?tab=grammar&view=cards', {
      waitUntil: 'networkidle',
    });
    const rows = page.locator('[data-skeleton-row]').filter({ visible: true });
    await expect(rows.first()).toBeVisible();
    // No table frame and no page footer around the cards.
    await expect(page.locator('main .divide-y').filter({ visible: true })).toHaveCount(0);
    expect(Math.abs((await rows.first().boundingBox())!.height - realHeight)).toBeLessThan(3);
  });
}
