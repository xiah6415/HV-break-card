'use strict';
const assert=require('node:assert/strict'),I=require('./node-inventory'),F=require('./frequent-node-tests');
const codes=['P02-039'];
function setup(catalog,card,mode='positive'){
 const k=F.game(catalog),id=k.addCard(card.card_no,0,'hand'),p=card.profiles[0];k.state.turn.phase='attack';k.state.ball={kind:'attack',offense:4,owner:1};
 k.addCard(mode==='condition_false'?'HV-D01-009':'HV-P02-040',0,'toss');
 if(mode==='invalid')k.resolveProgram({kind:'invalidate_skill',actor:'self',selector:{roles:['attack']},duration:'this_turn'},0,id);
 return{k,id,p,phase:'attack'};
}
function invoke(f){return f.k.enter(f.id,'attack');}
function testFailure(catalog){
 const forms=I.forms(catalog).force_judgment_failure;
 for(const{node}of forms.values())for(const controller of [0,1]){
  const k=F.game(catalog),id=k.addCard('HV-D01-009',controller,'event'),before=k.snapshot();k.state.turn.player=controller;const start=k.snapshot();k.preflight(node);k.resolveProgram(node,controller,id);assert(!k.judgmentFails(1-controller,'block',6));const registered=k.snapshot();k.endTurn();k.beginTurn(1-controller,'block');
  for(const defense of [-1,0,5,6,7,10])assert.equal(k.judgmentFails(1-controller,'block',defense),defense<=node.condition.value);
  assert(!k.judgmentFails(controller,'block',3));assert(!k.judgmentFails(1-controller,'receive',3));k.endTurn();k.beginTurn(controller,'attack');assert(!k.judgmentFails(1-controller,'block',3));k.restore(start);k.resolveProgram(node,controller,id);assert.deepEqual(k.snapshot(),registered,'Rule-effect replay');
  for(const bad of [{judge:'receive'},{actor:'self'},{condition:{...node.condition,op:'gte'}}])assert.throws(()=>k.preflight({...node,...bad}),/judgment failure parameters/);
 }
 return forms.size;
}
function testCard(catalog,card){for(const mode of ['positive','condition_false','invalid']){const f=setup(catalog,card,mode),{k}=f,before=k.snapshot();invoke(f);assert.equal(k.state.effects.filter(e=>e.kind==='judgment_failure').length,mode==='positive'?1:0,mode);assert(!k.judgmentFails(1,'block',6));const after=k.snapshot();k.restore(before);invoke(f);assert.deepEqual(k.snapshot(),after);k.endTurn();k.beginTurn(1,'block');assert.equal(k.judgmentFails(1,'block',6),mode==='positive');}}
module.exports={codes,setup,invoke,testFailure,testCard};
