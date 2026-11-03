'use strict';
const T=require('./browser-test-helpers.cjs');
(async()=>{const b=await T.browser();try{for(const size of T.sizes){
 const f=T.fixture({name:'hand-info',phase:'receive',pc:'receive',hand:['D01-005','D01-005','D01-012']}),p=await T.load(b,size,{fixture:f,pauseAI:true});const r=await T.ready(p),before=await T.snapshot(p),chosen=f.refs.hand[1];
 await T.fan(p,chosen,{inspect:true});T.assert(await p.isVisible('#handCardInfoHint'));T.assert((await p.textContent('#sheetBox')).includes('HV-D01-005'));T.assert((await p.textContent('#sheetBox')).includes('支付3 Guts'));T.assert((await p.textContent('#sheetBox')).includes('【接球區】'));T.assert.deepEqual(await T.snapshot(p),before,'inspection never submits or changes Match');T.assert.equal(await p.evaluate(()=>commandTrace.length),0);
 T.assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await p.screenshot({path:'/tmp/hand-info-'+size[0]+'.png'});await p.locator('#sheet [data-close]').click();T.assert.equal(await p.locator('.hand .hc.staged [data-hand]').getAttribute('data-hand'),'1','correct physical copy stays selected');
 await T.fan(p,f.refs.hand[2],{inspect:true});T.assert((await p.textContent('#sheetBox')).includes('HV-D01-012'));T.assert.deepEqual(await T.snapshot(p),before,'ineligible cards can be inspected without playing');await p.locator('#sheet [data-close]').click();T.assert.equal(await p.locator('.hand .hc.staged [data-hand]').getAttribute('data-hand'),'1');T.assert.equal((await T.ready(p)).requestId,r.requestId);
 await p.click('[data-hc-act="go"]');await p.waitForFunction(id=>tableTest.waiting?.requestId!==id,r.requestId);T.assert.equal((await T.snapshot(p)).zones['0.receive'].at(-1),chosen);await T.undo(p);T.assert.deepEqual((await T.snapshot(p)).zones,before.zones);await T.check(p);await p.close();
 console.log('hand info',size[0],'legal and ineligible single taps, exact card, no command, selection, confirmation and Undo passed');
}}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
