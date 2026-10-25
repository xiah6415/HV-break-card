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
      await page.goto(require('node:url').pathToFileURL(path.resolve('index.html')).href, { waitUntil: 'domcontentloaded' });await page.selectOption('#gameMode','strict');
      await page.click('#supportBtn');
      const counts = await page.evaluate(() => BreakCardLibrary.data.counts);
      assert.equal(await page.locator('[data-support-card]').count(), Math.min(60, counts.cards));
      assert.match(await page.locator('#sheetBox').textContent(), new RegExp(counts.cards + ' 張卡片可查閱，' + counts.playable + ' 張可對戰'));
      await page.fill('#libraryQuery', 'P03-090');
      await page.click('[data-support-card="P03-090"]');
      assert.match(await page.locator('#sheetBox').textContent(), /部分技能待補/);
      assert.match(await page.locator('#sheetBox').textContent(), /完全無變化/);
      assert.match(await page.locator('#sheetBox a').getAttribute('href'), /no=HV-P03-090/);
      if (width === 390) await page.screenshot({ path: path.join(process.env.E2E_OUTPUT_DIR || '.', 'audit-partial-skill-mobile.png') });
      await page.click('#sheetBox [data-close]');
      await page.click('#supportBtn'); await page.fill('#libraryQuery', 'PR-057'); await page.click('[data-support-card="PR-057"]');
      assert.match(await page.locator('#sheetBox').textContent(), /1年.*2年/);
      assert.match(await page.locator('#sheetBox').textContent(), /每次登場時選/);
      assert.match(await page.locator('#sheetBox').textContent(), /主要技能情境已測試/);
      await page.click('#sheetBox [data-close]');
      await page.click('#editDeck'); await page.click('.imp-json summary');
      await page.fill('#customJSON', JSON.stringify({ n: 'Official bonus code', c: [['HVBP-002', 40]] }));
      await page.click('#saveCustom');
      assert.match(await page.locator('#myDeck').inputValue(), /^my_/);
      await page.locator('#myStrip [data-card="BP-002"]').click();
      assert.match(await page.locator('#sheetBox').textContent(), /HVBP-002/);
      assert.match(await page.locator('#sheetBox').textContent(), /主要技能情境已測試/);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(errors, []);
      console.log(`audit UI passed: ${width}×${height}, full-library paginated coverage, partial skills, official sources, dual years, HVBP import`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
