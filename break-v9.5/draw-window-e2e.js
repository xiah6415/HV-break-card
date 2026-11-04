'use strict';
const T=require('./browser-test-helpers.cjs');
(async()=>{const b=await T.browser();try{for(const size of T.sizes)for(const code of ['PR-029','P03-057']){
 const f=T.fixture({name:'early-'+code,phase:'draw',pc:'drawAck',hand:[code,'D01-009'],drop:['P01-001','P01-006']}),p=await T.load(b,size,{fixture:f,pauseAI:true});
 let r=await T.ready(p);T.assert.equal(r.kind,'ack');await T.answer(p,true);r=await T.ready(p);T.assert.equal(r.timing,'draw');T.assert.equal(r.kind,'event');T.assert.match(await p.textContent('#dockOpts .hc-current'),/抽牌階段/);T.assert.equal(await p.evaluate(()=>tableTest.match._kernel.top(0,'receive')),null);
 const before=await T.snapshot(p);await T.answer(p,f.refs.hand[0]);for(let i=0;i<30;i++){r=await T.ready(p);if(r.origin!=='kernel')break;T.assert.equal(r.timing,'draw');await T.answer(p);}if(r.kind==='event')await T.answer(p,null);r=await T.ready(p);T.assert.equal(r.kind,'receiver');
 for(let i=0;i<30;i++){r=await T.undo(p);if(r.kind==='event'&&r.timing==='draw')break;}T.assert.deepEqual((await T.snapshot(p)).zones,before.zones);await T.check(p);await p.close();console.log('draw-before-receive',size[0],code,'visible phase, resolution and Undo passed');
 }}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
