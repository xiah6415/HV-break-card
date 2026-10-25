/* Explicit deck fixtures for browser tests; never provide production defaults. */
const {DECKS}=require('./engine');
const decks=[{id:'my_test_k1014',...DECKS.k1014}];
async function seed(page){await page.addInitScript(rows=>{if(!localStorage.getItem('bk_my_decks')){localStorage.setItem('bk_my_decks',JSON.stringify(rows));localStorage.setItem('bk_my',rows[0].id);}},decks);}
module.exports={seed,decks};
