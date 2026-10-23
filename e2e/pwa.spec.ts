import { expect, test } from '@playwright/test';

// Roadmap 2.4: what a phone checks before it offers "Add to Home Screen".
test('the web app manifest is served with real icons and opens on quick review', async ({
  request,
  page,
}) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest).toMatchObject({ display: 'standalone', start_url: '/review' });

  const sizes = (manifest.icons as { src: string; sizes: string; purpose?: string }[]).map(
    (icon) => icon.sizes,
  );
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
  expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === 'maskable')).toBe(
    true,
  );
  for (const icon of manifest.icons as { src: string }[]) {
    const image = await request.get(icon.src);
    expect(image.ok(), icon.src).toBe(true);
    expect(image.headers()['content-type']).toContain('image/png');
  }

  await page.goto('/login');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/manifest.webmanifest',
  );
  const apple = page.locator('link[rel="apple-touch-icon"]');
  expect((await request.get((await apple.getAttribute('href'))!)).ok()).toBe(true);
});
