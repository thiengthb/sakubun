import { expect, test } from '@playwright/test';

const ROUTES = [
  '/login',
  '/',
  '/items',
  '/vocab',
  '/resources',
  '/history',
  '/review',
  '/settings',
  '/groups',
];

test('làm nóng dev server: compile trước mọi route bộ e2e chạm', async ({ request }) => {
  test.setTimeout(240_000);

  for (const route of ROUTES) {
    const res = await request.get(route, { timeout: 120_000 });
    expect(res.status(), `route ${route} trả lỗi server khi làm nóng`).toBeLessThan(500);
  }
});
