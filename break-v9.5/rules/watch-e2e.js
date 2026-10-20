'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE||undefined});
  try {for(const [width,height] of [[1280,900],[390,844],[320,568]]){
    const page=await browser.newPage({viewport:{width,height},isMobile:width<700,hasTouch:width<700});page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.setContent(fs.readFileSync('index.html','utf8'),{waitUntil:'domcontentloaded'});await page.selectOption('#gameMode','strict');
    await page.evaluate(()=>{
      const E=window.BreakEngine,choose=E.AI.choose;E.AI.choose=async function(g,p,r){if(r.kind==='rulesChoice')return (r.options.find(o=>o.card&&o.card!=='P01-087')||r.options[0]).value;return choose.call(this,g,p,r);};
      E.Game=class extends E.Game {async run(){window.watchGame=this;for(const q of this.players){q.hand=[];q.deck=[];q.drop=[];q.ev=[];q.sets=[];for(const a in q.area)q.area[a]=[];}
        const [p,o]=this.players;this.beginTurn(p);this.rallyNo=1;this.server=0;
        p.hand=['P01-087','P01-087','PR-029','D01-009','P01-004'];p.deck=['D04-003','D04-003'];p.drop=['P01-002','P01-006'];p.area.serve=['P01-033'];p.area.toss=['D04-003'];
        o.hand=['PR-029','P01-087','D01-009','P01-004'];o.deck=['D04-003'];o.drop=['P01-002','P01-006'];o.area.serve=['P01-033'];o.area.toss=['D04-003'];
        await this.resolve(p,'P01-087','tos');await this.resolve(p,'P01-087','tos');this.beginTurn(o);await this.resolve(o,'PR-029','drw');
        await this.resolve(o,'P01-087','tos');this.beginTurn(p);await this.resolve(p,'PR-029','drw');await this.confirmTurnEnd(p,{type:'attack',off:3});this.finishTurn(p);this.winner=p;return p;
      }};
    });
    const wait=text=>page.waitForFunction(t=>document.getElementById('dockQ').textContent.includes(t),text);
    await page.click('#startBtn');await wait('選擇場上');await page.locator('#dockOpts [data-i]').filter({hasText:'舉球區'}).click();await page.waitForFunction(()=>watchGame.players[0].ev.length===2);await wait('選擇場上');await page.locator('#dockOpts [data-i]').filter({hasText:'發球區'}).click();
    for(const count of [4,3,2]){
      await wait('選擇同時觸發');await page.waitForFunction(n=>document.querySelectorAll('#dockOpts [data-i]').length===n,count);
      assert.equal(await page.evaluate(()=>watchGame.turnP.idx),1,'controller chooses order during opponent turn');
      assert.equal(await page.locator('[data-act="loss"]').count(),0); // Loss belongs to the current turn player, not the watcher owner.
      await page.locator('#dockOpts [data-i]').last().click();
    }
    // The legacy retrieval UI stages a public card before confirmation.
    for(let i=0;i<2;i++){await wait('最多選 1 張回手');await page.locator('#dockOpts [data-i]').first().click();await page.locator('[data-act="confirm"]').click();}
    await wait('非抽牌加入手牌後');assert.equal(await page.evaluate(()=>watchGame.players[0].hand.length),6,'both additions completed before the discard');
    if(width<700){
      await page.locator('#dockOpts [data-act="loss"]').scrollIntoViewIfNeeded();assert(await page.locator('#dockOpts [data-act="loss"]').isVisible());
      await page.locator('#dockOpts [data-i]').last().scrollIntoViewIfNeeded();assert(await page.locator('#dockOpts [data-i]').last().isVisible());
      await page.locator('.hand .hc').last().scrollIntoViewIfNeeded();
      const geometry=await page.evaluate(()=>({hand:document.querySelector('.hand').getBoundingClientRect().bottom,dock:document.getElementById('dock').getBoundingClientRect().top,height:document.getElementById('dock').getBoundingClientRect().height}));
      assert(geometry.hand<=geometry.dock,'hand remains scrollable above the panel');assert(geometry.height<=height*.46+1,'panel height cap preserved');
      await page.locator('#dockOpts [data-i]').first().scrollIntoViewIfNeeded();
    }
    const journal=await page.evaluate(()=>JSON.stringify(watchGame.sharedRulesPending));
    await page.click('#undoBtn');await wait('最多選 1 張回手');assert.equal(await page.evaluate(()=>watchGame.sharedRulesEvents.length),1);
    await page.locator('#dockOpts [data-i]').first().click();await page.locator('[data-act="confirm"]').click();await wait('非抽牌加入手牌後');assert.equal(await page.evaluate(()=>JSON.stringify(watchGame.sharedRulesPending)),journal);
    const id=await page.evaluate(()=>watchGame.sharedRulesPending.request.options[0]);
    if(width===390&&process.env.E2E_OUTPUT_DIR)await page.screenshot({path:path.join(process.env.E2E_OUTPUT_DIR,'watch-discard-mobile.png')});
    await page.locator('#dockOpts [data-i]').first().click();await wait('非抽牌加入手牌後');await page.waitForFunction(()=>watchGame.players[0].hand.length===5);
    await page.click('#undoBtn');await page.waitForFunction(()=>watchGame.players[0].hand.length===6);assert(await page.evaluate(id=>watchGame.cardState.zones['0.hand'].includes(id),id));
    await page.locator('#dockOpts [data-i]').first().click();await page.waitForFunction(()=>watchGame.players[0].hand.length===5);await page.locator('#dockOpts [data-i]').first().click();await page.waitForSelector('#endTurn');
    assert.equal(await page.evaluate(()=>watchGame.players[0].hand.length),4);assert.equal(await page.evaluate(()=>Object.keys(watchGame.cardSnapshot().cards).length),20);assert.equal(await page.evaluate(()=>watchGame.sharedRulesPending),null);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);await page.click('#endTurn');await page.waitForSelector('[data-act="again"]');await page.close();console.log('watch UI passed',width,height);
  }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
