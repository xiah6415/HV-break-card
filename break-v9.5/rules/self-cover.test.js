'use strict';
const assert=require('node:assert/strict'),T=require('./self-cover-tests'),F=require('./frequent-node-tests'),catalog=require('./data/cards.json');
const cards=catalog.cards.filter(c=>['HV-PR-001','HV-PR-002'].includes(c.card_no)),params=['serve','block','receive','toss','attack'];
for(const card of cards){
 T.testSelfCoverCard(catalog,card);
 for(const parameter of params){const{k,id,dest}=T.setup(catalog,card),before=k.snapshot();k.choose=r=>r.kind==='parameter'?(assert.deepEqual(r.options,params),parameter):F.choose(r);k.enter(id,dest);for(const p of params)assert.equal(k.parameter(id,p),k.card(id).printed.parameters[p]+(p===parameter?1:0));const end=k.snapshot();k.restore(before);k.enter(id,dest);assert.deepEqual(k.snapshot(),end);k.endTurn();assert.equal(k.parameter(id,parameter),k.card(id).printed.parameters[parameter]);}
 for(const matched of [true,false]){
  const{k,id,old,dest}=T.setup(catalog,card,matched?'mismatch':'positive'),name=matched?card.profiles[0].activation.trigger.filters.covered_names[0]:'別の名前';k.effect('rename',{target:k.reference(old),name},k._context(old,0));k.choose=r=>r.kind==='parameter'?'attack':F.choose(r);k.enter(id,dest);assert.equal(k.parameter(id,'attack'),k.card(id).printed.parameters.attack+(matched?1:0),'Effective predecessor name '+card.card_no+' '+matched);
 }
 for(const mode of ['invalid','from_drop','side','centre','reentry']){
  const{k,id,old}=T.setup(catalog,card,mode==='side'?'mismatch':'positive',mode==='side'||mode==='centre'?'block':'receive');
  k.choose=r=>r.kind==='parameter'?'attack':F.choose(r);
  if(mode==='invalid')k.resolveProgram({kind:'invalidate_skill',actor:'self',selector:{type:'character'},duration:'this_turn'},0,old);
  if(mode==='from_drop')k._move(id,0,'drop',k._context(id,0));
  if(mode==='side')k.enter(id,'block',{side:true});else if(mode==='centre')k.enterBlock([id],id);else k.enter(id,'receive',{reason:mode==='from_drop'?'skill':'rule'});
  assert.equal(k.parameter(id,'attack'),k.card(id).printed.parameters.attack+(['side','invalid'].includes(mode)?0:1),card.card_no+' '+mode);
  if(mode==='reentry'){k._atomic(()=>{k._move(old,0,'drop',k._context(old,0));k._move(id,0,'drop',k._context(id,0));});k.enter(id,'receive',{reason:'skill'});assert.equal(k.parameter(id,'attack'),k.card(id).printed.parameters.attack);}
 }
 // The real PR-012 rename entry covers either printed identity.
 {const{k,id,old,dest}=T.setup(catalog,card);k._move(old,0,'drop',k._context(old,0));const renamed=k.addCard('HV-PR-012',0,'hand'),name=card.profiles[0].activation.trigger.filters.covered_names[0];k.choose=r=>r.kind==='name'?name:r.kind==='parameter'?'attack':F.choose(r);k.enter(renamed,dest);k.enter(id,dest);assert.equal(k.parameter(id,'attack'),k.card(id).printed.parameters.attack+1);}
}
// Shared parameter selection excludes absent values while retaining numeric zero.
{const card=cards[0],{k,id}=T.setup(catalog,card,'positive','attack');k.card(id).printed.parameters.receive='dash';k.choose=r=>{if(r.kind==='parameter'){assert(!r.options.includes('receive'));assert(r.options.includes('toss'));return 'toss';}return F.choose(r);};k.enter(id,'attack');assert.equal(k.parameter(id,'toss'),1);}
console.log('self-entry-cover: two shapes, each five parameters including zero, effective/real renamed predecessors, centre/side, empty/mismatch, invalidation, effect entry, expiry and replay passed');
