'use strict';
const T=require('./browser-test-helpers.cjs');
(async()=>{const b=await T.browser();try{for(const size of T.sizes)for(const mode of ['numeric','strict']){
 const f=T.fixture({name:'quiet-effects',mode,hand:['PR-029','D02-005','D03-007'],court:{receive:['D01-009']}}),p=await T.load(b,size,{fixture:f,pauseAI:true});
 let r=await T.ready(p);T.assert.equal(r.kind,'setter','unusable Event does not open a prompt');T.assert.equal(await p.locator('#dockOpts .hc-timing').count(),0,'no false effect availability hint');T.assert.equal(await p.locator('#manualBtn').isVisible(),mode==='numeric');
 await T.answer(p,f.refs.hand[1]);r=await T.ready(p);T.assert.equal(r.kind,'attacker','empty toss window advances directly');await T.answer(p,f.refs.hand[2]);r=await T.ready(p);T.assert.equal(r.kind,'turnEnd','empty attack window advances directly');T.assert(r.canLoss);await T.check(p);await p.close();
 const usable=T.fixture({name:'available-effects',mode,phase:'draw',pc:'drawEvent',hand:['PR-029','D02-005'],drop:['P01-001','P01-006'],court:{receive:['D01-009']}}),q=await T.load(b,size,{fixture:usable,pauseAI:true});r=await T.ready(q);T.assert.equal(r.kind,'event');T.assert(r.options.some(o=>o.value===usable.refs.hand[0]));T.assert(await q.locator('#dockOpts [data-hc-v="null"]').isVisible());await T.answer(q,null);T.assert.equal((await T.ready(q)).kind,'receiver');await T.undo(q);T.assert.equal((await T.ready(q)).kind,'event','Undo restores actual effect window');await T.check(q);await q.close();
 console.log('effect timing',size[0],mode,'empty/unusable windows skipped; available Event, skip, Undo, manual and turnEnd retained');
}}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
