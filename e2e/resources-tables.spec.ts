import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test, type Page } from '@playwright/test';
import { CURRENT_ENRICHMENT_VERSION } from '@/lib/library/enrichment';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

const iso = (ms: number) => new Date(ms).toISOString().replace('Z', '+00:00');

const FULL_CARD = JSON.stringify({
  v: CURRENT_ENRICHMENT_VERSION,
  usage: 'Diễn tả nguyên nhân dẫn tới kết quả xấu, người nói thường hối tiếc.',
  structure: ['Vる + ばかりに', 'Aい + ばかりに'],
  collocations: ['油断したばかりに', '一言言ったばかりに'],
  example: { ja: '油断したばかりに、負けてしまった。', vi: 'Chỉ vì lơ là mà đã thua.' },
  examples: [{ ja: '一言言ったばかりに、喧嘩になった。', vi: 'Chỉ vì một câu mà thành cãi nhau.' }],
  pitfalls: ['Không dùng cho kết quả tốt.'],
  contrasts: [{ with: '〜せいで', note: 'ばかりに nhấn sự hối tiếc của người nói.' }],
  register: 'văn viết / kể lại',
});

const VOCAB_CARD = JSON.stringify({
  v: CURRENT_ENRICHMENT_VERSION,
  usage: 'Việc chuẩn bị trước cho một việc cụ thể; trung tính, dùng cả nói và viết.',
  collocations: ['準備をする', '準備が整う', '準備中'],
  example: { ja: '会議の準備をしています。', vi: 'Tôi đang chuẩn bị cho cuộc họp.' },
  examples: [{ ja: '準備が整いました。', vi: 'Đã chuẩn bị xong.' }],
  pitfalls: ['Không nhầm với 用意 khi nói về chuẩn bị dài hạn.'],
  synonyms: [{ term: '用意', reading: 'ようい', vi: 'sự sắm sẵn', note: 'thiên về vật cụ thể.' }],
  antonyms: [
    { term: '本番', reading: 'ほんばん', vi: 'lúc diễn thật', note: 'ngược với lúc chuẩn bị.' },
  ],
});

async function seed() {
  await seedE2eAccount();
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  const now = Date.now();
  for (const t of ['GroupMember', 'Group', 'ReviewLog', 'SrsState', 'Sentence', 'Item'])
    db.exec(`DELETE FROM "${t}"`);

  const item = db.prepare(
    `INSERT INTO Item (id, kind, expression, reading, hanviet, meaningVi, level, notes, source,
       captureReason, suspended, starred, enrichment, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'MCP', ?, ?, ?, ?, ?)`,
  );
  item.run(
    'g1',
    'GRAMMAR',
    '〜ばかりに',
    null,
    null,
    'chỉ vì',
    'N2',
    null,
    null,
    0,
    0,
    FULL_CARD,
    iso(now - 1000),
  );
  item.run(
    'g2',
    'GRAMMAR',
    '〜ざるを得ない',
    null,
    null,
    'buộc phải',
    'N2',
    null,
    null,
    0,
    0,
    null,
    iso(now - 2000),
  );
  item.run(
    'g3',
    'GRAMMAR',
    '〜わけではない',
    null,
    null,
    'không phải là',
    'N3',
    null,
    null,
    0,
    0,
    null,
    iso(now - 3000),
  );
  item.run(
    'g4',
    'GRAMMAR',
    '〜たばかり',
    null,
    null,
    'vừa mới',
    'N4',
    null,
    null,
    0,
    0,
    null,
    iso(now - 4000),
  );
  item.run(
    'v1',
    'VOCAB',
    '把握',
    'はあく',
    'bả ác',
    'nắm bắt',
    'N2',
    '状況を把握する。',
    'misused',
    0,
    0,
    null,
    iso(now - 1000),
  );
  item.run(
    'v2',
    'VOCAB',
    '曖昧',
    'あいまい',
    'ái muội',
    'mơ hồ',
    'N2',
    null,
    'unclear',
    0,
    0,
    null,
    iso(now - 2000),
  );
  item.run(
    'v3',
    'VOCAB',
    '矛盾',
    'むじゅん',
    'mâu thuẫn',
    'mâu thuẫn',
    'N3',
    null,
    'unknown',
    0,
    0,
    null,
    iso(now - 3000),
  );
  item.run(
    'v4',
    'VOCAB',
    '準備',
    'じゅんび',
    null,
    'sự chuẩn bị',
    'N5',
    null,
    null,
    0,
    0,
    VOCAB_CARD,
    iso(now - 4000),
  );

  const group = db.prepare(
    `INSERT INTO "Group" (id, name, kind, color, note, createdAt, updatedAt) VALUES (?, ?, ?, NULL, NULL, ?, ?)`,
  );
  group.run('gr-gram', 'Nhóm ngữ pháp', 'grammar', iso(now), iso(now));
  group.run('gr-vocab', 'Nhóm từ vựng', 'vocab', iso(now), iso(now));

  db.prepare(
    `INSERT INTO Sentence (id, direction, context, exerciseType, sourceText, sourceRuby, userAnswer,
       suggested, suggestedRuby, feedback, score, stagedItems, status, starred,
       createdAt, answeredAt)
     VALUES ('s1', 'VI_JA', NULL, 'TRANSLATION', 'Tôi vừa mới đến.', NULL, '来たばかりです。',
       '来たばかりです。', NULL, NULL, 90, NULL, 'GRADED', 0, ?, ?)`,
  ).run(iso(now), iso(now + 1000));
  db.close();
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

async function pickFilter(page: Page, currentValue: string, next: string) {
  await page.getByRole('combobox').filter({ hasText: currentValue }).first().click();
  await page.getByRole('option', { name: next, exact: true }).click();
}

async function withFilters(page: Page, body: () => Promise<void>) {
  const trigger = page.getByRole('button', { name: /^Bộ lọc/ });
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await body();
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
}

// The rows on the table's one page. A table that fits one page has no footer count
// (thien, 2026-10-24), and every seed here fits one page.
async function shownCount(page: Page, _noun: string): Promise<number> {
  await page.waitForTimeout(300);
  return page.locator('tbody tr').count();
}

const TABS = [
  { tab: 'grammar', noun: 'mẫu', firstHeader: 'Mẫu ngữ pháp', bulkNoun: 'mẫu ngữ pháp' },
  { tab: 'vocab', noun: 'từ', firstHeader: 'Từ', bulkNoun: 'từ vựng' },
] as const;

test('phần dùng chung của hai bảng: sắp xếp, cột ẩn mặc định, lọc theo cấp JLPT', async ({
  page,
}) => {
  await seed();
  await login(page);

  for (const t of TABS) {
    await page.goto(`/resources?tab=${t.tab}`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('columnheader', { name: t.firstHeader })).toBeVisible();
    expect(await shownCount(page, t.noun), `${t.tab}: 4 dòng đã seed`).toBe(4);

    const created = page.getByRole('columnheader', { name: 'Ngày thêm' });
    await expect(created).not.toHaveAttribute('aria-sort', /ascending|descending/);
    await page.getByRole('button', { name: 'Ngày thêm' }).click();
    const first = await created.getAttribute('aria-sort');
    expect(first, `${t.tab}: bấm header phải sắp xếp`).toMatch(/ascending|descending/);
    await page.getByRole('button', { name: 'Ngày thêm' }).click();
    await expect(created).toHaveAttribute(
      'aria-sort',
      first === 'ascending' ? 'descending' : 'ascending',
    );

    await expect(page.getByRole('columnheader', { name: 'Đã ôn' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Hiển thị cột' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Đã ôn (lần)' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('columnheader', { name: 'Đã ôn' })).toBeVisible();

    await withFilters(page, async () => {
      await pickFilter(page, 'Mọi cấp', 'N2');
      expect(await shownCount(page, t.noun), `${t.tab}: lọc N2 còn 2`).toBe(2);
      await pickFilter(page, 'N2', 'Mọi cấp');
      expect(await shownCount(page, t.noun), `${t.tab}: bỏ lọc về lại 4`).toBe(4);
    });
  }
});

test('phần RIÊNG của mỗi bảng: thẻ chi tiết (ngữ pháp) · lý do + Hán Việt (từ vựng)', async ({
  page,
}) => {
  await seed();
  await login(page);

  await page.goto('/resources?tab=grammar', { waitUntil: 'networkidle' });
  const body = page.locator('tbody');
  await withFilters(page, async () => {
    await pickFilter(page, 'Mọi mục', 'Thẻ đủ');
    expect(await shownCount(page, 'mẫu'), 'chỉ 〜ばかりに có thẻ đủ').toBe(1);
    await expect(body.getByText('〜ばかりに')).toBeVisible();

    await pickFilter(page, 'Thẻ đủ', 'Chưa có thẻ');
    expect(await shownCount(page, 'mẫu'), 'ba mục còn lại chưa có thẻ').toBe(3);
  });

  await page.goto('/resources?tab=vocab', { waitUntil: 'networkidle' });
  await withFilters(page, async () => {
    await expect(page.getByRole('combobox').filter({ hasText: 'Mọi lý do' })).toBeVisible();
    await expect(page.getByRole('combobox').filter({ hasText: 'Mọi mục' })).toBeVisible();
    await pickFilter(page, 'Mọi mục', 'Thẻ đủ');
    expect(await shownCount(page, 'từ'), 'chỉ 準備 có thẻ đủ theo thước đo TỪ VỰNG').toBe(1);
    await expect(body.getByText('準備').first()).toBeVisible();
    await pickFilter(page, 'Thẻ đủ', 'Mọi mục');

    await pickFilter(page, 'Mọi lý do', 'Dùng sai');
    expect(await shownCount(page, 'từ'), 'chỉ 把握 là "Dùng sai"').toBe(1);
    await expect(body.getByText('把握').first()).toBeVisible();
    await expect(body.getByText('Dùng sai').first()).toBeVisible();

    await pickFilter(page, 'Dùng sai', 'Mọi lý do');
  });

  await expect(page.getByRole('columnheader', { name: 'Hán Việt' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Hiển thị cột' }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Âm Hán Việt' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('columnheader', { name: 'Hán Việt' })).toBeVisible();
  await expect(body.getByText('bả ác', { exact: true })).toBeVisible();
});

test('ô tìm mirror ra URL cùng một kiểu ở /resources và /history', async ({ page }) => {
  await seed();
  await login(page);

  await page.goto('/resources?tab=grammar', { waitUntil: 'networkidle' });
  await page.getByPlaceholder('Tìm mẫu / cách đọc / nghĩa…').fill('vừa');
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('vừa');

  await page.goto('/history', { waitUntil: 'networkidle' });
  await page.getByPlaceholder('Tìm trong đề / bài dịch…').fill('vừa');
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('vừa');

  await page.goto('/resources?tab=grammar&q=vừa', { waitUntil: 'networkidle' });
  await expect(page.getByPlaceholder('Tìm mẫu / cách đọc / nghĩa…')).toHaveValue('vừa');
});

test('chọn dòng: thanh hành động khối gọi đúng danh từ của từng bảng', async ({ page }) => {
  await seed();
  await login(page);

  for (const t of TABS) {
    await page.goto(`/resources?tab=${t.tab}`, { waitUntil: 'networkidle' });
    await page.getByRole('checkbox', { name: 'Chọn tất cả dòng trên trang' }).check();
    await expect(page.getByRole('button', { name: `Xóa 4 ${t.bulkNoun}` })).toBeVisible();
    await expect(page.getByRole('button', { name: /Tạm ngưng|Cho học lại/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Thêm vào nhóm/ })).toBeVisible();
    await page.getByRole('button', { name: 'Bỏ chọn' }).click();
  }
});

test('bảng ngữ pháp không sinh thanh cuộn ngang ở 1440px, và không tiêu đề nào bị cắt', async ({
  page,
}) => {
  await seed();
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  await page.goto('/resources?tab=grammar', { waitUntil: 'networkidle' });
  await expect(page.getByRole('columnheader', { name: /Cấp/ })).toBeVisible();

  const fit = await page.evaluate(() => {
    const table = document.querySelector('table');
    if (!table) return { error: 'không thấy bảng' };
    let overflowPx = 0;
    for (let el: HTMLElement | null = table.parentElement; el; el = el.parentElement) {
      overflowPx = Math.max(overflowPx, el.scrollWidth - el.clientWidth);
    }
    const cut = [...document.querySelectorAll('th')]
      .map((th) => {
        const span = th.querySelector('span.truncate');
        if (!span) return null;
        return span.scrollWidth > span.clientWidth + 1 ? (th.textContent ?? '').trim() : null;
      })
      .filter((x): x is string => x !== null);
    return { overflowPx, cut };
  });

  expect(fit, 'bảng phải render').not.toHaveProperty('error');
  expect(fit.cut, 'không tiêu đề cột nào được phép bị cắt').toEqual([]);
  expect(fit.overflowPx, 'không phần tử nào quanh bảng được cuộn ngang ở 1440px').toBe(0);
});

test('thẻ chi tiết của TỪ VỰNG hiện trên web: đồng nghĩa, trái nghĩa, ví dụ kèm dịch', async ({
  page,
}) => {
  await seed();
  await login(page);
  await page.goto('/resources/v4', { waitUntil: 'networkidle' });

  await page.getByRole('tab', { name: 'Chi tiết từ' }).click();

  await expect(page.getByRole('heading', { name: /Từ đồng nghĩa/ })).toBeVisible();
  await expect(page.getByText('sự sắm sẵn')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Từ trái nghĩa/ })).toBeVisible();
  await expect(page.getByText('lúc diễn thật')).toBeVisible();

  await expect(page.getByText('Đã chuẩn bị xong.')).toBeVisible();
  await expect(page.getByText('Tôi đang chuẩn bị cho cuộc họp.')).toBeVisible();

  await expect(page.locator('button[aria-label*="Nghe từ 用意"]')).toBeVisible();

  await expect(page.getByText(/thiếu:/)).toHaveCount(0);
});

test('đổi kiểu hiển thị: nút chỉ có ở màn hình lớn, mobile luôn là thẻ', async ({ page }) => {
  await seed();
  await login(page);

  const cards = page.locator('[data-slot="data-table-cards"]');
  const toggle = page.getByRole('button', { name: 'Xem dạng thẻ' });

  // Màn hình lớn: mặc định là bảng, và có nút chuyển.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/resources?tab=grammar', { waitUntil: 'networkidle' });
  await expect(page.getByRole('columnheader', { name: 'Mẫu ngữ pháp' })).toBeVisible();
  await expect(cards).toBeHidden();
  await expect(toggle).toBeVisible();

  await toggle.click();
  await expect(cards).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Mẫu ngữ pháp' })).toBeHidden();
  // Không còn cột nào để bật/tắt thì menu Cột cũng biến mất.
  await expect(page.getByRole('button', { name: 'Hiển thị cột' })).toHaveCount(0);

  // Lựa chọn được nhớ lại sau khi tải lại trang.
  await page.reload({ waitUntil: 'networkidle' });
  await expect(cards).toBeVisible();
  await page.getByRole('button', { name: 'Xem dạng bảng' }).click();
  await expect(cards).toBeHidden();

  // Mobile: luôn là thẻ, và KHÔNG có nút chuyển — kể cả khi lựa chọn đang là "bảng".
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(cards).toBeVisible();
  await expect(page.getByRole('group', { name: 'Kiểu hiển thị' })).toBeHidden();
});

test('bộ lọc đang bật hiện thành chip, xoá được từng cái', async ({ page }) => {
  await seed();
  await login(page);
  await page.goto('/resources?tab=grammar', { waitUntil: 'networkidle' });

  const chip = page.getByRole('button', { name: 'Bỏ lọc Cấp JLPT: N2' });
  await expect(chip).toHaveCount(0);

  await withFilters(page, async () => {
    await pickFilter(page, 'Mọi cấp', 'N2');
  });

  // Popover đã đóng, nhưng vẫn nhìn thấy đang lọc theo gì.
  await expect(chip).toBeVisible();
  expect(await shownCount(page, 'mẫu')).toBe(2);

  await chip.click();
  await expect(chip).toHaveCount(0);
  expect(await shownCount(page, 'mẫu')).toBe(4);
});

// docs/ui-standard.md: adding and editing are pages of their own, never a form in a dialog. The
// list's one create action is "Thêm" in the page header, and it follows the open tab.
test('Thêm và Sửa mở trang riêng, không mở hộp thoại', async ({ page }) => {
  await seed();
  await login(page);

  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    for (const kind of ['grammar', 'vocab'] as const) {
      await page.goto(`/resources?tab=${kind}`, { waitUntil: 'networkidle' });
      const add = page.locator('header').getByRole('link', { name: 'Thêm', exact: true });
      await expect(add, `${width}px ${kind}: one Thêm in the header`).toHaveCount(1);
      await add.click();
      await page.waitForURL((u) => u.pathname === '/resources/new', { timeout: 15_000 });
      expect(new URL(page.url()).searchParams.get('kind')).toBe(kind);
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/resources?tab=grammar', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Tác vụ' }).first().click();
  await page.getByRole('menuitem', { name: 'Sửa' }).click();
  await page.waitForURL((u) => /^\/resources\/[^/]+\/edit$/.test(u.pathname), { timeout: 15_000 });
  // The link names the kind, so the loading screen can say "Sửa ngữ pháp" before the item loads.
  expect(new URL(page.url()).searchParams.get('kind')).toBe('grammar');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
