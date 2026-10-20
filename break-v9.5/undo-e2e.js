const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const html = require('node:fs').readFileSync('index.html', 'utf8');
const snapshot = page => page.evaluate(() => {
  const text = id => document.getElementById(id).textContent.replace(/\s+/g, ' ').trim();
  return {
    me: text('meSide'), opponent: text('oppSide'), net: text('net'), log: text('logSide'), question: text('dockQ'),
    cards: [...document.querySelectorAll('#meSide .hand [data-card]')].map(node => node.dataset.card)
  };
});
async function advance(page) {
  if (await page.locator('#turnScreen:visible').count()) return page.click('#turnNext');
  if (await page.locator('[data-act="multi"]').count()) return page.locator('[data-act="multi"]').click();
  if (await page.locator('[data-act="confirm"]').count()) return page.locator('[data-act="confirm"]').click();
  if (await page.locator('[data-act="gutsok"]').count()) {
    await page.locator('[data-act="gutsbottom"]').click(); return;
  }
  if (await page.locator('[data-act="blk"]').count()) {
    if (await page.locator('[data-act="blk"]').isEnabled()) return page.locator('[data-act="blk"]').click();
    if (await page.locator('[data-rec]').count()) return page.locator('[data-rec]').first().click();
  }
  if (/攔網還是接球/.test(await page.locator('#dockQ').textContent())) return page.locator('#dockOpts [data-i="0"]').click();
  if (await page.locator('.hand .hc.sel .cbtn').count()) return page.locator('.hand .hc.sel .cbtn').first().click();
  if (await page.locator('#dockOpts [data-i]').count()) return page.locator('#dockOpts [data-i]').last().click();
  await page.waitForTimeout(30);
}
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || undefined });
  try {
    for (const [width, height] of [[390, 844], [320, 568]]) {
      const page = await browser.newPage({ viewport: { width, height }, isMobile: true, hasTouch: true });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.setContent(html, { waitUntil: 'domcontentloaded' });await page.selectOption('#gameMode','strict');
      await page.selectOption('#turnPromptStyle', 'manual'); // This suite verifies explicit acknowledgment/replay; auto mode has its own regression.
      await page.evaluate(() => { Date.now = () => 7; });
      await page.selectOption('#aiDeck', 'hk_axis');
      await page.selectOption('#speed', '1000');
      await page.click('#startBtn');
      assert.equal(await page.locator('#undoBtn').isEnabled(), false);
      for (let step = 0; step < 350 && !await page.locator('#dockOpts [data-act="ack"]').count(); step++) await advance(page);
      assert.equal(await page.locator('#dockOpts [data-act="ack"]').count(), 1, 'must reach the human draw phase');
      const drawGeometry = await page.locator('#dockOpts [data-act="ack"]').evaluate(button => {
        const rect = button.getBoundingClientRect(), opts = button.parentElement.getBoundingClientRect();
        return { height: rect.height, width: rect.width, availableWidth: opts.width, fontSize: parseFloat(getComputedStyle(button).fontSize) };
      });
      assert(drawGeometry.height >= 60 && drawGeometry.fontSize >= 20, 'draw action must be large and readable');
      assert(drawGeometry.width >= drawGeometry.availableWidth - 2, 'draw action must occupy its own full row');
      const beforeDraw = await snapshot(page);
      await page.click('#dockOpts [data-act="ack"]');
      await page.waitForSelector('.hand .hc.sel');
      const afterDraw = await snapshot(page);
      assert.equal(afterDraw.cards.length, beforeDraw.cards.length + 1);
      await page.click('#undoBtn');
      await page.waitForSelector('#dockOpts [data-act="ack"]');
      assert.deepEqual(await snapshot(page), beforeDraw, 'Undo must remove the drawn card and its log');
      await page.click('#dockOpts [data-act="ack"]');
      await page.waitForSelector('.hand .hc.sel');
      assert.deepEqual(await snapshot(page), afterDraw, 're-drawing must reveal the identical card');

      await page.locator('.hand .hc.sel .cbtn').first().click();
      await page.waitForSelector('[data-act="confirm"]');
      await page.click('#undoBtn');
      assert.deepEqual(await snapshot(page), afterDraw, 'Undo first cancels an unconfirmed placement');
      await page.locator('.hand .hc.sel .cbtn').first().click();
      await page.click('[data-act="confirm"]');
      await page.waitForFunction(() => !document.querySelector('[data-act="confirm"]'));
      await page.click('#undoBtn');
      await page.waitForSelector('.hand .hc.sel');
      assert.deepEqual(await snapshot(page), afterDraw, 'Undo restores the placed receiver');
      await page.click('#undoBtn');
      await page.waitForSelector('#dockOpts [data-act="ack"]');
      assert.deepEqual(await snapshot(page), beforeDraw, 'multiple Undo steps can return to the start of the turn');
      for (let step = 0; step < 10 && await page.locator('#undoBtn').isEnabled(); step++) {
        assert.equal(await page.locator('#undoBtn').textContent(), 'Undo');
        await page.click('#undoBtn');
        await page.waitForFunction(() => !document.getElementById('dockQ').textContent.includes('正在撤回'));
      }
      assert.equal(await page.locator('#undoBtn').isEnabled(), false, 'cannot cross a prior opponent turn without a request');
      for (let step = 0; step < 20 && !await page.locator('#dockOpts [data-act="ack"]').count(); step++) await advance(page);
      assert.deepEqual(await snapshot(page), beforeDraw, 'redoing the defend choice must return to the same draw decision');

      await page.click('#dockOpts [data-act="ack"]');
      await page.waitForSelector('.hand .hc.sel');
      await page.click('[data-act="loss"]');
      await page.click('[data-act="lossyes"]');
      await page.waitForSelector('#turnTitle');
      assert.equal(await page.locator('#turnTitle').textContent(), '你 LOSS');
      await page.click('#turnNext');
      await page.waitForFunction(() => document.getElementById('turnTitle')?.textContent === 'AI 的發球回合');
      await page.getByRole('button', { name: '請求悔棋', exact: true }).click();
      await page.waitForSelector('#confirmUndo');
      const paused = await snapshot(page);
      await page.waitForTimeout(1200);
      assert.deepEqual(await snapshot(page), paused, 'AI must pause while a request is pending');
      await page.getByRole('button', { name: '繼續對戰', exact: true }).click();
      // Cancelling returns to the same paused announcement; explicitly continue it.
      for (let step = 0; step < 100; step++) {
        if (await page.locator('#turnScreen:visible').count()) await page.click('#turnNext');
        if (!await page.locator('#turnScreen:visible').count() && await page.locator('[data-act="loss"]').count()) break;
        await page.waitForTimeout(100);
      }
      await page.waitForSelector('[data-act="loss"]');
      const beforeSecondLoss = await snapshot(page);
      await page.click('[data-act="loss"]');
      await page.click('[data-act="lossyes"]');
      await page.waitForFunction(() => document.getElementById('turnTitle')?.textContent === '你 LOSS');
      await page.click('#turnNext');
      await page.waitForFunction(() => document.getElementById('turnTitle')?.textContent === 'AI 的發球回合');
      await page.getByRole('button', { name: '請求悔棋', exact: true }).click();
      await page.click('#confirmUndo');
      await page.waitForFunction(() => document.getElementById('undoBtn').textContent === 'Undo');
      assert.deepEqual(await snapshot(page), beforeSecondLoss, 'accepted request must restore the last own-turn decision');
      await page.waitForTimeout(1200);
      assert.deepEqual(await snapshot(page), beforeSecondLoss, 'old AI callbacks must not advance the restored game');
      assert.equal(await page.locator('#undoBtn').textContent(), 'Undo');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(errors, []);
      await page.click('#menuBtn');
      await page.click('#mRestart');
      await page.waitForSelector('#dockOpts [data-i]');
      assert.equal(await page.locator('#undoBtn').isEnabled(), false, 'restart must clear undo history');
      console.log('undo UI passed:', width, height, 'draw/redo, placement, repeated Undo, AI pause/cancel/consent, stale callbacks, restart');
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
