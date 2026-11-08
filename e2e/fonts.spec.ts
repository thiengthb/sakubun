import { expect, test, type Page } from '@playwright/test';

// UI v2 D3 (docs/plans/2026-11-08-ui-v2.md): the UI font is Onest, Japanese runs use the device's
// Japanese stack. next/font lists no `vietnamese` subset for Onest, so this asks the browser which
// font actually drew the Vietnamese letters: if ạ, ố, ữ fell back to a system font, the line would
// mix two typefaces and nothing else would notice.

const VI = 'Tiếng Việt: ạ ặ ậ ẹ ệ ị ọ ộ ợ ụ ự ỵ ố ữ ẳ ỡ';

async function fontsFor(page: Page, selector: string) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument');
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
  const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
  return fonts;
}

test('Vietnamese letters draw in Onest at every weight; Japanese uses the JP stack', async ({
  page,
}) => {
  await page.goto('/login');
  await page.evaluate((vi) => {
    const box = document.createElement('div');
    box.id = 'font-probe';
    for (const w of [400, 500, 600, 700]) {
      const p = document.createElement('p');
      p.id = `vi-${w}`;
      p.style.fontWeight = String(w);
      p.textContent = vi;
      box.append(p);
    }
    const ja = document.createElement('p');
    ja.id = 'ja';
    ja.lang = 'ja';
    ja.textContent = '漢字とかな';
    box.append(ja);
    document.body.append(box);
  }, VI);
  await page.evaluate(() => document.fonts.ready);

  for (const w of [400, 500, 600, 700]) {
    const fonts = await fontsFor(page, `#vi-${w}`);
    const names = fonts.map((f) => `${f.familyName} (${f.glyphCount})`);
    expect(names, `weight ${w}: every glyph should come from Onest`).toHaveLength(1);
    expect(fonts[0].familyName, `weight ${w}`).toMatch(/Onest/);
  }

  const jaFamily = await page
    .locator('#ja')
    .evaluate((el) => getComputedStyle(el).fontFamily.split(',')[0].trim().replace(/['"]/g, ''));
  expect(jaFamily).toBe('Hiragino Sans');
});
