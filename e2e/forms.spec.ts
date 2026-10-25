import path from 'node:path';
import Database from 'better-sqlite3';
import ExcelJS from 'exceljs';
import { expect, test, type Page } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

// docs/ui-standard.md › Form (thien, 2026-10-24): a required field has a red * beside its label and
// the form says what the mark means; sending the form with a required field empty puts the error
// under that field; on a laptop the form fills the page's width.

test.beforeAll(async () => {
  await seedE2eAccount();
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  try {
    const insert = db.prepare(
      `INSERT OR REPLACE INTO Item (id, kind, expression, reading, hanviet, meaningVi, level, notes, source,
         captureReason, suspended, starred, createdAt)
       VALUES (?, ?, ?, ?, NULL, ?, ?, NULL, 'MCP', NULL, 0, 0, ?)`,
    );
    const at = new Date().toISOString().replace('Z', '+00:00');
    insert.run('form-item', 'GRAMMAR', '〜ばかりに', null, 'chỉ vì', 'N2', at);
    insert.run('form-vocab', 'VOCAB', '図書館', 'としょかん', 'thư viện', null, at);
  } finally {
    db.close();
  }
});

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

const field = (page: Page, label: string) =>
  page.locator('form').getByRole('textbox', { name: label, exact: true });

test('add grammar: required marks, errors under the fields, full width', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  await page.goto('/resources/new?kind=grammar', { waitUntil: 'networkidle' });

  await expect(page.getByText('là bắt buộc.').first()).toBeVisible();
  const expression = field(page, 'Mẫu ngữ pháp');
  const meaning = field(page, 'Nghĩa (tiếng Việt)');
  await expect(expression).toHaveAttribute('aria-required', 'true');
  await expect(field(page, 'Cách đọc (kana)')).not.toHaveAttribute('aria-required', 'true');

  await page.getByRole('button', { name: 'Thêm mẫu' }).click();
  await expect(page.getByText('Cần nhập mẫu ngữ pháp')).toBeVisible();
  await expect(page.getByText('Cần nhập nghĩa')).toBeVisible();
  await expect(expression).toHaveAttribute('aria-invalid', 'true');
  await expect(meaning).toHaveAttribute('aria-invalid', 'true');
  await expect(expression).toBeFocused();

  await expression.fill('〜ずにはいられない');
  await expect(page.getByText('Cần nhập mẫu ngữ pháp')).toHaveCount(0);
  await expect(page.getByText('Cần nhập nghĩa')).toBeVisible();

  // The form fills the template's width, not a narrow column.
  const card = await page.locator('form').first().boundingBox();
  const header = await page.locator('[data-template] header').boundingBox();
  expect(card!.width, 'form width').toBeGreaterThan(header!.width - 64);

  // The paste tab says what is missing instead of a silent disabled button.
  await page.getByRole('tab', { name: 'Dán danh sách' }).click();
  await page.getByRole('button', { name: 'Thêm mẫu' }).click();
  await expect(page.getByText('Chưa có mẫu hợp lệ nào để thêm')).toBeVisible();
});

test('edit an item: an emptied required field says so', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto('/resources/form-item/edit', { waitUntil: 'networkidle' });
  // thien, 2026-10-25: the title is the action alone; the form shows what is being edited.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sửa ngữ pháp');
  await field(page, 'Nghĩa (tiếng Việt)').fill('');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByText('Cần nhập nghĩa')).toBeVisible();
  await expect(page).toHaveURL(/\/resources\/form-item\/edit$/);
});

// UI redo 6.7 (2026-10-25): adding and editing a word or a pattern is one set of fields, so the
// form a learner fills is the form they fix: the same labels in the same order on both pages.
async function fieldLabels(page: Page) {
  return page
    .locator('form')
    .filter({ visible: true })
    .first()
    .locator('[aria-labelledby]')
    .evaluateAll((els) =>
      els.map((el) => {
        const label = document.getElementById(el.getAttribute('aria-labelledby')!);
        return label?.firstChild?.textContent?.trim() ?? '';
      }),
    );
}

for (const { kind, id } of [
  { kind: 'grammar', id: 'form-item' },
  { kind: 'vocab', id: 'form-vocab' },
]) {
  test(`${kind}: the add and edit forms show the same fields in the same order`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);
    await page.goto(`/resources/new?kind=${kind}`, { waitUntil: 'networkidle' });
    const add = await fieldLabels(page);
    expect(add).toContain('Cấp JLPT');
    expect(add).toContain('Ghi chú');
    await page.goto(`/resources/${id}/edit`, { waitUntil: 'networkidle' });
    expect(await fieldLabels(page)).toEqual(add);
    await expect(page.getByRole('link', { name: 'Huỷ', exact: true })).toBeVisible();
  });
}

test('excel tab: a Vietnamese file picker that names the file once', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto('/resources/new?kind=grammar', { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: 'Nhập Excel' }).filter({ visible: true }).first().click();

  // No browser-drawn "Choose File / No file chosen": the control is ours, in Vietnamese.
  await expect(page.locator('#excel-file')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Chọn file' })).toBeVisible();
  await expect(page.getByText('Chưa chọn file')).toBeVisible();

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Mazii');
  ws.addRow(['word', 'phonetic', 'mean', 'comment']);
  ws.addRow(['〜ばかりに', '', 'chỉ vì… (hậu quả xấu)', 'N2']);
  await page.locator('#excel-file').setInputFiles({
    name: 'mazii.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(await wb.xlsx.writeBuffer()),
  });
  await expect(page.getByRole('button', { name: 'Chọn file khác' })).toBeVisible();
  await expect(
    page.locator('form, [role=tabpanel]').getByText('mazii.xlsx', { exact: true }),
  ).toHaveCount(1);

  await page.getByRole('button', { name: 'Bỏ file' }).click();
  await expect(page.getByText('Chưa chọn file')).toBeVisible();
});

test('new group: the name is required', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto('/groups/new', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Thêm nhóm' }).click();
  await expect(page.getByText('Cần nhập tên nhóm')).toBeVisible();
  await expect(field(page, 'Tên nhóm')).toBeFocused();
});

test('new group: a name over 40 characters says so while typing and is not sent', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto('/groups/new', { waitUntil: 'networkidle' });
  const name = field(page, 'Tên nhóm');
  await name.fill('Nhóm luyện thi');
  await expect(page.getByText('14/40')).toBeVisible();
  await name.fill('a'.repeat(41));
  await expect(page.getByText('Tên nhóm tối đa 40 ký tự, đang có 41.')).toBeVisible();
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('button', { name: 'Thêm nhóm' }).click();
  await expect(page).toHaveURL(/\/groups\/new$/);
  await expect(name).toBeFocused();
});
