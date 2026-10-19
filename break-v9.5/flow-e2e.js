const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('./engine');
async function recordedGame() {
  const trace = [];
  const human = { wantsAck: true, async choose(g, p, req) {
    const value = req.kind === 'mulligan' ? [] : req.kind === 'guts' ? req.options.slice(0, req.need).map(x => x.value) : await E.AI.choose(g, p, req);
    trace.push({ req: JSON.parse(JSON.stringify(req)), value }); return value;
  } };
  const g = new E.Game({ seed: 7, decks: ['k1014', 'seijoh'], agents: [human, E.AI], onNotice(data) { trace.push({ notice: data }); } });
  const winner = await g.run();
  return { trace, winner: winner.idx };
}
const snapshot = page => page.evaluate(() => ({
  board: document.getElementById('game').textContent,
  cards: [...document.querySelectorAll('#meSide .hand [data-card]')].map(n => n.dataset.card),
  log: document.getElementById('logSide').textContent,
  title: document.getElementById('turnTitle')?.textContent
}));
(async () => {
  const { trace, winner } = await recordedGame();
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || undefined });
  try {
    for (const [width, height] of [[1280, 900], [390, 844], [320, 568]]) {
      const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 700, hasTouch: width < 700 });
      page.setDefaultTimeout(10000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.setContent(fs.readFileSync('index.html', 'utf8'), { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => { Date.now = () => 7; });
      await page.selectOption('#myDeck', 'k1014'); await page.selectOption('#aiDeck', 'seijoh');
      await page.selectOption('#speed', '200'); await page.click('#startBtn');
      const seen = new Set();
      for (const { req, value, notice } of trace) {
        if (notice || req.kind === 'lossConfirm') {
          const expected = req ? '你接不起這球' : notice.type === 'serve' ? (notice.player === 0 ? '你的發球回合' : 'AI 的發球回合') : notice.type === 'turn' ? (notice.player === 0 ? '輪到你了' : '輪到 AI 了') : (notice.player === 0 ? '你 LOSS' : 'AI LOSS');
          await page.waitForFunction(title => !document.getElementById('turnScreen').hidden && document.getElementById('turnTitle').textContent === title, expected);
          const geometry = await page.locator('#turnScreen').evaluate(screen => {
            const r = screen.getBoundingClientRect();
            return { x: r.x, y: r.y, w: r.width, h: r.height, vw: innerWidth, vh: innerHeight, focus: screen.contains(document.activeElement), inert: document.getElementById('dock').inert && document.querySelector('.wrap').inert };
          });
          assert.equal(geometry.x, 0); assert.equal(geometry.y, 0);
          assert.equal(geometry.w, geometry.vw); assert.equal(geometry.h, geometry.vh);
          assert(geometry.focus && geometry.inert, 'announcement must own focus and block background interactions');
          const before = await snapshot(page);
          await page.waitForTimeout(260);
          assert.deepEqual(await snapshot(page), before, 'nothing may advance until explicit confirmation');
          let kind = 'manual-loss';
          if (notice) {
            kind = notice.type + '-' + notice.player;
            if (notice.type === 'turn') {
              assert.equal(await page.locator('.turn-ball strong').textContent(), String(notice.ball.off));
              if (notice.ball.type === 'attack') assert((await page.locator('.turn-ball').textContent()).includes(`舉球 ${notice.toss} ＋ 攻擊 ${notice.attack} ＝ ${notice.ball.off}`));
              seen.add('ball-' + notice.ball.type + (notice.ball.off === 0 ? '-zero' : ''));
            }
            if (notice.type === 'loss') assert((await page.locator('.turn-ball').textContent()).includes(notice.final ? '贏了這場對戰' : `下一球：${notice.winner === 0 ? '你' : 'AI'}發球`));
          } else {
            assert.equal(await page.locator('#turnNext').textContent(), '喊 Loss');
            assert((await page.locator('#turnDetail').textContent()).includes(req.reason));
            // Undo while a failed receive is awaiting confirmation must restore the preceding decision.
            if (!seen.has('loss-undo')) {
              await page.click('#turnUndo');
              await page.waitForSelector('#turnScreen[hidden]', { state: 'attached' });
              assert(!await page.locator('#turnScreen:visible').count());
              assert.match(await page.locator('#dockQ').textContent(), /選擇接球角色/);
              if (await page.locator('#dockOpts [data-act="confirm"]').count()) throw new Error('Undo should restore an unstaged decision');
              // Reapply the prior recorded choice, bringing us back to the identical failed receive.
              const prior = trace[trace.findIndex(entry => entry.req === req) - 1];
              assert(prior.req && prior.req.kind === 'receiver', 'fixture must fail directly after a receiver choice');
              await page.locator(`.hand .hc.sel .cbtn[data-card="${prior.value}"]`).first().click();
              await page.click('[data-act="confirm"]');
              await page.waitForFunction(() => document.getElementById('turnTitle')?.textContent === '你接不起這球' && !document.getElementById('turnScreen').hidden);
              assert.deepEqual(await snapshot(page), before, 'redoing the receiver must restore the same failed state');
              assert(await page.locator('#turnUndo').isEnabled(), 'Undo must remain available after redoing the failed receiver');
              seen.add('loss-undo');
            }
          }
          if (width === 390 && !seen.has(kind)) await page.screenshot({ path: path.join(process.env.E2E_OUTPUT_DIR || '.', `flow-${kind}-mobile.png`) });
          seen.add(kind);
          await page.click('#turnNext');
          continue;
        }
        if (req.kind === 'roll') { await page.click('#dockOpts [data-i="0"]'); continue; }
        try {
          await page.waitForFunction(({ kind, prompt }) => document.getElementById('turnScreen').hidden && (kind === 'block' ? !!document.querySelector('[data-act="blk"]') : document.getElementById('dockQ').textContent.includes(prompt)), req);
        } catch (error) {
          throw new Error(`Expected ${req.kind}: ${req.prompt}; current: ${await page.locator('#dockQ').textContent()}; screen: ${await page.locator('#turnTitle').textContent()}; ${error.message}`);
        }
        if (req.kind === 'mulligan') { await page.click('[data-act="multi"]'); continue; }
        if (req.kind === 'ack') { await page.click('#dockOpts [data-act="ack"]'); continue; }
        if (req.kind === 'guts') { await page.click('[data-act="gutsbottom"]'); continue; }
        if (req.kind === 'block') { await page.click(`[data-rec="${value}"]`); await page.click('[data-act="blk"]'); continue; }
        const i = req.options.findIndex(o => JSON.stringify(o.value) === JSON.stringify(value));
        assert(i >= 0);
        const option = req.options[i], card = option.card && page.locator(`.hand .hc.sel .cbtn[data-card="${option.card}"]`).first();
        if (card && await card.count()) { await card.click(); await page.click('[data-act="confirm"]'); }
        else { await page.click(`#dockOpts [data-i="${i}"]`); if (option.card) await page.click('[data-act="confirm"]'); }
      }
      await page.waitForSelector('[data-act="again"]');
      assert.equal(await page.locator('#dockQ').textContent(), winner === 0 ? '你贏了！' : 'AI 贏了');
      for (const kind of ['serve-0', 'serve-1', 'turn-0', 'turn-1', 'loss-0', 'loss-1', 'manual-loss', 'loss-undo', 'ball-attack', 'ball-serve', 'ball-block-zero']) assert(seen.has(kind), 'must exercise ' + kind);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(errors, []);
      console.log(`flow UI passed: ${width}×${height}, full match, paused serve/turn/loss screens, final ball values, manual Loss and Undo`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
