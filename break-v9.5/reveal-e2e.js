const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || undefined });
  try {
    for (const [width, height] of [[1280, 900], [390, 844], [320, 568]]) {
      for (const scenario of ['take', 'decline', 'miss', 'blocked', 'empty', 'opponent']) {
        const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 700, hasTouch: width < 700 });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.setContent(fs.readFileSync('index.html', 'utf8'), { waitUntil: 'domcontentloaded' });
        await page.evaluate(scenario => {
          const E = window.BreakEngine;
          E.Game = class extends E.Game {
            async run() {
              window.revealFixture = this;
              const p = this.players[scenario === 'opponent' ? 1 : 0];
              this.beginTurn(p); this.rallyNo = 1; this.server = p.idx;
              p.deck = scenario === 'empty' ? [] : ['D01-012', scenario === 'miss' ? 'D01-005' : 'P01-002'];
              p.hand = []; p.restrict.no_add = scenario === 'blocked';
              await this.revealTop(p, '影山', c => c === 'P01-002');
              await this.confirmTurnEnd(p, { type: 'attack', off: 4 });
              this.winner = p; return p;
            }
          };
        }, scenario);
        await page.click('#startBtn');
        if (scenario === 'opponent') {
          await page.waitForSelector('#turnScreen:visible');
          assert.equal(await page.locator('#turnTitle').textContent(), 'AI的翻牌結果');
          assert.equal(await page.locator('.reveal-public img').count(), 1);
          assert.match(await page.locator('#turnCard').textContent(), /P01-002/);
          await page.waitForTimeout(150);
          assert.equal(await page.evaluate(() => revealFixture.players[1].hand.length), 0);
          await page.click('#turnNext');
          await page.waitForSelector('[data-act="again"]');
          assert.deepEqual(await page.evaluate(() => revealFixture.players[1].hand), ['P01-002']);
        } else {
          if (scenario !== 'empty') {
            await page.waitForSelector('#flipTop');
            assert.equal(await page.locator('#revealResult').count(), 0);
            assert(!(await page.locator('#logSide').textContent()).includes('翻開：'));
            await page.waitForTimeout(150);
            assert.equal(await page.locator('#flipTop').count(), 1, 'never auto-flip');
            if (width === 390 && scenario === 'miss') await page.screenshot({ path: path.join(process.env.E2E_OUTPUT_DIR || '.', 'reveal-before-mobile.png') });
            await page.click('#flipTop');
          }
          await page.waitForSelector('#revealResult');
          const top = scenario === 'empty' ? null : scenario === 'miss' ? 'D01-005' : 'P01-002';
          const result = page.locator('#revealResult');
          if (top) {
            assert.equal(await result.locator(`button[data-card="${top}"] img`).count(), 1);
            await result.locator('img').scrollIntoViewIfNeeded();
            const b = await result.locator('img').boundingBox();
            const dock = await page.locator('#dock').boundingBox();
            assert(b.height >= 120 && b.y >= dock.y && b.y + b.height <= height, 'revealed card must be readable and visible');
            await result.locator('button[data-card]').click();
            await page.waitForSelector('#sheet:visible');
            assert.match(await page.locator('#sheetBox').textContent(), new RegExp(top));
            await page.click('#sheetBox [data-close]');
          }
          if (scenario === 'miss') assert.match(await result.textContent(), /沒有符合條件.*已放回牌庫底/);
          if (scenario === 'blocked') assert.match(await result.textContent(), /禁止加入.*已放回牌庫底/);
          if (scenario === 'empty') assert.match(await result.textContent(), /牌庫已空/);
          if (scenario === 'take') {
            await page.click('#undoBtn'); await page.waitForSelector('#flipTop');
            assert.equal(await page.locator('#revealResult').count(), 0);
            assert(!(await page.locator('#logSide').textContent()).includes('翻開：'));
            await page.click('#flipTop'); await page.waitForSelector('#revealResult');
            assert.match(await page.locator('#revealResult').textContent(), /P01-002/);
          }
          if (width === 390 && ['miss', 'take'].includes(scenario)) await page.screenshot({ path: path.join(process.env.E2E_OUTPUT_DIR || '.', `reveal-${scenario}-mobile.png`) });
          const option = scenario === 'decline' ? 1 : 0;
          await page.click(`#dockOpts [data-i="${option}"]`);
          await page.waitForSelector('#endTurn');
          const actual = await page.evaluate(() => ({ deck: revealFixture.players[0].deck, hand: revealFixture.players[0].hand }));
          assert.deepEqual(actual, { deck: !top ? [] : scenario === 'take' ? ['D01-012'] : [top, 'D01-012'], hand: scenario === 'take' ? [top] : [] });
        }
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.deepEqual(errors, []); await page.close();
      }
      console.log(`reveal UI: ${width}×${height}: flip, visible card/detail, take/decline/miss/blocked/empty, Undo and opponent pause passed`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
