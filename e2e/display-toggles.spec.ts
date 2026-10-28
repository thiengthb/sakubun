import { expect, test } from '@playwright/test';
import { E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

// thien, 7.4: the sidebar's display switches are two icon toggles of one kind, あ (furigana) and
// the theme, raised like every choice chip; furigana is the learner's setting, kept on the server.

test.beforeAll(async () => {
  await seedE2eAccount();
});

test('the sidebar toggles furigana and the theme', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

  const theme = page.getByRole('button', { name: /^Chuyển sang giao diện/ });
  const furigana = page.getByRole('button', { name: /furigana$/ });
  await expect(theme).toBeVisible();
  await expect(furigana).toBeVisible();
  for (const toggle of [theme, furigana]) {
    const look = await toggle.evaluate((el) => {
      const cs = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return { edge: cs.borderTopWidth, lip: cs.boxShadow, h: box.height, w: box.width };
    });
    expect(look.edge).toBe('2px');
    expect(look.lip).toMatch(/0px 2px 0px/);
    // 26px of box and a 2px lip: 28px to the eye, like every control from 768px.
    expect(look.h).toBe(26);
  }
  const t = (await theme.boundingBox())!;
  const f = (await furigana.boundingBox())!;
  expect(Math.abs(t.y - f.y)).toBeLessThan(1);

  const before = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  await theme.click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.classList.contains('dark')))
    .toBe(!before);

  // Furigana is on for a new learner; off survives a reload, and on again restores it.
  await expect(furigana).toHaveAttribute('aria-pressed', 'true');
  // Pressed looks chosen (brand ink) even inside its tooltip, whose trigger takes over data-state.
  const brand = await page.evaluate(() => {
    const probe = document.body.appendChild(document.createElement('span'));
    probe.className = 'text-accent-brand';
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  });
  await page.mouse.move(700, 450);
  await expect.poll(() => furigana.evaluate((el) => getComputedStyle(el).color)).toBe(brand);
  await furigana.click();
  await expect(page.getByRole('button', { name: 'Hiện furigana' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(page.getByRole('button', { name: 'Hiện furigana' })).toBeEnabled();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Hiện furigana' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.getByRole('button', { name: 'Hiện furigana' }).click();
  await expect(page.getByRole('button', { name: 'Ẩn furigana' })).toBeEnabled();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Ẩn furigana' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
