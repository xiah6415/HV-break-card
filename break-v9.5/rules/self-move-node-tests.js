'use strict';
const assert=require('node:assert/strict'),I=require('./node-inventory'),F=require('./frequent-node-tests');
function testSelfMove(catalog){
 const forms=I.forms(catalog).move_self;
 for(const {node:n}of forms.values())for(const zone of ['hand','attack','side:0']){
  const k=F.game(catalog),id=k.addCard('HV-D01-009',0,zone),ctx=k._context(id,0),dest=n.destination.split('.')[1],target=dest==='deck_bottom'?'deck':dest,was=k.reference(id),bottom=k.addCard('HV-D01-001',0,'deck');
  ctx.inPayment=n.reason==='declaration_cost';if(zone===target){const before=k.snapshot();assert.equal(k._atomic(()=>k._run(n,ctx)),false);assert.deepEqual(ctx.bind.moved,[]);assert.deepEqual(k.state.events,before.events);continue;}const before=k.snapshot();k._atomic(()=>k._run(n,ctx));const after=k.snapshot();
  assert.equal(k.card(id).zone,'0.'+target);assert.deepEqual(ctx.bind.moved,[id]);if(ctx.inPayment)assert.deepEqual(ctx.paid,[id]);
  if(dest==='deck_bottom')assert.deepEqual(k.zone(0,'deck'),[id,bottom]);
  if(zone!=='hand')assert(!k.current(was));assert(!after.events.slice(before.events.length).some(e=>e.type==='event_played'),'Moving to Event does not play it');
  k.restore(before);const replay=k._context(id,0);replay.inPayment=ctx.inPayment;k._atomic(()=>k._run(n,replay));assert.deepEqual(k.snapshot(),after,'Self move Undo '+n.destination+' '+zone);
  if(target==='hand'){
   k.restore(before);k.resolveProgram({kind:'ban_action',actor:'self',action:'add_hand',scope:{origins:['skill']},duration:'this_turn'},0);const saved=k.snapshot();assert.equal(k.resolveProgram(n,0,id),false);assert.deepEqual(k.zone(0,'hand'),saved.zones['0.hand']);
  }
 }
 // Paying by self-discard cannot pay twice; stale character identity cannot move a re-entered card.
 {const k=F.game(catalog),id=k.addCard('HV-D01-009',0,'drop'),ctx=k._context(id,0);ctx.inPayment=true;const saved=k.snapshot();assert.throws(()=>k._atomic(()=>k._run({kind:'move_self',destination:'owner.drop',reason:'effect'},ctx)));assert.deepEqual(k.snapshot(),saved);}
 {const k=F.game(catalog),id=k.addCard('HV-D01-009',0,'attack'),old=k._context(id,0);k._atomic(()=>k._move(id,0,'hand',old));k._atomic(()=>k._move(id,0,'attack',k._context(id,0)));const events=structuredClone(k.state.events);assert.equal(k._atomic(()=>k._run({kind:'move_self',destination:'owner.drop',reason:'effect'},old)),false);assert.equal(k.card(id).zone,'0.attack');assert.deepEqual(k.state.events,events,'A stale source cannot move a new character incarnation');}
 return forms.size;
}
module.exports={testSelfMove};
if(require.main===module)console.log('move_self: '+testSelfMove(require('./data/cards.json'))+' forms / hand, character, side / exact cost, zone, deck bottom, blocked add and Undo passed');
function testSelfMoveCard(catalog,card){
 const T=require('./node-module-tests'),p=card.profiles[0],n=I.nodes(p).find(n=>n.kind==='deck_selection');
 for(const variant of ['positive','negative','blocked']){
  const {k}=T.deckFixture(catalog,n,variant==='negative'?'negative':'positive'),id=k.addCard(card.card_no,0,'hand');k.state.turn.phase=p.activation.activation_phases[0];
  if(variant==='blocked')k.resolveProgram({kind:'ban_action',actor:'self',action:'add_hand',scope:{origins:['skill']},duration:'this_turn'},0);
  const before=k.snapshot();k.playEvent(id);const after=k.snapshot();assert.equal(k.card(id).zone,variant==='positive'?'0.hand':'0.event');
  const added=after.events.slice(before.events.length).filter(e=>e.type==='hand_added');assert.equal(added.length,variant==='positive'?2:0,'One recovered Event plus the returning source');
  k.restore(before);k.playEvent(id);assert.deepEqual(k.snapshot(),after,'Deck selection then self return Undo '+variant);
 }
}
module.exports.testSelfMoveCard=testSelfMoveCard;
