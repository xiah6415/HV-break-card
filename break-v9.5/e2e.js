const { chromium } = require('/opt/npm-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  for (const [w, h, scheme, name, mobile] of [[1280, 900, 'light', 'desk', false], [375, 760, 'dark', 'phone', true]]) {
    const pg = await b.newPage({ viewport: { width: w, height: h }, colorScheme: scheme, isMobile: mobile, hasTouch: mobile });
    const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type() === 'error' && !/ERR_TUNNEL|fonts|net::/.test(m.text()) && errs.push(m.text()));
    const html = require('fs').readFileSync('index.html', 'utf8');
    await pg.setContent('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + html + '</body></html>', { waitUntil: 'domcontentloaded' });
    await pg.selectOption('#speed', '200');
    await pg.click('#startBtn');
    const seen = {}; let maxSW = 0, drags = 0, games = 0, clicks = 0;
    const jsClick = sel => pg.evaluate(s => document.querySelector(s).click(), sel);
    for (; clicks < 900 && games < 3; clicks++) {
      maxSW = Math.max(maxSW, await pg.evaluate(() => document.documentElement.scrollWidth));
      if (await pg.$('[data-act="again"]')) { games++; if (games < 3) await jsClick('[data-act="again"]'); continue; }
      if (await pg.$('#sheet:not([hidden])')) await pg.evaluate(() => document.getElementById('sheet').hidden = true);
      const q = await pg.evaluate(() => document.getElementById('dockQ').textContent.slice(0, 40));
      seen['q:' + q.slice(0, 6)] = 1;
      if (await pg.$('[data-act="multi"]')) { seen.mull = 1; await jsClick('[data-act="multi"]'); continue; }
      if (await pg.$('[data-act="gutsok"]')) { seen.guts = 1; await pg.evaluate(() => { const n = +document.querySelector('#dockQ small').textContent.split('/')[1]; [...document.querySelectorAll('.gp')].slice(0, n).forEach(b => b.click()); }); await jsClick('[data-act="gutsok"]'); continue; }
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
    await pg.screenshot({ path: `v7_${name}_end.png` });
    console.log(name, 'clicks', clicks, 'games', games, 'maxSW', maxSW, 'seen', JSON.stringify(seen), 'errors', errs);
  }
  await b.close();
})();
