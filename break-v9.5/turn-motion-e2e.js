'use strict';
const T=require('./browser-test-helpers.cjs');
(async()=>{const b=await T.browser();try{for(const size of T.sizes){
 const f=T.fixture({name:'turn-motion',pc:'receive',hand:['P01-011'],ball:6});
 const p=await T.load(b,size,{fixture:f,pauseAI:true});await T.ready(p);
 const before=await T.snapshot(p);
 const result=await p.evaluate(async()=>{
  const calls=[],original=Element.prototype.animate;
  Element.prototype.animate=function(frames,options){const a=original.call(this,frames,options);if(['rallyStatus','net'].includes(this.id)){calls.push({id:this.id,frames,options});a.pause();a.currentTime=0;}return a;};
  const board=tableTest.board(),show=v=>tableTest.callbacks.onBoard(v,tableTest.match.view(0));
  // Feed the same presentation callback as both TableSession and OnlineSession.
  show({...board,turnNo:board.turnNo+2});await new Promise(requestAnimationFrame);
  const first=calls.length;
  show({...board,turnNo:board.turnNo+2});await new Promise(requestAnimationFrame);
  const repeat=calls.length;
  const ball= getComputedStyle(document.getElementById('net')).opacity;
  show({...board,turnNo:board.turnNo+3,turnP:board.players[1],target:1});await new Promise(requestAnimationFrame);
  const opponent=calls.length;
  show({...board,turnNo:board.turnNo+4});await new Promise(requestAnimationFrame);
  const current=calls.length;
  for(const id of ['rallyStatus','net'])for(const a of document.getElementById(id).getAnimations())a.finish();
  return {calls,first,repeat,ball,opponent,current};
 });
 T.assert.equal(result.first,2);T.assert.equal(result.repeat,2,'same turn must not replay');T.assert.equal(result.opponent,2,'opponent does not slide in');T.assert.equal(result.current,4,'new own turn animates');T.assert.equal(result.ball,'0','points hidden until delayed reveal');
 T.assert.equal(result.calls[0].options.duration,1450);T.assert.equal(result.calls[1].options.duration,800);T.assert.equal(result.calls[1].options.delay,1200);T.assert.match(result.calls[0].frames[0].easing,/cubic-bezier/);T.assert.equal(result.calls[0].frames[1].transform,'translateX(9px)');
 T.assert.deepEqual(await T.snapshot(p),before,'animation never changes match state');await T.check(p);await p.screenshot({path:'/tmp/turn-motion-'+size[0]+'.png'});
 await p.emulateMedia({reducedMotion:'reduce'});
 const reduced=await p.evaluate(async()=>{const board=tableTest.board();tableTest.callbacks.onBoard({...board,turnNo:board.turnNo+6},tableTest.match.view(0));await new Promise(requestAnimationFrame);return ['rallyStatus','net'].map(id=>document.getElementById(id).getAnimations()[0]?.effect.getTiming());});
 T.assert(reduced.every(t=>t.duration===120),'reduced motion short and no slide');
 await p.close();console.log('turn motion',size[0],'curve, timing, deduplication, opponent, state isolation, reduced motion passed');
}}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
