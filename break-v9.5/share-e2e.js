'use strict';
// 查卡網站分享連結匯入（Claude 2026-10-20）：貼連結預覽、鎖定卡清單、匯入我方／AI、?deck= 自動帶入、實際開局
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const DT=require('./deck-tools'),CL=require('./card-library'),{DECKS}=require('./engine');
const imageOf=c=>CL.card(c).versions[0].images[0];
const okCode=DT.LZString.compressToEncodedURIComponent(JSON.stringify({n:'分享烏野',c:Object.entries(DECKS.quick.cards).map(([c,n])=>[imageOf(c),n])}));
const lockedCard=Object.values(CL.data.cards).find(c=>!c.playable&&c.kind==='C');
const badCode=DT.LZString.compressToEncodedURIComponent(JSON.stringify({n:'含鎖定',c:[[imageOf(lockedCard.code),4],['P01-002',36]]}));
const site='https://weilun2022.github.io/haikyu-cards/?deck=';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE||undefined});
 try{for(const [width,height]of [[1280,900],[390,844],[320,568]]){
  const page=await browser.newPage({viewport:{width,height},isMobile:width<500,hasTouch:width<500}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const url=pathToFileURL(path.resolve('index.html')).href;
  await page.goto(url,{waitUntil:'domcontentloaded'});await page.evaluate(()=>localStorage.clear());await page.reload({waitUntil:'domcontentloaded'});await page.selectOption('#gameMode','strict');
  // 鎖定卡：列出名稱與張數，不給匯入
  await page.click('#editDeck');await page.fill('#shareURL',site+badCode);await page.click('#shareGo');
  const bad=await page.textContent('#sharePreview');assert.match(bad,/尚未開放對戰的技能卡 4 張/);assert.ok(bad.includes(lockedCard.name));
  assert.equal(await page.locator('#shareSave').count(),0);
  // 正常：匯入我方
  await page.fill('#shareURL',site+okCode.replace(/\+/g,' '));await page.click('#shareGo');
  assert.match(await page.textContent('#sharePreview'),/可以匯入/);await page.click('#shareSave');
  assert.equal(await page.inputValue('#myDeck'),'custom');assert.match(await page.locator('#myDeck option:checked').textContent(),/分享烏野/);
  // 匯入 AI
  await page.click('#editAiDeck');await page.fill('#shareURL',okCode);await page.click('#shareGo');await page.click('#shareSave');
  assert.equal(await page.inputValue('#aiDeck'),'custom_ai');
  const sw=await page.evaluate(()=>document.documentElement.scrollWidth);assert.ok(sw<=width,'橫向溢出 '+sw);
  // 重新載入後保留
  await page.reload({waitUntil:'domcontentloaded'});await page.selectOption('#gameMode','strict');assert.equal(await page.inputValue('#myDeck'),'custom');assert.equal(await page.inputValue('#aiDeck'),'custom_ai');
  // ?deck= 自動帶入
  await page.goto(url+'?deck='+okCode,{waitUntil:'domcontentloaded'});await page.waitForSelector('#shareSave');
  assert.ok(!(await page.evaluate(()=>location.search)).includes('deck='));
  await page.click('[data-close]');
  // 用匯入的牌組實際開局
  await page.selectOption('#speed','200').catch(()=>{});await page.click('#startBtn');
  await page.waitForFunction(()=>document.getElementById('dockQ').textContent.length>0);
  assert.deepEqual(errors,[]);
  console.log('share-e2e',width,'ok');await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
