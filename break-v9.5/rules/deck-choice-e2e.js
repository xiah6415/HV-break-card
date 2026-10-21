'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),path=require('node:path');
const {Match}=require('./match'),F=require('./match-pilot-fixtures'),H=require('../host-choice');
const deck=[...F.decks.basic.slice(0,32),...Array(8).fill('P03-079')],m=new Match({seed:7,decks:[deck,deck]});
let request;
for(let i=0;i<1000;i++){
 const r=m.request(0)||m.request(1);assert(r);if(r.kind==='revealResult'){request=r;break;}
 const q=F.newQuestion(m,r),value=F.newAnswer(q,F.select(q,F.newState(m),r.actor,{mulligan:true,preferBlock:true}));let answer=H.makeAnswer(r,value);if(!H.validate(r,answer).ok)answer=H.aiAnswer(r);m.dispatch(answer);
}
assert(request);assert.equal(request.options.length,5);
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE});
 try{for(const width of [1280,390,320]){
  const page=await browser.newPage({viewport:{width,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve('pilot-match.html')).href);
  await page.evaluate(r=>{window.deckAnswer=null;const box=document.createElement('section');box.id='deck-choice';document.querySelector('main').append(box);BreakChoiceUI.render(box,r,{imgSrc:no=>'img/'+no.replace(/^HV-?/,'')+'.webp',onAnswer:a=>{window.deckAnswer=a;}});},request);
  assert.equal(await page.locator('#deck-choice .hc-grid .hc-card').count(),5);
  await page.waitForFunction(()=>[...document.querySelectorAll('#deck-choice img')].every(i=>i.complete&&i.naturalWidth>0));
  assert(await page.locator('#deck-choice [data-hc-act="go"]').isEnabled());
  // This is a view confirmation, not selection/payment; selecting zero is valid.
  await page.locator('#deck-choice [data-hc-act="go"]').click();
  assert.deepEqual(await page.evaluate(()=>deckAnswer.value),[]);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
  console.log('deck view: '+width+'px / all five cards visible / confirmation / no overflow passed');await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
