const { chromium } = require('/opt/npm-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 390, height: 844 }, colorScheme: 'light', deviceScaleFactor: 1 });
  const html = require('fs').readFileSync('index.html', 'utf8');
  await pg.setContent('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + html + '</body></html>', { waitUntil: 'domcontentloaded' });
  await pg.selectOption('#speed', '200'); await pg.click('#startBtn');
  for (let i = 0; i < 40; i++) {
    if (await pg.$('[data-act="again"]')) break;
    const m = await pg.$('[data-act="multi"]'); if (m) { await m.click(); continue; }
    const o = await pg.$('#dockOpts button[data-i]'); if (o) await o.click(); else await pg.waitForTimeout(250);
    if (i === 14) break;
  }
  await pg.waitForTimeout(400);
  await pg.screenshot({ path: 'v5_phone.png' });
  await b.close();
})();
