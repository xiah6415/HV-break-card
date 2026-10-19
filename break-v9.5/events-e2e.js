const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('./engine.js');
const STOP = Symbol('late draw event reached');
async function makeTrace() {
  const trace = [];
  const human = { wantsAck: true, async choose(g, p, req) {
    const target = req.kind === 'event' && req.timing === 'rcv' && req.options.some(o => o.value === 'PR-029');
    const value = target ? 'PR-029' : req.kind === 'mulligan' ? [] : req.kind === 'event' && req.timing === 'drw' ? null : await E.AI.choose(g, p, req);
    trace.push({ req: JSON.parse(JSON.stringify(req)), value });
    if (target) throw STOP;
    return value;
  } };
  const game = new E.Game({ seed: 1, decks: ['hk_axis', 'seijoh'], agents: [human, E.AI] });
  await assert.rejects(game.run(), error => error === STOP);
  return trace;
}
(async () => {
  const trace = await makeTrace();
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || undefined });
  try {
    for (const [width, height] of [[390, 844], [320, 568]]) {
      const page = await browser.newPage({ viewport: { width, height }, isMobile: true, hasTouch: true });
      page.setDefaultTimeout(10000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.setContent(fs.readFileSync('index.html', 'utf8'), { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => { Date.now = () => 1; });
      await page.selectOption('#myDeck', 'hk_axis');
      await page.selectOption('#aiDeck', 'seijoh');
      await page.selectOption('#speed', '200');
      await page.click('#startBtn');
      let savedDraw = false;
      for (const { req, value } of trace) {
        if (req.kind === 'roll') { await page.click('#dockOpts [data-i="0"]'); continue; }
        if (req.kind === 'lossConfirm') { await page.waitForSelector('#confirmLoss'); await page.click('#confirmLoss'); continue; }
        let ready = false;
        for (let step = 0; step < 200; step++) {
          if (await page.locator('#turnScreen:visible').count()) {
            await page.click('#turnNext');
          }
          if (!await page.locator('#turnScreen:visible').count() && (await page.locator('#dockQ').textContent()).includes(req.prompt)) { ready = true; break; }
          await page.waitForTimeout(50);
        }
        assert(ready, 'must reach scripted decision: ' + req.kind);
        if (req.kind === 'mulligan') { await page.click('[data-act="multi"]'); continue; }
        if (req.kind === 'ack') {
          if (!savedDraw && width === 390) {
            await page.screenshot({ path: path.join(process.env.E2E_OUTPUT_DIR || '.', 'draw-action-mobile.png') });
            savedDraw = true;
          }
          await page.click('#dockOpts [data-act="ack"]'); continue;
        }
        const index = req.options.findIndex(o => JSON.stringify(o.value) === JSON.stringify(value));
        assert(index >= 0, 'scripted choice must belong to the request');
        const option = req.options[index];
        const target = req.kind === 'event' && req.timing === 'rcv' && value === 'PR-029';
        if (target) {
          assert.match(await page.locator('#dockQ').textContent(), /抽牌階段可用的事件/);
          const before = await page.locator('#meSide .hand').textContent();
          await page.locator(`.hand .hc.sel .cbtn[data-card="${value}"]`).first().click();
          await page.waitForSelector('[data-act="confirm"]');
          if (width === 390) await page.screenshot({ path: path.join(process.env.E2E_OUTPUT_DIR || '.', 'late-event-mobile.png') });
          await page.click('[data-act="confirm"]');
          await page.waitForFunction(name => document.getElementById('logSide').textContent.includes('打出 ' + name), E.nm(value));
          await page.waitForFunction(() => document.getElementById('dockQ').textContent.includes('鬼と鬼だな：最多'));
          let recovered = 0;
          while ((await page.locator('#dockQ').textContent()).includes('鬼と鬼だな：最多')) {
            await page.click('#dockOpts [data-i="0"]'); await page.click('[data-act="confirm"]'); recovered++;
            await page.waitForFunction(() => !document.querySelector('[data-act="confirm"]'));
            await page.waitForFunction(() => !document.getElementById('dock').classList.contains('wait'));
          }
          assert(recovered > 0, 'must exercise an actual optional recovery');
          for (let step = 0; step <= recovered; step++) {
            await page.click('#undoBtn');
            await page.waitForFunction(() => !document.getElementById('dockQ').textContent.includes('正在撤回'));
          }
          await page.waitForFunction(prompt => document.getElementById('dockQ').textContent.includes(prompt), req.prompt);
          assert.equal(await page.locator('#meSide .hand').textContent(), before, 'Undo must restore the event and recovered cards');
          assert.equal(await page.locator('.hand .hc.sel .cbtn[data-card="PR-029"]').count(), 1);
          break;
        }
        const hand = typeof value === 'string' && option.card && page.locator(`.hand .hc.sel .cbtn[data-card="${value}"]`).first();
        if (hand && await hand.count()) {
          await hand.click(); await page.click('[data-act="confirm"]');
        } else {
          await page.click(`#dockOpts [data-i="${index}"]`);
          if (option.card && !Object.hasOwn(req.ctx || {}, 'revealed')) await page.click('[data-act="confirm"]');
        }
      }
      assert.equal(errors.length, 0);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      console.log(`late event UI passed: ${width}×${height}, skip draw window → receive → play recovery → Undo`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
