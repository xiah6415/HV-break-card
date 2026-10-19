const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || undefined });
  for (const [w, h, scheme, name, mobile] of [[1280, 900, 'light', 'desk', false], [375, 760, 'dark', 'phone', true], [320, 568, 'light', 'small-phone', true]]) {
    const pg = await b.newPage({ viewport: { width: w, height: h }, colorScheme: scheme, isMobile: mobile, hasTouch: mobile });
    const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type() === 'error' && !/ERR_TUNNEL|fonts|net::/.test(m.text()) && errs.push(m.text()));
    const html = require('fs').readFileSync('index.html', 'utf8');
    await pg.setContent(html, { waitUntil: 'domcontentloaded' });
    await pg.selectOption('#speed', '200');
    await pg.click('#startBtn');
    if (mobile) {
      await pg.click('#dockOpts [data-i="0"]');
      await pg.waitForSelector('[data-act="multi"]');
      await pg.locator('.hand .hc').last().scrollIntoViewIfNeeded();
      const geometry = await pg.evaluate(() => {
        const dock = document.getElementById('dock').getBoundingClientRect();
        const hand = document.querySelector('.hand').getBoundingClientRect();
        return { dockHeight: dock.height, dockTop: dock.top, handBottom: hand.bottom };
      });
      assert(geometry.dockHeight <= h * .46 + 1, name + ': expanded panel too tall');
      assert(geometry.handBottom <= geometry.dockTop, name + ': hand obscured');
      await pg.click('#dockToggle');
      assert.equal(await pg.getAttribute('#dockToggle', 'aria-expanded'), 'false');
      assert.equal(await pg.isVisible('#dockOpts'), false);
      await pg.click('.hand .hc .cbtn >> nth=0');
      assert.equal(await pg.getAttribute('#dockToggle', 'aria-expanded'), 'false');
      await pg.click('#dockToggle');
      assert.match(await pg.textContent('#dockQ'), /已選 1 張放回/);
      await pg.click('.hand .hc .cbtn >> nth=0');
    }
    const seen = {}; let maxSW = 0, drags = 0, games = 0, clicks = 0;
    const jsClick = sel => pg.evaluate(s => document.querySelector(s).click(), sel);
    for (; clicks < 900 && games < 3; clicks++) {
      maxSW = Math.max(maxSW, await pg.evaluate(() => document.documentElement.scrollWidth));
      if (await pg.$('#turnScreen:not([hidden])')) { seen.transition = 1; await pg.click('#turnNext'); continue; }
      if (await pg.$('[data-act="again"]')) { games++; if (games < 3) await jsClick('[data-act="again"]'); continue; }
      if (await pg.$('#sheet:not([hidden])')) await pg.evaluate(() => document.getElementById('sheet').hidden = true);
      const q = await pg.evaluate(() => document.getElementById('dockQ').textContent.slice(0, 40));
      seen['q:' + q.slice(0, 6)] = 1;
      if (await pg.$('[data-act="multi"]')) { seen.mull = 1; await jsClick('[data-act="multi"]'); continue; }
      if (await pg.$('[data-act="gutsok"]')) {
        seen.guts = 1;
        const n = +(await pg.locator('#dockQ small').first().textContent()).split('/')[1];
        while (await pg.locator('.gp.on').count() < n) await pg.locator('.gp:not(.on)').first().click();
        await pg.locator('[data-act="gutsok"]').click(); continue;
      }
      if (/擲骰|你先發球|AI 先發球/.test(q)) seen.roll = 1;
      if (/保留後的手牌/.test(q)) seen.mullhint = 1;
      if (games === 1 && !seen.loss && await pg.$('[data-act="loss"]')) { await jsClick('[data-act="loss"]'); await jsClick('[data-act="lossyes"]'); seen.loss = 1; continue; }
      if (await pg.$('#dockOpts [data-act="ack"]')) { seen.ack = 1; await jsClick('#dockOpts [data-act="ack"]'); continue; }
      if (await pg.$('[data-act="confirm"]')) { seen.confirm = 1; await jsClick('[data-act="confirm"]'); continue; }
      if (await pg.$('[data-act="blk"]')) {
        seen.block = 1;
        if (await pg.$('[data-act="blk"][disabled]')) { if (await pg.$('[data-rec]')) await jsClick('[data-rec]'); else { const c = await pg.$('.hand .hc.sel .cbtn'); if (c) await c.evaluate(e => e.click()); } }
        else await jsClick('[data-act="blk"]');
        continue;
      }
      if (/攔網還是接球/.test(q)) { seen.defend = 1; await jsClick(clicks % 3 ? '#dockOpts [data-i="0"]' : '#dockOpts [data-i="1"]'); continue; }
      const sel = await pg.$('.hand .hc.sel .cbtn');
      if (sel && !(/要使用卡片/.test(q) && clicks % 2)) {
        if (!mobile && drags < 6) {
          const tgt = await pg.$('#meSide .slot.tgt, #meSide .aux.tgt');
          if (tgt) { await sel.evaluate(e => e.scrollIntoView({ block: 'center' })); const s = await sel.boundingBox(), t = await tgt.boundingBox(); await pg.mouse.move(s.x + s.width / 2, s.y + s.height / 2); await pg.mouse.down(); await pg.mouse.move(s.x + 20, s.y - 20, { steps: 3 }); await pg.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 6 }); await pg.mouse.up(); drags++; if (await pg.$('[data-act="confirm"]')) seen.dragstage = 1; continue; }
        }
        await sel.evaluate(e => e.click()); continue;
      }
      const opt = await pg.$('#dockOpts button[data-i]');
      if (opt) { await opt.evaluate(e => e.click()); continue; }
      await pg.waitForTimeout(150);
    }
    await pg.screenshot({ path: path.join(process.env.E2E_OUTPUT_DIR || '.', `e2e_${name}_end.png`) });
    console.log(name, 'clicks', clicks, 'games', games, 'maxSW', maxSW, 'seen', JSON.stringify(seen), 'errors', errs);
    assert.equal(errs.length, 0, name + ': browser errors');
    assert.equal(games, 3, name + ': did not finish three games');
    assert(maxSW <= w, name + ': horizontal overflow');
    await pg.close();
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
