/* Explicit deck fixtures for browser tests; never provide production defaults. */
const {DECKS}=require('./engine');
const decks=[{id:'my_test_k1014',...DECKS.k1014}];
async function seed(page){await page.addInitScript(rows=>{if(!localStorage.getItem('bk_my_decks')){localStorage.setItem('bk_my_decks',JSON.stringify(rows));localStorage.setItem('bk_my',rows[0].id);}},decks);}
async function acceptAgreement(page){await page.waitForFunction(()=>!!document.getElementById('agreementAccept')||document.getElementById('accountGoogle').hidden);if(await page.locator('#agreementAccept').count()){await page.check('#agreementUsage');await page.check('#agreementResearch');await page.click('#agreementAccept');await page.waitForSelector('#agreementGate',{state:'detached'});}}
module.exports={seed,decks,acceptAgreement};
