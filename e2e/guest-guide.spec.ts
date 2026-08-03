import { expect, test } from '@playwright/test';

// The guest-readable `/guide` (plan 2026-07-25 phase F2) shipped BROKEN and static checks could not
// see it: PageShell renders `MobileTopBar`, which called the throwing `useSidebar`, but a signed-out
// visitor is deliberately rendered OUTSIDE `SidebarProvider` — so the whole page became the error
// boundary. It still answered HTTP 200 with no sidebar/nav/logout markup, which is exactly what a
// curl-level check was looking for, so the check passed on the error page.
//
// Hence this test asserts the END STATE a reader sees: real guide content, no error boundary, and no
// app navigation. Deep links are covered too, because `?tab=`/`?topic=` are applied on mount (the
// sessionStorage-wins trap) and a silent regression there is invisible in the served HTML.
test.describe('guest /guide', () => {
  test('renders the guide, not the error boundary, and offers no app nav', async ({ page }) => {
    await page.goto('/guide');

    // The tab strip is the guide's own chrome — present only if the page actually rendered.
    await expect(page.getByRole('tab', { name: 'Bắt đầu' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Tính năng' })).toBeVisible();

    // The failure mode this test exists for.
    await expect(page.getByText('Có lỗi xảy ra')).toHaveCount(0);

    // A signed-out reader gets the public bar (sign in / sign up), never links that bounce to /login.
    await expect(page.getByRole('link', { name: 'Đăng nhập' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Tài nguyên' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Đăng xuất' })).toHaveCount(0);
  });

  test('a ?tab= + ?topic= deep link opens that topic', async ({ page }) => {
    await page.goto('/guide?tab=features&topic=furigana');

    await expect(page.getByRole('tab', { name: 'Tính năng' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    // The topic accordion item exists and the deep link expanded it.
    const topic = page.locator('#guide-topic-furigana');
    await expect(topic).toBeVisible();
    await expect(topic).toHaveAttribute('data-state', 'open');
  });
});
