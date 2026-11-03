'use strict';
const T=require('./browser-test-helpers.cjs');
(async()=>{const b=await T.browser();try{for(const size of T.sizes)for(const guess of ['heads','tails'])for(const choice of ['serve','receive']){
 const p=await T.load(b,size,{openingCoin:true});let r=await T.ready(p);T.assert.equal(r.kind,'coinGuess');T.assert.match(await p.textContent('#dockOpts'),/正面.*反面/s);T.assert(!r.canLoss);await T.answer(p,guess);r=await T.ready(p);const coin=(await T.snapshot(p)).match.coin;T.assert.match(await p.textContent('#dockOpts'),/硬幣：/);T.assert(!/擲骰/.test(await p.textContent('#dockOpts')));
 if(coin.winner===0){T.assert.equal(r.kind,'firstService');await T.answer(p,choice);}else T.assert.equal(r.kind,'roll');
 const server=(await T.snapshot(p)).match.server;await T.answer(p,true);r=await T.ready(p);T.assert.equal(r.kind,'mulligan');T.assert.match(await p.textContent('#rallyStatus'),new RegExp('首球發球：'+(server===0?'你':'AI')));T.assert.match(await p.textContent('#rallyStatus'),/調度中/);
 T.assert.match(await p.textContent('#dockOpts .hc-opening-server'),/首球發球/);await p.screenshot({path:'/tmp/coin-mulligan-'+size[0]+'.png'});await T.answer(p,[]);await p.waitForFunction(()=>tableTest.match._m.rally===1);T.assert.equal((await T.snapshot(p)).match.server,server);await T.ready(p);await T.check(p);await p.screenshot({path:'/tmp/coin-opening-'+size[0]+'-'+guess+'-'+choice+'.png'});await p.close();console.log('coin opening UI',size[0],guess,choice,'passed');
}}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
