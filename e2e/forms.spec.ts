import path from 'node:path';
import Database from 'better-sqlite3';
import ExcelJS from 'exceljs';
import { expect, test, type Page } from '@playwright/test';
import { E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN, E2E_OWNER, seedE2eAccount } from './fixtures';

// docs/ui-standard.md › Form (thien, 2026-10-24): a required field has a red * beside its label and
// the form says what the mark means; sending the form with a required field empty puts the error
// under that field; on a laptop the form fills the page's width.

test.beforeAll(async () => {
  await seedE2eAccount();
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  try {
    const insert = db.prepare(
      `INSERT OR REPLACE INTO Item (userId, id, kind, expression, reading, hanviet, meaningVi, level, notes, source,
         captureReason, suspended, starred, createdAt)
       VALUES (${E2E_OWNER}, ?, ?, ?, ?, NULL, ?, ?, NULL, 'MCP', NULL, 0, 0, ?)`,
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

// thien, 2026-10-25 (Thêm và Sửa tài nguyên round 1): the send button stays off until the form has
// something to send, so an untouched form never shows "Cần nhập ..." errors; an error under a
// field is a broken rule, such as a value over its limit, said in a few words.
test('add grammar: required marks, send off until filled, full width', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  await page.goto('/resources/new?kind=grammar', { waitUntil: 'networkidle' });

  await expect(page.getByText('là bắt buộc.').first()).toBeVisible();
  const expression = field(page, 'Mẫu ngữ pháp');
  const meaning = field(page, 'Nghĩa (tiếng Việt)');
  const send = page.getByRole('button', { name: 'Thêm mẫu' });
  await expect(expression).toHaveAttribute('aria-required', 'true');
  await expect(field(page, 'Cách đọc (kana)')).not.toHaveAttribute('aria-required', 'true');

  await expect(send).toBeDisabled();
  await expression.fill('〜ずにはいられない');
  await expect(send, 'the meaning is still empty').toBeDisabled();
  await meaning.fill('không thể không');
  await expect(send).toBeEnabled();
  await expect(page.getByText(/Cần nhập/)).toHaveCount(0);

  // Over the limit: a short error under the field, and the button goes off again.
  await expression.fill('〜'.repeat(25));
  await expect(page.getByText('Tối đa 20 ký tự, đang có 25.')).toBeVisible();
  await expect(expression).toHaveAttribute('aria-invalid', 'true');
  await expect(send).toBeDisabled();

  // The form fills the template's width, not a narrow column.
  const card = await page.locator('form').first().boundingBox();
  const header = await page.locator('[data-template] header').boundingBox();
  expect(card!.width, 'form width').toBeGreaterThan(header!.width - 64);

  // The explanations sit under the card, not inside the inputs, folded behind a toggle button.
  const guide = page.getByRole('region', { name: 'Hướng dẫn' });
  const toggle = guide.getByRole('button', { name: 'Hướng dẫn' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(guide.getByText('Cách đọc (kana)')).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(guide.getByText('Cách đọc (kana)')).toBeVisible();
  await toggle.click();
  await expect(guide.getByText('Cách đọc (kana)')).toBeHidden();

  // The paste tab's button waits for a line it can add.
  await page.getByRole('tab', { name: 'Dán danh sách' }).click();
  const pasteSend = page.getByRole('button', { name: /^Thêm/ }).filter({ visible: true }).last();
  await expect(pasteSend).toBeDisabled();
  await page.getByRole('textbox', { name: 'Danh sách' }).fill('〜ばかりに: chỉ vì N2');
  await expect(pasteSend).toHaveText('Thêm 1 mẫu');
  await expect(pasteSend).toBeEnabled();
});

test('edit an item: Lưu waits for a change, and an emptied required field turns it off', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto('/resources/form-item/edit?kind=grammar', { waitUntil: 'networkidle' });
  // thien, 2026-10-25: the title is the action alone; the form shows what is being edited.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sửa ngữ pháp');
  const save = page.getByRole('button', { name: 'Lưu', exact: true });
  const meaning = field(page, 'Nghĩa (tiếng Việt)');
  await expect(save, 'nothing changed yet').toBeDisabled();
  await meaning.fill('chỉ vì… (hậu quả xấu)');
  await expect(save).toBeEnabled();
  await meaning.fill('chỉ vì');
  await expect(save, 'back to the saved value').toBeDisabled();
  await meaning.fill('');
  await expect(save).toBeDisabled();
  await expect(page.getByText(/Cần nhập/)).toHaveCount(0);
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

test('new group: Thêm nhóm waits for a name', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto('/groups/new', { waitUntil: 'networkidle' });
  const send = page.getByRole('button', { name: 'Thêm nhóm' });
  await expect(send).toBeDisabled();
  await field(page, 'Tên nhóm').fill('Nhóm luyện thi');
  await expect(send).toBeEnabled();
  await expect(page.getByText(/Cần nhập/)).toHaveCount(0);
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
  await expect(page.getByText('Tối đa 40 ký tự, đang có 41.')).toBeVisible();
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('button', { name: 'Thêm nhóm' })).toBeDisabled();
});
