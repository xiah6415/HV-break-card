'use strict';
const assert=require('node:assert/strict'),I=require('./node-inventory'),F=require('./frequent-node-tests');
const codes=['P03-028'];
function setup(catalog,card,mode='positive'){
 const k=F.game(catalog),fee=mode==='short'?null:k.addCard(mode==='wrong_fee'?'HV-D01-009':'HV-P01-005',0,'receive'),id=k.addCard(card.card_no,0,mode==='wrong_role'?'attack':'receive'),target=k.addCard(mode==='wrong_tag'?'HV-D01-009':'HV-P04-075',0,'hand');k.state.turn.phase='toss';k.state.ball={kind:'attack',offense:8,owner:1};
 if(mode==='wrong_role')k.addCard('HV-D01-009',0,'receive');
 if(mode==='invalid')k.resolveProgram({kind:'invalidate_skill',actor:'self',selector:{roles:['receive','toss']},duration:'this_turn'},0,id);
 k.choose=r=>r.kind==='activate_payment'?mode!=='decline':F.choose(r);
 return{k,id,target,fee,p:card.profiles[0],phase:'toss',dest:'toss',sourceCover:true};
}
function invoke(f){return f.k.enter(f.target,'toss');}
function testCover(catalog){
 const forms=I.forms(catalog).cover_source_with_guts;
 for(const{node}of forms.values())for(const controller of [0,1])for(const mode of ['positive','short','stale','wrong_zone','not_guts']){
  const k=F.game(catalog),fee=k.addCard('HV-P03-020',controller,mode==='wrong_zone'?'attack':'receive'),source=k.addCard('HV-D01-009',controller,'receive'),ctx=k._context(source,controller);k.state.turn.phase='toss';
  if(mode==='short')k._atomic(()=>k._move(fee,controller,'drop',ctx));if(mode==='not_guts')k._atomic(()=>k._move(source,controller,'drop',ctx));if(mode==='stale')k.card(source).incarnation++;
  const before=k.snapshot(),run=()=>k._atomic(()=>k._run(node,structuredClone(ctx)));k.preflight(node);
  if(mode!=='positive'){assert.throws(run,e=>e.constructor.name==='Unpayable');assert.deepEqual(k.snapshot(),before);continue;}
  run();assert.equal(k.top(controller,'receive'),fee);assert.equal(k.role(source),'guts');assert.equal(k.current(ctx.source),false);assert.equal(k.state.events.slice(before.events.length).filter(e=>e.type==='character_entry').length,0);assert.equal(k.state.queue.length,0,'Placed Kageyama does not trigger its receive entry skill');assert.equal(k.parameter(fee,'receive'),5,'No old character modifiers or entry bonus');assert(k.state.events.some(e=>e.type==='character_placement'&&e.card===fee));const after=k.snapshot();k.restore(before);run();assert.deepEqual(k.snapshot(),after);
  assert.throws(()=>k.preflight({...node,count:2}),/source cover parameters/);
 }
 return forms.size;
}
function testCard(catalog,card){
 for(const mode of ['positive','wrong_tag','wrong_role','short','wrong_fee','decline','invalid']){
  const f=setup(catalog,card,mode),{k,id,fee}=f,before=k.snapshot();invoke(f);const yes=mode==='positive';assert.equal(k.top(0,'receive')===fee,yes,mode);assert.equal(k.state.effects.filter(e=>e.kind==='watch').length,yes?1:0,mode);assert.equal(k.state.events.slice(before.events.length).filter(e=>e.type==='character_entry').length,1,'Only actual setter entered');if(['short','wrong_fee','invalid'].includes(mode))assert(!k.state.decisions.slice(before.decisions.length).some(d=>d.request.kind==='activate_payment'));
  const after=k.snapshot();k.restore(before);invoke(f);assert.deepEqual(k.snapshot(),after,'Source cover replay '+mode);
 }
}
module.exports={codes,setup,invoke,testCover,testCard};
