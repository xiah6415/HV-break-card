'use strict';
const assert=require('node:assert/strict'),F=require('./frequent-node-tests');
function setup(catalog,card,mode='positive',dest='receive'){
 const k=F.game(catalog),p=card.profiles[0],name=p.activation.trigger.filters.covered_names[0];k.state.turn.phase=dest;k.state.ball={kind:'attack',offense:8,owner:1};
 const def=catalog.cards.find(c=>!c.profiles[0].program&&c.profiles[0].variants[0].printed.name===name&&Number.isInteger(c.profiles[0].variants[0].printed.parameters[dest]));assert(def,'Real named predecessor '+name+' '+dest);
 const old=mode==='empty'?null:k.addCard(mode==='mismatch'?'HV-D01-009':def.card_no,0,dest),id=k.addCard(card.card_no,0,'hand');
 return {k,id,old,dest,p};
}
function testSelfCoverCard(catalog,card){
 for(const mode of ['positive','mismatch','empty']){
  const {k,id,dest}=setup(catalog,card,mode),before=k.snapshot();k.choose=r=>r.kind==='parameter'?'attack':F.choose(r);k.enter(id,dest);const after=k.snapshot();
  assert.equal(after.events.slice(before.events.length).filter(e=>e.type==='resolve_trigger').length,mode==='positive'?1:0,card.card_no+' '+mode);
  assert.equal(k.parameter(id,'attack'),k.card(id).printed.parameters.attack+(mode==='positive'?1:0));k.restore(before);k.enter(id,dest);assert.deepEqual(k.snapshot(),after,'Self-coverage replay '+card.card_no+' '+mode);
 }
}
module.exports={setup,testSelfCoverCard};
