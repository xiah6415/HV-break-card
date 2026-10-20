const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || undefined });
  try {
    for (const [width, height] of [[1280, 900], [390, 844], [320, 568]]) {
      const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 700, hasTouch: width < 700 });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.setContent(fs.readFileSync('index.html', 'utf8'), { waitUntil: 'domcontentloaded' });
      await page.click('#supportBtn');
      assert.equal(await page.locator('[data-support-card]').count(), 47);
      assert.match(await page.locator('#sheetBox').textContent(), /18 張無技能卡、13 張主要技能情境已測試、16 張/);
      await page.click('[data-support-card="P01-033"]');
      assert.match(await page.locator('#sheetBox').textContent(), /部分技能待補/);
      assert.match(await page.locator('#sheetBox').textContent(), /參數/);
      assert.match(await page.locator('#sheetBox a').getAttribute('href'), /no=HV-P01-033/);
      if (width === 390) await page.screenshot({ path: path.join(process.env.E2E_OUTPUT_DIR || '.', 'audit-partial-skill-mobile.png') });
      await page.click('#sheetBox [data-close]');
      await page.click('#supportBtn'); await page.click('[data-support-card="PR-057"]');
      assert.match(await page.locator('#sheetBox').textContent(), /1年.*2年/);
      assert.match(await page.locator('#sheetBox').textContent(), /每次登場時選/);
      assert.match(await page.locator('#sheetBox').textContent(), /主要技能情境已測試/);
      await page.click('#sheetBox [data-close]');
      await page.click('#editDeck'); await page.click('.imp-json summary');
      await page.fill('#customJSON', JSON.stringify({ n: 'Official bonus code', c: [['HVBP-002', 40]] }));
      await page.click('#saveCustom');
      assert.equal(await page.locator('#myDeck').inputValue(), 'custom');
      await page.locator('#myStrip [data-card="BP-002"]').click();
      assert.match(await page.locator('#sheetBox').textContent(), /HVBP-002/);
      assert.match(await page.locator('#sheetBox').textContent(), /主要技能情境已測試/);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(errors, []);
      console.log(`audit UI passed: ${width}×${height}, 47-card coverage, partial skills, official sources, dual years, HVBP import`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
