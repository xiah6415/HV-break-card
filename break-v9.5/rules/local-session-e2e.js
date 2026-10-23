'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE||undefined});
 try{for(const [width,height]of [[1280,900],[390,844],[320,568]]){
  const page=await browser.newPage({viewport:{width,height},isMobile:width<500,hasTouch:width<500}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(pathToFileURL(path.resolve('pilot-match.html')).href+'?mode=numeric',{waitUntil:'load'});assert.equal(await page.inputValue('#mode'),'numeric');
  await page.evaluate(()=>{for(let i=0;i<200;i++){const r=pilot.request();if(r.kind==='turnEnd'&&r.actor===0)return;if(r.kind==='firstService')pilot.submit({kind:'answer',answer:BreakHostChoice.makeAnswer(r,r.actor===0?'serve':'receive')});else pilot.ai();}throw Error('Own turn not reached');});
  assert(await page.isVisible('#manual'));
  const before=await page.evaluate(()=>({value:pilot.match.view(0).players[0].court[0].parameters.serve,hand:pilot.match.view(0).players[0].hand.length,other:pilot.match.view(0).players[1].hand.count,rng:pilot.match.snapshot().rng,r:pilot.request()}));
  await page.click('#manualPlus');assert.equal(await page.evaluate(()=>pilot.match.view(0).players[0].court[0].parameters.serve),before.value+1);
  assert(await page.evaluate(r=>{try{pilot.match.dispatch(BreakHostChoice.makeAnswer(r,true));return false;}catch(e){return /STALE/.test(e.message);}},before.r));
  await page.click('#undo');assert.equal(await page.evaluate(()=>pilot.match.view(0).players[0].court[0].parameters.serve),before.value);assert.deepEqual(await page.evaluate(()=>pilot.match.snapshot().rng),before.rng);
  await page.click('#manualDraw');assert.equal(await page.evaluate(()=>pilot.match.view(0).players[0].hand.length),before.hand+1);await page.click('#undo');
  await page.click('#manualDiscard');assert.equal(await page.evaluate(()=>pilot.match.view(0).players[0].hand.length),before.hand-1);await page.click('#undo');
  await page.selectOption('#manualPlayer','1');await page.click('#manualDiscard');assert.equal(await page.evaluate(()=>pilot.request().kind),'discard');assert.equal(await page.evaluate(()=>pilot.match.view(0).request),null);assert(!(await page.isVisible('#manual')));
  const value=await page.evaluate(()=>pilot.request().options[0].value);await page.locator(`#choice [data-hc-v='${JSON.stringify(value)}']`).click();await page.locator('#choice [data-hc-act="go"]').click();assert.equal(await page.evaluate(()=>pilot.match.view(0).players[1].hand.count),before.other-1);await page.click('#undo');assert.equal(await page.evaluate(()=>pilot.match.view(0).players[1].hand.count),before.other);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await page.textContent('#error'),'');assert.deepEqual(errors,[]);
  // End the turn and adjust the incoming serve on the next player's screen.
  await page.locator('#choice [data-hc-act="go"]').click();await page.evaluate(()=>{for(let i=0;i<20;i++){const r=pilot.request();if(r.canManual&&r.actor===1)return;pilot.ai();}throw Error('Next turn not reached');});await page.selectOption('#manualTarget','ball');const ball=await page.evaluate(()=>pilot.match.view(1).ball.offense);await page.click('#manualMinus');assert.equal(await page.evaluate(()=>pilot.match.view(1).ball.offense),ball-1);assert(await page.isDisabled('#undo'));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));console.log('local UI '+width+': numeric adjustments/draw/discard, affected-player selection, own Undo, stale refusal, serve-ball adjustment and no overflow passed');await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
