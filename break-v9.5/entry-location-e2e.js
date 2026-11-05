'use strict';const T=require('./browser-test-helpers.cjs');
(async()=>{const b=await T.browser();try{for(const size of T.sizes){
 const f=T.fixture({name:'p04016-location',pc:'attack',phase:'attack',hand:['D04-006'],court:{toss:['D01-009','D01-009','P04-016'],receive:['P04-020','P01-033'],serve:['P04-020','D04-011']}}),p=await T.load(b,size,{fixture:f,pauseAI:true});
 for(let i=0;i<10&&(await T.ready(p)).kind!=='entry';i++)await T.answer(p);
 const r=await T.ready(p);T.assert.equal(r.kind,'entry');T.assert.equal(r.options.length,2);
 T.assert.deepEqual((await p.locator('#dockOpts .hc-zone').allTextContents()).sort(),['我方接球區・Guts','我方發球區・Guts'].sort());T.assert((await p.locator('#dockOpts .hc-code').allTextContents()).every(s=>s==='P04-020'));
 const chosen=r.options.find(o=>o.card.zone==='0.receive').value,other=r.options.find(o=>o.value!==chosen).value;
 await p.screenshot({path:'/tmp/entry-location-'+size[0]+'.png'});await T.answer(p,[chosen]);T.assert.equal(await p.evaluate(()=>tableTest.match._kernel.top(0,'attack')),chosen);T.assert.equal(await p.evaluate(id=>tableTest.match._kernel.card(id).zone,other),'0.serve');
 await T.undo(p);T.assert.equal((await T.ready(p)).kind,'entry');T.assert.equal(await p.locator('#dockOpts .hc-zone').count(),2);await T.check(p);await p.close();console.log('P04-016 / P04-020',size[0],'both Guts areas visible, exact physical selection and Undo passed');
}}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
