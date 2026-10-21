'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{pathToFileURL}=require('node:url');
const {runNew}=require('./match-pilot-fixtures');
const expected=runNew({seed:7,deck:'skills',mulligan:true,preferBlock:true}),out=process.env.E2E_OUTPUT_DIR||'.';
(async()=>{const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE||undefined});const results=[];
 try{for(const [width,height]of [[1280,900],[390,844],[320,568]]){
  const page=await browser.newPage({viewport:{width,height},isMobile:width<500,hasTouch:width<500}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(pathToFileURL(path.resolve('pilot-match.html')).href,{waitUntil:'load',timeout:30000});
  let screenshot=false;
  for(let i=0;i<expected.records.length;i++){
   const r=await page.evaluate(()=>pilot.request()),record=expected.records[i];assert(r);assert.equal(r.kind,record.rawKind);
   const value=record.answer;
   const click=v=>page.locator(`#choice [data-hc-v='${JSON.stringify(v)}']`).click();
   if(r.input.type==='single'||r.input.type==='number')await click(value);
   if(r.input.type==='cards')for(const id of value)await click(id);
   if(r.input.type==='block'){for(const id of value.cards)await click(id);const center=page.locator(`#choice [data-hc-ctr='${JSON.stringify(value.center)}']`);if(await center.count())await center.click();}
   assert(await page.locator('#choice [data-hc-act="go"]').isEnabled());
   if(width===390&&!screenshot&&r.kind==='payment_cards'){await page.screenshot({path:path.join(out,'pilot-payment-390.png')});screenshot=true;}
   await page.locator('#choice [data-hc-act="go"]').click();assert.equal(await page.textContent('#error'),'');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  const final=await page.evaluate(()=>({m:pilot.match.view(0).match,steps:pilot.steps}));assert.equal(final.m.phase,'finished');assert.equal(final.m.winner,expected.final.winner);assert.equal(final.steps,145);
  await page.click('#restart');await page.click('#auto');await page.waitForFunction(()=>pilot.match.view(0).match.phase==='finished',{timeout:30000});assert.equal(await page.textContent('#error'),'');
  const ai=await page.evaluate(()=>({steps:pilot.steps,winner:pilot.match.view(0).match.winner}));assert(ai.steps>20);
  await page.click('#restart');for(let i=0;i<10;i++){if(await page.evaluate(()=>pilot.request()?.canLoss))break;await page.click('#ai');}
  const before=await page.evaluate(()=>pilot.match.view(0).match.rally);await page.click('#choice [data-hc-act="loss"]');await page.click('#choice [data-hc-act="lossyes"]');assert.equal(await page.evaluate(()=>pilot.losses),1);assert.equal(await page.evaluate(()=>pilot.match.view(0).match.rally),before+1);
  assert.deepEqual(errors,[]);results.push({width,uiAnswers:final.steps,aiAnswers:ai.steps,lossCommand:true,noPageErrors:true,noOverflow:true});await page.close();
 }}finally{await browser.close();}
 const result={passed:true,results};if(process.env.PILOT_UI_EVIDENCE_FILE)fs.writeFileSync(process.env.PILOT_UI_EVIDENCE_FILE,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1;});
