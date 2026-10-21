'use strict';
// C 通用選擇元件：1280／390／320 實際點選所有 fixture（Claude 2026-10-21）
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'), assert = require('node:assert/strict'), path = require('node:path'), { pathToFileURL } = require('node:url');
const H = require('./host-choice'), { fixtures } = require('./choice-fixtures');
const out = process.env.E2E_OUTPUT_DIR || '.';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || undefined });
  try {
    for (const [width, height] of [[1280, 900], [390, 844], [320, 568]]) {
      const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 500, hasTouch: width < 500 }), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(pathToFileURL(path.resolve('choice-demo.html')).href, { waitUntil: 'load' });
      for (let k = 0; k < fixtures.length; k++) {
        const r = fixtures[k];
        await page.selectOption('#pick', String(k));
        const v = H.aiValue(r);
        // 依 AI 值實際點 UI：卡片／選項／攔網中攔
        const click = async val => page.locator(`#stage [data-hc-v='${JSON.stringify(val).replace(/'/g, "\\'")}']`).click();
        if (r.input.type === 'single' || r.input.type === 'number') await click(v);
        if (r.input.type === 'cards') for (const x of v) await click(x);
        if (r.input.type === 'block') { for (const x of v.cards) await click(x); }
        const go = page.locator('#stage [data-hc-act="go"]');
        assert.ok(await go.isEnabled(), r.kind + ' 確認鍵應可按');
        await go.click();
        const txt = await page.textContent('#out');
        assert.match(txt, /驗證：通過/, `${width} ${r.kind}: ${txt}`);
        assert.deepEqual(JSON.parse(txt.split('\n')[0].replace('回答：', '')).value, v);
        // 卡圖確實載入
        for (const img of await page.locator('#stage img').all()) await img.evaluate(i => new Promise((ok, bad) => i.complete ? (i.naturalWidth ? ok() : bad(Error('broken ' + i.src))) : (i.onload = ok, i.onerror = () => bad(Error('broken ' + i.src)))));
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width} ${r.kind} 橫向溢出`);
        const st = await page.evaluate(() => { const s = document.getElementById('stage'); return s.scrollWidth <= s.clientWidth + 1; });
        assert.ok(st, `${width} ${r.kind} 選擇區溢出`);
      }
      // 錯誤路徑：攔網同名、超量、中攔切換、Loss 二次確認
      const bi = fixtures.findIndex(r => r.kind === 'block'), b = fixtures[bi], [tsu, h1, h2, kag] = b.options.map(o => o.value);
      await page.selectOption('#pick', String(bi));
      const tile = v => page.locator(`#stage [data-hc-v='${JSON.stringify(v)}']`);
      await tile(h1).click(); await tile(h2).click();
      assert.match(await page.textContent('#stage .hc-err'), /同名/);
      await tile(tsu).click(); await tile(kag).click();
      assert.equal(await page.locator('#stage .hc-card.on').count(), 3);
      await page.locator(`#stage [data-hc-ctr='${JSON.stringify(kag)}']`).click();
      assert.equal(await page.locator('#stage .hc-badge.ctr').count(), 1);
      await page.click('#stage [data-hc-act="go"]');
      assert.deepEqual(JSON.parse((await page.textContent('#out')).split('\n')[0].replace('回答：', '')).value, { cards: [h1, tsu, kag], center: kag });
      if (width === 390) await page.screenshot({ path: path.join(out, 'choice-block-390.png') });
      const gi = fixtures.findIndex(r => r.kind === 'guts'); await page.selectOption('#pick', String(gi));
      const g = fixtures[gi].options.map(o => o.value);
      for (const x of g.slice(0, 3)) await page.locator(`#stage [data-hc-v='${JSON.stringify(x)}']`).click();
      assert.match(await page.textContent('#stage .hc-err'), /最多/);
      assert.ok(await page.locator('#stage [data-hc-act="go"]').isEnabled());
      await page.click('#stage [data-hc-act="loss"]'); await page.click('#stage [data-hc-act="lossyes"]');
      assert.match(await page.textContent('#out'), /命令：loss/);
      const oi = fixtures.findIndex(r => r.input.ordered); await page.selectOption('#pick', String(oi));
      const ov = fixtures[oi].options.map(o => o.value);
      for (const x of [ov[2], ov[0], ov[1]]) await page.locator(`#stage [data-hc-v='${JSON.stringify(x)}']`).click();
      assert.deepEqual(await page.locator('#stage .hc-badge').allTextContents(), ['2', '3', '1']);
      if (width === 390) await page.screenshot({ path: path.join(out, 'choice-ordered-390.png') });
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ width, fixtures: fixtures.length, passed: true }));
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
