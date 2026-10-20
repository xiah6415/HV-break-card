'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE||undefined});
  try {
    for(const [width,height] of [[1280,900],[390,844],[320,568]]) {
      const page=await browser.newPage({viewport:{width,height},isMobile:width<700,hasTouch:width<700});
      page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.setContent(fs.readFileSync('index.html','utf8'),{waitUntil:'domcontentloaded'});
      await page.evaluate(()=>{
        const E=window.BreakEngine;E.Game=class extends E.Game {
          async run() {
            window.sharedGame=this;const p=this.players[0];this.beginTurn(p);this.rallyNo=1;this.server=0;
            p.hand=['P01-088','P04-089','P01-013','D04-003','D04-003'];p.deck=['D04-003','D04-003'];
            p.area.receive=['P04-026'];p.area.attack=['P01-004'];p.ts.receiver='P04-026';p.ts.rcv=5;
            await this.resolve(p,'P01-088','rcv');await this.resolve(p,'P04-089','rcv');await this.resolve(p,'P01-013','rcv');
            await this.confirmTurnEnd(p,{type:'attack',off:4});this.finishTurn(p);this.winner=p;return p;
          }
        };
      });
      await page.click('#startBtn');
      const wait=text=>page.waitForFunction(t=>document.getElementById('dockQ').textContent.includes(t),text);
      const click=text=>page.locator('#dockOpts [data-i]').filter({hasText:text}).click();
      await wait('選擇抽牌數量');await click('不抽牌');await wait('選擇場上');
      assert.equal(await page.evaluate(()=>sharedGame.players[0].deck.length),2);
      await page.click('#undoBtn');await wait('選擇抽牌數量');await click('不抽牌');await wait('選擇場上');await click('接球區');
      await wait('3年間ありがとう!!!：選擇場上');
      assert.equal(await page.evaluate(()=>sharedGame.players[0].deck.length),1,'draw already visible before target');
      await click('接球區');await wait('是否支付棄牌費用');await click('棄 1 張');await wait('選擇 1 張符合條件的手牌');
      assert.equal(await page.evaluate(()=>sharedGame.players[0].ts.rcv),7);
      assert.equal(await page.locator('#dockOpts [data-i]').count(),3,'duplicate physical cards have distinct options');
      if(width===390&&process.env.E2E_OUTPUT_DIR)await page.screenshot({path:path.join(process.env.E2E_OUTPUT_DIR,'shared-payment-mobile.png')});
      await page.locator('#dockOpts [data-i]').last().click();await wait('縁下 力：選擇場上');
      assert.equal(await page.evaluate(()=>sharedGame.players[0].drop.length),2,'payment and formal cost each moved once');
      await page.click('#undoBtn');await wait('選擇 1 張符合條件的手牌');
      assert.equal(await page.evaluate(()=>sharedGame.players[0].drop.length),0);
      await page.locator('#dockOpts [data-i]').last().click();await wait('縁下 力：選擇場上');await click('攻擊區');await page.waitForSelector('#endTurn');
      const state=await page.evaluate(()=>{const p=sharedGame.players[0];return {rcv:p.ts.rcv,attackReceive:sharedGame.parameter(p,'attack','rcv'),drop:p.drop.length,deck:p.deck.length,ev:p.ev};});
      assert.deepEqual(state,{rcv:9,attackReceive:7,drop:2,deck:1,ev:['P01-088','P04-089']});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
      assert.deepEqual(errors,[]);await page.click('#endTurn');await page.waitForSelector('[data-act="again"]');await page.close();
      console.log('shared settlement UI passed',width,height);
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
