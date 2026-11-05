'use strict';
const T=require('./browser-test-helpers.cjs');
(async()=>{const b=await T.browser();try{for(const size of T.sizes)for(const hint of ['off','simple','normal']){
 // Enter through Match.defendStart: genuine turn notice followed by a local request.
 const f=T.fixture({name:'turn-motion-live',pc:'defendStart',hand:['P01-011'],ball:6,prepare:({m,k})=>{k.state.turn.player=1;m._m.actor=1;}});
 const p=await T.load(b,size,{fixture:f,pauseAI:true,hint});await T.ready(p);
 await p.waitForFunction(()=>document.getElementById('rallyStatus').getAnimations().some(a=>a.playState==='running'),{},{timeout:1500});
 const before=await T.snapshot(p);
 T.assert.equal(await p.locator('.fx-turn').count(),0,'own turn uses the animated midline, no duplicate notice');
 const info=await p.evaluate(()=>{const e=document.getElementById('rallyStatus'),a=e.getAnimations()[0];return {duration:a.effect.getTiming().duration,visibility:getComputedStyle(e).visibility,turn:e.textContent};});
 T.assert.equal(info.duration,1450);T.assert.equal(info.visibility,'visible');T.assert.match(info.turn,/你的回合/);
 // A queued draw/status message must wait for the animated status and receive points.
 await p.evaluate(()=>{const v=tableTest.match.view(0);v.publicLog.push({type:'draw',player:1,count:1});tableTest.callbacks.onBoard(tableTest.board(),v);});
 T.assert.equal(await p.locator('.fx-opponent-draw').evaluate(e=>getComputedStyle(e).visibility),'hidden');
 await p.waitForFunction(()=>{const e=document.querySelector('.fx-opponent-draw');return e&&getComputedStyle(e).visibility==='visible';});
 await p.locator('.fx-opponent-draw').waitFor({state:'detached'});
 T.assert.deepEqual(await T.snapshot(p),before,'animation and notice do not submit commands');
 await T.check(p);await p.screenshot({path:'/tmp/turn-motion-live-'+size[0]+'-'+hint+'.png'});await p.close();console.log('visible live turn',size[0],hint,'real Match notice/request, animation, no duplicate, deferred notification passed');
}}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
