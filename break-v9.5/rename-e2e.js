'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE||undefined});try{
 for(const [width,height]of [[1280,900],[390,844],[320,568]]){
  const page=await browser.newPage({viewport:{width,height},isMobile:width<500,hasTouch:width<500}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setContent(fs.readFileSync('index.html','utf8'),{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{window.BreakEngine.Game.prototype.run=async function(){window.testRenameGame=this;for(const p of this.players){p.hand=[];p.deck=[];p.drop=[];p.ev=[];p.sets=[];for(const z of Object.keys(p.area))p.area[z]=[];}const p=this.players[0];p.hand=['P01-072','P01-072'];this.cardState=null;this.beginTurn(p);this.rulePhase='blk';this.ball={type:'attack',off:0};return this.blockTurn(p,[]);};});
  await page.selectOption('#gameMode','strict');await page.click('#startBtn');await page.waitForSelector('[data-act="blk"]');
  await page.locator('#meSide .hand [data-hand="0"]').click();await page.locator('#meSide .hand [data-hand="1"]').click();assert.equal(await page.locator('.bchip').count(),2,'Both physical copies can be selected');assert.equal(await page.locator('.bchip.ctr').count(),1,'Exactly one center');
  await page.locator('[data-act="blk"]').click();await page.waitForFunction(()=>document.querySelector('#dockQ').textContent.includes('中攔登場名稱'));assert.equal(await page.locator('#dockOpts [data-i]').count(),2);await page.locator('#dockOpts [data-i="0"]').click();
  await page.waitForFunction(()=>document.querySelector('#dockQ').textContent.includes('側攔登場名稱'));assert.equal(await page.locator('#dockOpts [data-i]').count(),1);await page.locator('#dockOpts [data-i="0"]').click();
  await page.waitForFunction(()=>document.querySelector('#dockQ').textContent.includes('結束回合'));
  const result=await page.evaluate(()=>{const g=window.testRenameGame,p=g.players[0];return {center:g.cardName(p,'block'),drop:p.drop,hand:p.hand.length,overflow:document.documentElement.scrollWidth-innerWidth};});assert.equal(result.center,'日向 翔陽');assert.deepEqual(result.drop,['P01-072']);assert.equal(result.hand,0);assert(result.overflow<=1);assert.deepEqual(errors,[]);console.log('rename UI '+width+': two copies, one center, name choices, side cleanup and no overflow passed');await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
