const { chromium } = require('playwright');
// Usage: STATE=state.json BASE=http://localhost:3789 node style-audit.cjs [route ...]
// Counts font sizes, weights, colors, gaps, paddings and targets under 24px inside <main>.
const BASE = process.env.BASE ?? 'http://localhost:3789';
const routes = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['/', '/review', '/resources', '/library', '/settings', '/kaiwa'];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({
    viewport: { width: 1440, height: 900 },
    storageState: process.env.STATE ?? 'state.json',
  });
  const p = await ctx.newPage();
  const agg = { fs: {}, fw: {}, color: {}, gap: {}, pad: {} };
  for (const r of routes) {
    await p.goto(BASE + r, { waitUntil: 'networkidle', timeout: 180000 });
    const res = await p.evaluate(() => {
      const o = { fs: {}, fw: {}, color: {}, gap: {}, pad: {}, small: 0, smallList: [] };
      for (const el of document.querySelectorAll('main *')) {
        const cs = getComputedStyle(el);
        const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (hasText) {
          o.fs[cs.fontSize] = (o.fs[cs.fontSize] || 0) + 1;
          o.fw[cs.fontWeight] = (o.fw[cs.fontWeight] || 0) + 1;
          o.color[cs.color] = (o.color[cs.color] || 0) + 1;
        }
        if (cs.display.includes('flex') || cs.display.includes('grid')) {
          const g = cs.rowGap + '/' + cs.columnGap;
          if (g !== 'normal/normal') o.gap[g] = (o.gap[g] || 0) + 1;
        }
        for (const k of ['paddingTop', 'paddingLeft'])
          if (cs[k] !== '0px') o.pad[cs[k]] = (o.pad[cs[k]] || 0) + 1;
        if (el.matches('button,a,[role=button],input,select')) {
          const rc = el.getBoundingClientRect();
          if (rc.width && (rc.height < 24 || rc.width < 24)) {
            o.small++;
            o.smallList.push(
              (el.getAttribute('aria-label') || el.textContent).trim().slice(0, 20) +
                ':' +
                Math.round(rc.width) +
                'x' +
                Math.round(rc.height),
            );
          }
        }
      }
      return o;
    });
    console.log(r, 'small targets <24px:', res.small, res.smallList.slice(0, 6).join(', '));
    for (const k of ['fs', 'fw', 'color', 'gap', 'pad'])
      for (const [v, c] of Object.entries(res[k])) agg[k][v] = (agg[k][v] || 0) + c;
  }
  for (const k of ['fs', 'fw', 'color', 'gap', 'pad']) {
    const e = Object.entries(agg[k]).sort((a, b) => b[1] - a[1]);
    console.log(k, e.length, 'distinct:', e.map(([v, c]) => v + '×' + c).join('  '));
  }
  await b.close();
})();
