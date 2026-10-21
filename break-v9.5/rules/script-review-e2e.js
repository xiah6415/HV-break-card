'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),path=require('node:path');
const {fixture}=require('./batch-smoke'),catalog=require('./data/cards.json'),c=catalog.cards.find(c=>c.card_no==='HV-P01-091');
const before=fixture(c,c.profiles[0],'receive',{rich:true,max:true,conditioned:true,expanded:true,key:'positive'},0,catalog).k.snapshot();
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE});
 try{for(const width of [1280,390,320]){
  const page=await browser.newPage({viewport:{width,height:844},isMobile:width<700,hasTouch:width<700}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve('index.html')).href);await page.selectOption('#gameMode','strict');
  await page.evaluate(before=>{const E=window.BreakEngine;E.Game=class extends E.Game{async run(){window.reviewGame=this;const short=n=>n.replace(/^HV-/,'');for(const q of this.players){for(const [host,z]of Object.entries({hand:'hand',deck:'deck',drop:'drop',ev:'event',sets:'sets'}))q[host]=before.zones[q.idx+'.'+z].map(id=>short(before.cards[id].cardNo));for(const z of ['serve','block','receive','toss','attack'])q.area[z]=before.zones[q.idx+'.'+z].map(id=>short(before.cards[id].cardNo));}this.cardState=null;this.beginTurn(this.players[0]);this.rallyNo=1;this.server=1;this.ball={type:'serve',off:7};this.rulePhase='rcv';await this.resolve(this.players[0],'P01-091','rcv');window.reviewDone=true;await this.confirmTurnEnd(this.players[0],{type:'attack',off:4});this.winner=this.players[0];return this.winner;}};},before);
  await page.click('#startBtn');await page.waitForFunction(()=>document.querySelector('#dockQ').textContent.includes('選擇場上'));
  await page.locator('#dockOpts [data-i]').first().click();await page.waitForFunction(()=>document.querySelector('#dockQ').textContent.includes('來球不是攻擊'));
  assert.match(await page.locator('#dockQ').textContent(),/無效.*支付費用/);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#dockOpts [data-i]').filter({hasText:'不追加'}).click();await page.waitForFunction(()=>window.reviewDone);
  assert.equal(await page.evaluate(()=>reviewGame.ball.off),7);assert.equal(await page.evaluate(()=>reviewGame.players[0].area.block.length),before.zones['0.block'].length);assert.deepEqual(errors,[]);
  console.log('review UI '+width+'px: non-attack warning / decline preserves blocker / no overflow passed');await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
