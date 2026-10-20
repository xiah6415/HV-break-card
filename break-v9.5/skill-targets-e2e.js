const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || undefined });
  try {
    for (const [width, height] of [[1280, 900], [390, 844], [320, 568]]) {
      const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 700, hasTouch: width < 700 });
      page.setDefaultTimeout(10000); const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.setContent(fs.readFileSync('index.html', 'utf8'), { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
        const E = window.BreakEngine;
        E.Game = class extends E.Game {
          async run() {
            window.skillGame = this; const p = this.players[0]; this.beginTurn(p); this.rallyNo = 1; this.server = 0;
            p.hand = ['PR-057', 'P03-096', 'P03-087']; p.deck = ['D01-012', 'P01-074'];
            p.area.toss = ['P01-004', 'P01-002', 'P01-004', 'P01-006'];
            p.area.attack = ['P01-004', 'P01-002', 'PR-043', 'P01-003', 'D01-009'];
            p.ts.setter = 'P01-006'; p.ts.toss = 1;
            await this.enterCharacter(p, 'receive', 'PR-057'); p.ts.receiver = 'PR-057'; p.ts.rcv = 5;
            await this.resolve(p, 'P03-096', 'rcv'); await this.resolve(p, 'P03-087', 'rcv');
            await this.confirmTurnEnd(p, { type: 'attack', off: 4 }); this.finishTurn(p); this.winner = p; return p;
          }
        };
      });
      await page.click('#startBtn');
      await page.waitForFunction(() => document.getElementById('dockQ').textContent.includes('選擇登場名稱'));
      assert.equal(await page.locator('#dockOpts [data-i]').count(), 2);
      if (width === 390) await page.screenshot({ path: path.join(process.env.E2E_OUTPUT_DIR || '.', 'skill-name-mobile.png') });
      await page.click('#dockOpts [data-i="1"]'); // Nishinoya does not qualify for Natsu.
      await page.waitForFunction(() => document.getElementById('dockQ').textContent.includes('周りの上手さ：選擇'));
      assert.equal(await page.evaluate(() => skillGame.players[0].ts.rcv), 5);
      assert.match(await page.locator('.court-name').textContent(), /西谷 夕/);
      await page.click('#undoBtn');
      await page.waitForFunction(() => document.getElementById('dockQ').textContent.includes('選擇登場名稱'));
      await page.click('#dockOpts [data-i="0"]');
      await page.waitForFunction(() => document.getElementById('dockQ').textContent.includes('日向 夏：選擇場上'));
      assert.match(await page.locator('.court-name').textContent(), /日向 翔陽/);
      assert.match(await page.locator('#dockOpts').textContent(), /接球區/);
      await page.click('#dockOpts [data-i="0"]');
      await page.waitForFunction(() => document.getElementById('dockQ').textContent.includes('選擇這位角色要增加的參數'));
      assert.equal(await page.locator('#dockOpts [data-i]').count(), 3, 'PR-057 has receive/toss/attack; dash serve/block cannot be selected');
      if (width === 390) await page.screenshot({ path: path.join(process.env.E2E_OUTPUT_DIR || '.', 'skill-parameter-mobile.png') });
      await page.locator('#dockOpts [data-i]').filter({ hasText: '接球' }).click();
      await page.waitForFunction(() => document.getElementById('dockQ').textContent.includes('周りの上手さ：選擇'));
      await page.locator('#dockOpts [data-i]').filter({ hasText: '舉球區' }).click();
      await page.waitForFunction(() => document.getElementById('dockQ').textContent.includes('合計付 6 Guts'));
      await page.click('#dockOpts [data-i="0"]');
      await page.waitForSelector('.gpick');
      assert.equal(await page.locator('[data-gp]').count(), 7);
      assert.match(await page.locator('.gpick').textContent(), /舉球區/); assert.match(await page.locator('.gpick').textContent(), /攻擊區/);
      assert(!await page.locator('[data-act="gutsok"]').isEnabled());
      for (const i of [0, 2, 3, 4, 5, 6]) await page.click(`[data-gp="${i}"]`);
      assert(await page.locator('[data-act="gutsok"]').isEnabled());
      if (width === 390) await page.screenshot({ path: path.join(process.env.E2E_OUTPUT_DIR || '.', 'skill-six-guts-mobile.png') });
      await page.click('[data-act="gutsok"]');
      await page.waitForFunction(() => document.getElementById('dockQ').textContent.includes('要 +2 的數值'));
      assert.equal(await page.evaluate(() => skillGame.players[0].drop.length), 6);
      await page.click('#undoBtn'); await page.waitForSelector('.gpick');
      assert.equal(await page.evaluate(() => skillGame.players[0].drop.length), 0);
      for (const i of [0, 2, 3, 4, 5, 6]) await page.click(`[data-gp="${i}"]`);
      await page.click('[data-act="gutsok"]');
      await page.waitForFunction(() => document.getElementById('dockQ').textContent.includes('要 +2 的數值'));
      await page.locator('#dockOpts [data-i]').filter({ hasText: '舉球 1 → 3' }).click();
      await page.waitForSelector('#endTurn');
      const state = await page.evaluate(() => { const p = skillGame.players[0]; return { rcv: p.ts.rcv, toss: p.ts.toss, top: [p.top('toss'), p.top('attack')], guts: skillGame.courtGuts(p).length, drop: p.drop.length }; });
      assert.deepEqual(state, { rcv: 6, toss: 3, top: ['P01-006', 'D01-009'], guts: 1, drop: 6 });
      assert.match(await page.locator('#meSide').textContent(), /舉球 \+2/);
      await page.click('#endTurn'); await page.waitForSelector('[data-act="again"]');
      assert.equal(await page.locator('.court-name').count(), 0);
      assert.deepEqual(await page.evaluate(() => skillGame.players[0].effects), {});
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); assert.deepEqual(errors, []);
      console.log(`skill target UI: ${width}×${height}: name/Undo, Hinata target, numeric parameter, 6 cross-area Guts/Undo, active values and expiry passed`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
