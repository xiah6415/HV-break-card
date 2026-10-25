/* Formal table: native Match only; exercise real DOM controls at three sizes. */
'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE||undefined});
 try{for(const [width,height]of [[1280,900],[375,760],[320,568]]){
  const page=await browser.newPage({viewport:{width,height},isMobile:width<500,hasTouch:width<500}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent(fs.readFileSync('index.html','utf8'),{waitUntil:'domcontentloaded'});
  // A production game must never create the retired mutable Game or bridge.
  await page.evaluate(()=>{BreakEngine.Game=class{constructor(){throw Error('OLD_GAME_USED');}};if(window.BreakRulesLegacy)throw Error('OLD_BRIDGE_BUNDLED');const T=BreakMatchPilot.TableSession;BreakMatchPilot.TableSession=class extends T{constructor(o,c){super({...o,seed:7},c);window.tableTest=this;}};});
  await page.selectOption('#speed','200');await page.click('#startBtn');
  let games=0,steps=0,manual=false,undo=false,drag=false,mull=false,loss=false,draw=false;const kinds=new Set();
  const click=selector=>page.locator(selector).evaluate(e=>e.click());
  while(games<3&&steps++<1000){
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width);
   if(await page.isVisible('#turnScreen')){await click('#turnNext');continue;}
   if(await page.locator('[data-act="again"]').count()){games++;if(games===1){await click('[data-act="setup"]');await page.selectOption('#gameMode','strict');await click('#startBtn');}else if(games<3)await click('[data-act="again"]');continue;}
   const r=await page.evaluate(()=>tableTest.waiting);if(!r){await page.waitForTimeout(50);continue;}kinds.add(r.kind);
   if(r.canManual&&!manual){
    const before=await page.evaluate(()=>({r:tableTest.waiting,hand:tableTest.match.view(0).players[0].hand.length,rng:tableTest.match.snapshot().rng}));
    await click('#manualBtn');await click('#manualDraw');assert.equal(await page.evaluate(()=>tableTest.match.view(0).players[0].hand.length),before.hand+1);
    await click('#undoBtn');assert.equal(await page.evaluate(()=>tableTest.match.view(0).players[0].hand.length),before.hand);assert.deepEqual(await page.evaluate(()=>tableTest.match.snapshot().rng),before.rng);
    assert(await page.evaluate(r=>{try{tableTest.match.dispatch(BreakHostChoice.makeAnswer(r,true));return false;}catch(e){return /STALE/.test(e.message);}},before.r));manual=undo=true;continue;
   }
   if(games===1&&r.canLoss&&!loss){await click('[data-hc-act="loss"]');await click('[data-hc-act="lossyes"]');loss=true;continue;}
   if(r.kind==='ack'){assert(await page.locator('#meSide .pile2.tgt').isVisible());await page.locator('#meSide .pile2.tgt').click();draw=true;continue;}
   const value=await page.evaluate(r=>BreakHostChoice.aiAnswer(r).value,r);
   const select=async v=>{const buttons=page.locator('#dockOpts [data-hc-v]');const all=await buttons.evaluateAll(bs=>bs.map(b=>b.dataset.hcV));const i=all.indexOf(JSON.stringify(v));assert(i>=0,'option missing');await buttons.nth(i).evaluate(e=>e.click());};
   if(r.kind==='mulligan'&&!mull){
    const ref=r.options[0].value,index=await page.evaluate(id=>tableTest.match.view(0).players[0].hand.findIndex(c=>c.id===id),ref);
    await page.locator('#dockOpts [data-hc-v]').first().click();assert.equal(await page.locator('.hand .hc.picked').count(),1);
    await click('#dockOpts .hc-item:has(.hc-card.on) .hc-info');assert(await page.isVisible('#sheet'));await click('#sheet [data-close]');assert.equal(await page.locator('.hand .hc.picked').count(),1);assert.equal(await page.locator('.hc-card.on').count(),1);
    // 牌桌改版（Claude 2026-10-25）：無收合鈕；調度以置中卡片框呈現，整局不捲動
    assert.equal(await page.isVisible('#dockToggle'),false,'no collapse toggle');
    const geometry=await page.evaluate(()=>({mode:document.getElementById('dock').dataset.mode,dock:document.getElementById('dock').getBoundingClientRect().toJSON(),scroll:document.documentElement.scrollHeight>innerHeight+2}));
    assert.equal(geometry.mode,'modal','mulligan uses the centred card dialog');assert(geometry.dock.height<=height*.86+1,'dialog too tall');assert(!geometry.scroll,'table must not scroll');
    await page.locator('#dockOpts [data-hc-v]').first().click();mull=true;
   }
   if(['single','number'].includes(r.input.type)){
    if(!drag&&width===1280&&r.kind==='serve'){
     const index=await page.evaluate(id=>tableTest.match.view(0).players[0].hand.findIndex(c=>c.id===id),value),hand=page.locator(`.hand [data-hand="${index}"]`),target=page.locator('#meSide [data-drop="serve"]');await hand.scrollIntoViewIfNeeded();const h=await hand.boundingBox(),t=await target.boundingBox();await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.mouse.move(h.x+20,h.y-20,{steps:3});await page.mouse.move(t.x+t.width/2,t.y+t.height/2,{steps:6});await page.mouse.up();assert.equal(await page.locator('.hc-card.on').count(),1);drag=true;
     // An invalid drop redraws the same request. Its selected physical card
     // must survive both the warning and the timer clearing it.
     const selected=await page.locator('.hc-card.on').getAttribute('data-hc-v'),h2=await hand.boundingBox(),bad=await page.locator('#meSide [data-drop="receive"]').boundingBox();await page.mouse.move(h2.x+h2.width/2,h2.y+h2.height/2);await page.mouse.down();await page.mouse.move(h2.x+20,h2.y-20,{steps:3});await page.mouse.move(bad.x+bad.width/2,bad.y+bad.height/2,{steps:6});await page.mouse.up();assert.equal(await page.locator('.hc-card.on').getAttribute('data-hc-v'),selected);await page.waitForTimeout(1900);assert.equal(await page.locator('.hc-card.on').getAttribute('data-hc-v'),selected);
    }else if(await page.locator('#dock').getAttribute('data-mode')==='hand'&&r.options.some(o=>o.value===value&&o.card))await require('./browser-test-helpers.cjs').fan(page,value);else await select(value);
   }else if(r.input.type==='cards')for(const v of value)await select(v);
   else if(r.input.type==='block'){for(const v of value.cards)await select(v);}
   assert(await page.locator('[data-hc-act="go"]').isEnabled(),r.kind+' cannot submit');await click('[data-hc-act="go"]');
  }
  assert.equal(games,3);assert(manual&&undo&&mull&&loss&&draw);assert.deepEqual(errors,[]);assert(await page.isHidden('#runtimeStatus'));
  await page.screenshot({path:path.join(process.env.E2E_OUTPUT_DIR||'/tmp','native-table-'+width+'.png')});
  console.log(JSON.stringify({width,games,steps,manual,undo,drag,mull,loss,draw,kinds:[...kinds],noOldGame:true,noErrors:true,noOverflow:true}));await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
