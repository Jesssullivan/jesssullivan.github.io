import { createRequire } from 'node:module';
const require = createRequire('/Users/jess/git/jesssullivan.github.io.worktrees/S1-tsne-20261006/package.json');
const { chromium } = require('playwright');
const BASE = process.argv[2];
const b = await chromium.launch({ channel: 'chrome' });
const meter = (page, ms) => page.evaluate((ms) => new Promise((res) => {
  const f = []; let last = performance.now(); const end = last + ms;
  const tick = (t) => { f.push(t - last); last = t; if (t < end) requestAnimationFrame(tick); else { const s=[...f].sort((a,b)=>a-b); res({ fps: +(f.length/(ms/1000)).toFixed(1), p95: +s[Math.floor(s.length*.95)].toFixed(1), over50: f.filter(x=>x>50).length }); } };
  requestAnimationFrame(tick);
}), ms);
const out = {};
for (const [name, opts] of Object.entries({ desktop: { viewport: { width: 1440, height: 900 } }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } })) {
  for (const throttle of [1, 4]) {
    for (const url of ['/', '/?flags=constellation']) {
      const ctx = await b.newContext(opts); const page = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page);
      await page.goto(BASE + url); await page.waitForLoadState('networkidle').catch(()=>{}); await page.waitForTimeout(500);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
      const k = `${name} x${throttle} ${url}`;
      out[k] = { idle: await meter(page, 2000) };
      if (url.includes('flags')) {
        out[k].switchMs = await page.evaluate(() => new Promise((res) => {
          const btn = [...document.querySelectorAll('.controls button')].find((x) => x.textContent.includes('Similarity map'));
          const t0 = performance.now();
          btn.click();
          const check = () => document.querySelector('svg.projection-map') ? requestAnimationFrame(() => res(+(performance.now() - t0).toFixed(1))) : requestAnimationFrame(check);
          check();
        }));
        out[k].mapIdle = await meter(page, 2000);
      }
      await ctx.close();
    }
  }
}
console.log(JSON.stringify(out, null, 1));
await b.close();
