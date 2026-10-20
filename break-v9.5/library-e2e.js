'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const sample={n:'新卡牌組 <img src=x onerror=alert(1)>',c:['P03-004','P03-022','P01-014','P01-001','P01-009','P01-024','P02-022','P02-032','P03-008','P03-018'].map(c=>['HV-'+c+'-'+require('./card-library').card(c).versions[0].images[0].split('-').at(-1),4])};
const snap=page=>page.evaluate(()=>Object.fromEntries(['meSide','oppSide','net','logSide','dockQ'].map(id=>[id,document.getElementById(id).textContent.replace(/\s+/g,' ').trim()])));
async function advance(page){
 if(await page.locator('#turnScreen:visible').count())return page.click('#turnNext');
 for(const a of ['multi','confirm','ack'])if(await page.locator(`[data-act="${a}"]`).count())return page.locator(`[data-act="${a}"]`).click();
 if(await page.locator('[data-act="blk"]').count()){if(await page.locator('[data-act="blk"]').isEnabled())return page.click('[data-act="blk"]');if(await page.locator('[data-rec]').count())return page.locator('[data-rec]').first().click();}
 if(await page.locator('.hand .hc.sel .cbtn').count())return page.locator('.hand .hc.sel .cbtn').first().click();
 if(await page.locator('#dockOpts [data-i]').count())return page.locator('#dockOpts [data-i]').last().click();
 await page.waitForTimeout(30);
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE||undefined});
 try{for(const [width,height]of [[1280,900],[390,844],[320,568]]){
  const page=await browser.newPage({viewport:{width,height},isMobile:width<500,hasTouch:width<500}),errors=[],dialogs=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss();});
  await page.goto(pathToFileURL(path.resolve('index.html')).href,{waitUntil:'domcontentloaded'});await page.evaluate(()=>localStorage.clear());await page.reload({waitUntil:'domcontentloaded'});
  assert.equal(await page.evaluate(()=>Object.keys(BreakEngine.DEF).length),212);
  await page.click('#supportBtn');assert.match(await page.textContent('#sheetBox'),/541 張卡片可查閱，212 張可對戰/);
  await page.selectOption('#libraryStatus','locked');assert.match(await page.textContent('#libraryCount'),/329 張/);
  await page.fill('#libraryQuery','P04-097');await page.click('[data-support-card="P04-097"]');
  assert.match(await page.textContent('#sheetBox'),/尚未開放對戰/);await page.waitForFunction(()=>document.querySelector('.detail img').naturalWidth>0);
  assert.equal(await page.locator('.detail h3').textContent(),await page.evaluate(()=>BreakCardLibrary.card('P04-097').name));assert.equal(await page.locator('.detail img').getAttribute('alt'),await page.locator('.detail h3').textContent());
  await page.click('#backLibrary');assert.equal(await page.inputValue('#libraryQuery'),'P04-097');assert.equal(await page.inputValue('#libraryStatus'),'locked');
  await page.selectOption('#libraryStatus','playable');await page.fill('#libraryQuery','月島螢 P03-004');assert.match(await page.textContent('#libraryCount'),/找到 1 張/);await page.click('[data-support-card="P03-004"]');
  await page.waitForFunction(()=>document.querySelector('.detail img').naturalWidth>0);assert.equal(await page.locator('.statrow b').allTextContents().then(x=>x.join(',')),'2,3,3,0,3');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.join(process.env.E2E_OUTPUT_DIR||'.',`library-${width}.png`)});await page.click('[data-close]');
  await page.click('#editDeck');await page.fill('#customJSON',JSON.stringify({cards:{'P04-097':40}}));await page.click('#saveCustom');assert.match(await page.textContent('#customError'),/尚未開放/);
  await page.fill('#customJSON',JSON.stringify(sample));await page.click('#saveCustom');assert.equal(await page.inputValue('#myDeck'),'custom');assert.equal(await page.locator('#setup img[src="x"]').count(),0);assert.deepEqual(dialogs,[]);
  for(const image of await page.locator('#myStrip img').all()){await image.scrollIntoViewIfNeeded();await image.evaluate(i=>new Promise((resolve,reject)=>{if(i.complete)return i.naturalWidth?resolve():reject(Error('broken card image'));i.onload=resolve;i.onerror=()=>reject(Error('broken card image'));}));}
  await page.reload({waitUntil:'domcontentloaded'});assert.equal(await page.inputValue('#myDeck'),'custom');await page.evaluate(()=>{Date.now=()=>7;});await page.selectOption('#speed','200');await page.click('#startBtn');
  for(let i=0;i<120&&!await page.locator('#dockOpts [data-act="ack"]').count();i++)await advance(page);
  assert.equal(await page.locator('#dockOpts [data-act="ack"]').count(),1,'reach real new-card draw phase');const before=await snap(page);
  await page.click('#dockOpts [data-act="ack"]');await page.waitForSelector('.hand .hc.sel');const after=await snap(page);await page.click('#undoBtn');await page.waitForSelector('#dockOpts [data-act="ack"]');assert.deepEqual(await snap(page),before);await page.click('#dockOpts [data-act="ack"]');await page.waitForSelector('.hand .hc.sel');assert.deepEqual(await snap(page),after);
  await page.locator('.hand .hc.sel .cbtn').first().click();await page.click('[data-act="confirm"]');await page.waitForFunction(()=>!document.querySelector('[data-act="confirm"]'));await page.click('#undoBtn');await page.waitForSelector('.hand .hc.sel');assert.deepEqual(await snap(page),after);
  await page.locator('.hand .hc').last().scrollIntoViewIfNeeded();await page.waitForFunction(()=>[...document.querySelectorAll('#meSide .hand img')].every(i=>i.complete&&i.naturalWidth>0));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(width<500){const geometry=await page.evaluate(()=>({hand:document.querySelector('.hand').getBoundingClientRect().bottom,dock:document.getElementById('dock').getBoundingClientRect().top}));assert(geometry.hand<=geometry.dock,'hand not obscured');}
  assert.deepEqual(errors,[]);console.log(JSON.stringify({width,passed:true,imagesLoaded:true,importAndReload:true,drawAndEntryUndo:true,errors}));await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
