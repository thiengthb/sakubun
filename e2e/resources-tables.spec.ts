// Hai bảng của /resources — ngữ pháp và từ vựng — trong browser thật, session thật.
//
// VIẾT TRƯỚC MỘT REFACTOR, cố ý. `items-table.tsx` và `vocab-table.tsx` gần như là một file: đo ngày
// 2026-08-06 cho 145 cửa sổ 12-dòng trùng nhau giữa chúng, gồm một khối 92 dòng. Phần sắp được gom ra
// dùng chung là ĐÚNG những gì spec này lái: 7 cột FSRS/meta, cột hành động, và 4 hàng bộ lọc giống
// nhau. Trước spec này, tab TỪ VỰNG không có một dòng test browser nào — nên "gom lại mà không hỏng"
// là một câu không kiểm được.
//
// Mọi assert dưới đây là về HÀNH VI người dùng thấy, không phải về cấu trúc code, nên nó vẫn đúng sau
// khi hai file được gom thành một config chung — đó là điều kiện để nó là lưới an toàn chứ không phải
// bản chụp của code hiện tại.
import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test, type Page } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

const iso = (ms: number) => new Date(ms).toISOString().replace('Z', '+00:00');

/**
 * Một thẻ enrichment ĐỦ, để bộ lọc "Thẻ chi tiết" của tab ngữ pháp có cả hai phía.
 *
 * `v: 2` — tên field là `v`, KHÔNG phải `version`, và phải bằng `CURRENT_ENRICHMENT_VERSION`
 * (lib/enrichment.ts). Bản đầu của fixture này viết `version: 3`; Zod bỏ qua field lạ và điền `v: 1`
 * mặc định, nên `scoreEnrichment` xếp thẻ vào tier `outdated` và bộ lọc "Thẻ đủ" trả về 0 dòng.
 * Test đỏ vì FIXTURE sai, không vì app sai — đúng loại lỗi mà một fixture bịa ra theo trí nhớ sinh ra.
 * Cả năm chiều (structure · usage · collocations · example(s) · pitfalls/contrasts) phải có mặt, nếu
 * thiếu một chiều thì tier là `thin`.
 */
const FULL_CARD = JSON.stringify({
  v: 2,
  usage: 'Diễn tả nguyên nhân dẫn tới kết quả xấu, người nói thường hối tiếc.',
  structure: ['Vる + ばかりに', 'Aい + ばかりに'],
  collocations: ['油断したばかりに', '一言言ったばかりに'],
  example: { ja: '油断したばかりに、負けてしまった。', vi: 'Chỉ vì lơ là mà đã thua.' },
  examples: [{ ja: '一言言ったばかりに、喧嘩になった。', vi: 'Chỉ vì một câu mà thành cãi nhau.' }],
  pitfalls: ['Không dùng cho kết quả tốt.'],
  contrasts: [{ with: '〜せいで', note: 'ばかりに nhấn sự hối tiếc của người nói.' }],
  register: 'văn viết / kể lại',
});

async function seed() {
  await seedE2eAccount();
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  const now = Date.now();
  for (const t of ['GroupMember', 'Group', 'ReviewLog', 'SrsState', 'Sentence', 'Item'])
    db.exec(`DELETE FROM "${t}"`);

  const item = db.prepare(
    `INSERT INTO Item (id, kind, expression, reading, hanviet, meaningVi, level, notes, source,
       captureReason, suspended, starred, enrichment, createdAt, challengeObservations)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'MCP', ?, ?, ?, ?, ?, 0)`,
  );
  // Ngữ pháp: 4 mục, 2 cấp, một mục CÓ thẻ đủ và ba mục chưa có thẻ.
  //            id     kind      expression        reading hanviet meaning        level notes reason susp star card       createdAt
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
  // Từ vựng: 4 mục, 2 cấp, ba lý do khác nhau + một mục không có lý do, một mục CÓ âm Hán Việt.
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
    null,
    iso(now - 4000),
  );

  // Một nhóm mỗi loại. BẮT BUỘC phải có: `BulkGroupActions` không vẽ gì khi KHÔNG có nhóm nào nhận
  // được selection — hành vi đúng của app, nhưng nó làm bản đầu của test này đỏ ở chỗ "Thêm vào nhóm".
  const group = db.prepare(
    `INSERT INTO "Group" (id, name, kind, color, note, createdAt, updatedAt) VALUES (?, ?, ?, NULL, NULL, ?, ?)`,
  );
  group.run('gr-gram', 'Nhóm ngữ pháp', 'grammar', iso(now), iso(now));
  group.run('gr-vocab', 'Nhóm từ vựng', 'vocab', iso(now), iso(now));

  // Một lượt dịch, CHỈ để /history có ô tìm: không có câu nào thì trang đó vẽ empty state và ô tìm
  // không tồn tại — test so sánh mã hoá `?q` giữa hai trang đỏ vì thiếu dữ liệu, không vì lệch mã hoá.
  db.prepare(
    `INSERT INTO Sentence (id, direction, context, exerciseType, sourceText, sourceRuby, userAnswer,
       suggested, suggestedRuby, feedback, score, stagedItems, extraPatterns, status, starred,
       createdAt, answeredAt)
     VALUES ('s1', 'VI_JA', NULL, 'TRANSLATION', 'Tôi vừa mới đến.', NULL, '来たばかりです。',
       '来たばかりです。', NULL, NULL, 90, NULL, NULL, 'GRADED', 0, ?, ?)`,
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

/**
 * Chọn một giá trị trong một hàng bộ lọc của FilterPopover.
 *
 * KHÔNG dùng `getByLabel`: `FilterRow` vẽ một `<Label>` KHÔNG liên kết `htmlFor` với trigger của Radix
 * Select, nên `getByLabel('Cấp JLPT')` không bao giờ resolve (đã đo — nó timeout 60s). Trigger được
 * nhận diện bằng GIÁ TRỊ ĐANG HIỆN của nó, thứ duy nhất phơi ra cho a11y.
 */
async function pickFilter(page: Page, currentValue: string, next: string) {
  await page.getByRole('combobox').filter({ hasText: currentValue }).first().click();
  await page.getByRole('option', { name: next, exact: true }).click();
}

/**
 * Mở panel "Bộ lọc" và giữ nó mở cho MỌI lần chọn, rồi đóng một lần ở cuối.
 *
 * Hai điều đã đo được, và cả hai đều là lý do hàm này tồn tại:
 *   1. `Escape` KHÔNG đóng panel này (`aria-expanded` vẫn `true` sau 21 lần thử lại). Đóng bằng chính
 *      trigger — nó là toggle.
 *   2. Vì (1), đóng-rồi-mở-lại giữa các lần chọn làm cú bấm thứ hai TOGGLE panel về đóng, và
 *      `pickFilter` kế tiếp treo 60s chờ một combobox không hiển thị. Nên: mở MỘT lần, chọn hết, đóng
 *      MỘT lần. Panel mở không che dòng đếm, nên không cần đóng để đọc số.
 */
async function withFilters(page: Page, body: () => Promise<void>) {
  const trigger = page.getByRole('button', { name: /^Bộ lọc/ });
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await body();
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
}

/** Số bản ghi bảng đang hiện, đọc từ dòng đếm của DataTable ("1–4 / 4 mẫu"). */
async function shownCount(page: Page, noun: string): Promise<number> {
  const text =
    (await page
      .getByText(new RegExp(`/\\s*\\d+\\s*${noun}`))
      .first()
      .textContent()) ?? '';
  return Number(text.match(new RegExp(`/\\s*(\\d+)\\s*${noun}`))?.[1] ?? -1);
}

// Cấu hình cho phần DÙNG CHUNG. Mỗi tab chỉ khác nhau ở nhãn — đó chính là luận điểm của refactor.
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

    // --- cột dùng chung "Ngày thêm" sắp xếp được, và aria-sort nói ra trạng thái ---
    // KHÔNG assert chiều nào trước: đo được là cú bấm đầu cho `descending` (DataTable đảo chiều mặc
    // định cho cột ngày/số — mới nhất trước là cái người ta muốn xem). Điều đáng chốt là nó ĐỔI
    // trạng thái và ĐẢO được, không phải thứ tự cụ thể của hai lần bấm.
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

    // --- một cột FSRS ẩn mặc định bật được lên (đây là 1 trong 7 cột sắp gom ra dùng chung) ---
    await expect(page.getByRole('columnheader', { name: 'Đã ôn' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Hiển thị cột' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Đã ôn (lần)' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('columnheader', { name: 'Đã ôn' })).toBeVisible();

    // --- hàng bộ lọc dùng chung: Cấp JLPT. Hai mục N2 trong cả hai tab. ---
    await withFilters(page, async () => {
      await pickFilter(page, 'Mọi cấp', 'N2');
      expect(await shownCount(page, t.noun), `${t.tab}: lọc N2 còn 2`).toBe(2);
      // Dòng đếm phải nói ra rằng nó đã bị lọc, không âm thầm đổi tổng.
      await expect(page.getByText('(lọc từ 4)')).toBeVisible();
      // Trả về "Mọi cấp" bằng chính hàng select — đường người dùng thật cũng đi.
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

  // --- ngữ pháp: bộ lọc theo chất lượng thẻ enrichment. Đã seed 1 thẻ đủ / 3 chưa có. ---
  await page.goto('/resources?tab=grammar', { waitUntil: 'networkidle' });
  // Phạm vi `tbody` cho mọi phép tìm text của mục: cùng một chuỗi còn nằm trong nhãn sr-only của link
  // card và trong layout thẻ dưới md, nên `getByText` không phạm vi vi phạm strict mode (3 element).
  const body = page.locator('tbody');
  await withFilters(page, async () => {
    await pickFilter(page, 'Mọi mục', 'Thẻ đủ');
    expect(await shownCount(page, 'mẫu'), 'chỉ 〜ばかりに có thẻ đủ').toBe(1);
    await expect(body.getByText('〜ばかりに')).toBeVisible();

    await pickFilter(page, 'Thẻ đủ', 'Chưa có thẻ');
    expect(await shownCount(page, 'mẫu'), 'ba mục còn lại chưa có thẻ').toBe(3);
  });

  // --- từ vựng: bộ lọc riêng của nó, và bộ lọc của tab kia KHÔNG được có ở đây ---
  await page.goto('/resources?tab=vocab', { waitUntil: 'networkidle' });
  await withFilters(page, async () => {
    // Nhận diện hai hàng bộ lọc riêng bằng GIÁ TRỊ MẶC ĐỊNH của chúng, không bằng nhãn: "Lý do" cũng
    // là tên một cột trong bảng, nên nhãn khớp 2 element và assert không chốt được gì. "Mọi mục" (bộ
    // lọc thẻ của tab ngữ pháp) và "Mọi lý do" thì mỗi cái chỉ có một chỗ.
    await expect(page.getByRole('combobox').filter({ hasText: 'Mọi mục' })).toHaveCount(0);
    await expect(page.getByRole('combobox').filter({ hasText: 'Mọi lý do' })).toBeVisible();

    await pickFilter(page, 'Mọi lý do', 'Dùng sai');
    expect(await shownCount(page, 'từ'), 'chỉ 把握 là "Dùng sai"').toBe(1);
    await expect(body.getByText('把握').first()).toBeVisible();
    // Badge lý do hiện ngay trong bảng (nó có cột riêng từ 2026-07-20, không dán vào ô "Từ").
    await expect(body.getByText('Dùng sai').first()).toBeVisible();

    await pickFilter(page, 'Dùng sai', 'Mọi lý do');
  });

  // --- cột Hán Việt: CHỈ tab từ vựng có, và nó ẩn mặc định ---
  await expect(page.getByRole('columnheader', { name: 'Hán Việt' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Hiển thị cột' }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Âm Hán Việt' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('columnheader', { name: 'Hán Việt' })).toBeVisible();
  // Trong `tbody`: cùng chuỗi cũng nằm trong thẻ mobile dưới dạng «[bả ác]» bên cạnh từ.
  await expect(body.getByText('bả ác', { exact: true })).toBeVisible();
});

test('ô tìm mirror ra URL cùng một kiểu ở /resources và /history', async ({ page }) => {
  // Hai trang dùng CÙNG tên tham số `?q` nhưng đi qua hai bản cơ chế persistence khác nhau:
  // `components/shared/use-session-state.ts` và một bản sao riêng bên trong `data-table.tsx`. Bản sao
  // đó luôn `JSON.stringify`, nên một chuỗi ra URL thành `q=%22abc%22` (CÓ dấu ngoặc kép), còn bản dùng
  // chung ghi `q=abc`. Cùng một tên tham số, hai cách mã hoá — đúng loại lệch mà hai bản sao của một cơ
  // chế sinh ra, và không có gì bắt được nó cho tới khi ai đó gửi link cho người khác.
  await seed();
  await login(page);

  await page.goto('/resources?tab=grammar', { waitUntil: 'networkidle' });
  await page.getByPlaceholder('Tìm mẫu / cách đọc / nghĩa…').fill('vừa');
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('vừa');

  await page.goto('/history', { waitUntil: 'networkidle' });
  await page.getByPlaceholder('Tìm trong đề / bài dịch…').fill('vừa');
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('vừa');

  // Và link đó phải mở lại được: nạp thẳng URL có `?q=` thì ô tìm phải chứa đúng giá trị đó.
  await page.goto('/resources?tab=grammar&q=vừa', { waitUntil: 'networkidle' });
  await expect(page.getByPlaceholder('Tìm mẫu / cách đọc / nghĩa…')).toHaveValue('vừa');
});

test('chọn dòng: thanh hành động khối gọi đúng danh từ của từng bảng', async ({ page }) => {
  await seed();
  await login(page);

  for (const t of TABS) {
    await page.goto(`/resources?tab=${t.tab}`, { waitUntil: 'networkidle' });
    await page.getByRole('checkbox', { name: 'Chọn tất cả dòng trên trang' }).check();
    // Danh từ là thứ DUY NHẤT khác nhau giữa hai thanh hành động khối — nên nó là chỗ một refactor
    // gom code sẽ làm sai đầu tiên (một danh từ cứng dùng cho cả hai bảng vẫn "chạy").
    // Chốt trên nhãn ĐẦY ĐỦ của nút xoá, không phải một regex chứa danh từ: `/từ vựng/` cũng khớp nút
    // "Thêm từ vựng" ở toolbar, và một assert khớp hai element khác nhau không chốt được gì.
    await expect(page.getByRole('button', { name: `Xóa 4 ${t.bulkNoun}` })).toBeVisible();
    await expect(page.getByRole('button', { name: /Tạm ngưng|Cho học lại/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Thêm vào nhóm/ })).toBeVisible();
    await page.getByRole('button', { name: 'Bỏ chọn' }).click();
  }
});

test('bảng ngữ pháp không sinh thanh cuộn ngang ở 1440px, và không tiêu đề nào bị cắt', async ({
  page,
}) => {
  // Vì sao ca này tồn tại (2026-08-11): rà giao diện bằng ảnh chụp phát hiện bảng rộng 1146px trong
  // khung 1132px — tràn đúng 14px, tức một thanh cuộn ngang chỉ để cuộn 14px, kèm cột cuối bị cắt. Cùng
  // lúc, "Level" (80px) bị cắt thành "Le…" và "Ngày thêm" (120px) thành "Ngày th…", vì ô tiêu đề còn
  // phải chứa tay kéo cột + nút sắp xếp — ĐO được là 48px phí mỗi ô. Cả ba đều là loại lỗi đọc code
  // không thấy: mọi con số trong `size:` trông hợp lý, chỉ trình duyệt mới biết chúng không vừa.
  //
  // Ca này chốt CẢ HAI, ở đúng bề rộng đã đo. Nó cố ý không chốt từng con số `size:` — chốt hệ quả
  // (không tràn, không cắt) để còn đổi bề rộng cột được mà không phải sửa test.
  await seed();
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  await page.goto('/resources?tab=grammar', { waitUntil: 'networkidle' });
  await expect(page.getByRole('columnheader', { name: /Cấp/ })).toBeVisible();

  const fit = await page.evaluate(() => {
    const table = document.querySelector('table');
    if (!table) return { error: 'không thấy bảng' };
    // Phần tử cuộn ngang, tìm bằng cách đi LÊN từ bảng thay vì đoán class.
    let overflowPx = 0;
    for (let el: HTMLElement | null = table.parentElement; el; el = el.parentElement) {
      overflowPx = Math.max(overflowPx, el.scrollWidth - el.clientWidth);
    }
    // Node thật sự cắt chữ tiêu đề là `span.truncate` trong nút sắp xếp.
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
