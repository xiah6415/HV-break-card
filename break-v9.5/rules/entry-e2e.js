'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE||undefined});
  try{for(const [width,height] of [[1280,900],[390,844],[320,568]]){
    const page=await browser.newPage({viewport:{width,height},isMobile:width<700,hasTouch:width<700});page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.setContent(fs.readFileSync('index.html','utf8'),{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{const E=window.BreakEngine;E.Game=class extends E.Game{async run(){window.entryGame=this;const [p,o]=this.players;for(const q of this.players){q.hand=[];q.deck=[];q.drop=[];q.ev=[];q.sets=[];for(const a in q.area)q.area[a]=[];}
      this.rallyNo=1;this.server=1;this.beginTurn(o);o.hand=['P04-088'];o.area.attack=['D04-002'];o.ts.attacker='D04-002';o.ts.atk=7;o.deck=['D04-003'];p.hand=['P03-057','P03-057','D01-009','P01-011','P01-004'];
      await this.resolve(o,'P04-088','atk');this.beginTurn(p);this.ball={type:'attack',off:6};this.target=0;await this.receiveTurn(p);this.winner=p;return p;
    }};});
    const wait=text=>page.waitForFunction(t=>document.getElementById('dockQ').textContent.includes(t),text),first=()=>page.locator('#dockOpts [data-i]').first().click(),confirm=()=>page.locator('[data-act="confirm"]').click();
    await page.click('#startBtn');await wait('先抽 1 張');await page.click('[data-act="ack"]');
    for(let i=0;i<2;i++){await wait('抽牌階段：要使用卡片');await page.locator('.hand [data-card="P03-057"]').first().click();await confirm();}
    await wait('選擇接球角色');await page.locator('.hand [data-card="D01-009"]').click();assert.match(await page.locator('#dockQ').textContent(),/接 6/);await confirm();await wait('選擇同時觸發');
    const journal=await page.evaluate(()=>JSON.stringify(entryGame.sharedRulesPending));assert.equal(await page.locator('#dockOpts [data-i]').count(),2);assert(await page.locator('[data-act="loss"]').isVisible());
    await page.click('#undoBtn');await wait('選擇接球角色');assert.equal(await page.evaluate(()=>entryGame.sharedRulesState.effects.filter(e=>e.kind==='protect').length),0);await page.locator('.hand [data-card="D01-009"]').click();await confirm();await wait('選擇同時觸發');assert.equal(await page.evaluate(()=>JSON.stringify(entryGame.sharedRulesPending)),journal);
    if(width<700){await page.locator('.hand .hc').last().scrollIntoViewIfNeeded();const geometry=await page.evaluate(()=>({hand:document.querySelector('.hand').getBoundingClientRect().bottom,dock:document.getElementById('dock').getBoundingClientRect().top,height:document.getElementById('dock').getBoundingClientRect().height}));assert(geometry.hand<=geometry.dock);assert(geometry.height<=height*.46+1);await page.locator('#dockOpts [data-i]').last().scrollIntoViewIfNeeded();}
    if(width===390&&process.env.E2E_OUTPUT_DIR)await page.screenshot({path:path.join(process.env.E2E_OUTPUT_DIR,'entry-order-mobile.png')});
    await page.locator('#dockOpts [data-i]').last().click();await wait('選擇舉球角色');assert.equal(await page.evaluate(()=>entryGame.players[0].ts.rcv),6);assert.equal(await page.evaluate(()=>entryGame.sharedRulesState.effects.filter(e=>e.kind==='protect').length),2);assert.equal(await page.evaluate(()=>entryGame.playable(entryGame.players[0],'rcv').some(c=>c.card==='P03-057')),false);
    await page.locator('.hand [data-card="P01-011"]').click();await confirm();await wait('選擇同時觸發');await first();await wait('選擇攻擊角色');await page.locator('.hand [data-card="P01-004"]').click();await confirm();await page.waitForSelector('#endTurn');
    assert.equal(await page.evaluate(()=>entryGame.sharedRulesState.effects.filter(e=>e.kind==='protect').length),4);assert.equal(await page.evaluate(()=>Object.keys(entryGame.cardSnapshot().cards).length),8);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
    await page.click('#endTurn');await page.waitForSelector('[data-act="again"]');assert.equal(await page.evaluate(()=>entryGame.sharedRulesState.effects.length),0);await page.close();console.log('entry UI passed',width,height);
  }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
