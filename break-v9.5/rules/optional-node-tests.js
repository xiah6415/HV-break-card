'use strict';
const assert=require('node:assert/strict'),F=require('./frequent-node-tests'),I=require('./node-inventory');
function testOptional(catalog){
 const forms=I.forms(catalog).optional;
 for(const {node:n}of forms.values())for(const variant of ['accept','decline','empty']){
  const k=F.game(catalog),id=k.addCard('HV-D01-009',0,'attack'),ctx=k._context(id,0),actor=n.actor==='opponent'?1:0;
  const program={...structuredClone(n),then:{kind:'sequence',steps:[{kind:'draw',actor:'self',count:1,count_mode:'exact',bind:'drawn'}]}};
  if(variant!=='empty')k.addCard('HV-D01-009',0,'deck');let asks=0;k.choose=r=>{asks++;assert.equal(r.kind,'optional');assert.equal(r.player,actor);assert(r.effectDescription.includes('抽1張'));return variant==='accept';};
  ctx.bind.optional={performed:true};const before=k.snapshot();assert.equal(k._atomic(()=>k._run(program,ctx)),variant==='accept');assert.equal(ctx.bind.optional.performed,variant==='accept');assert.equal(asks,variant==='empty'?0:1);assert.equal(k.zone(0,'hand').length,variant==='accept'?1:0);
  const after=k.snapshot();k.restore(before);k._atomic(()=>k._run(program,ctx));assert.deepEqual(k.snapshot(),after);
  k.restore(before);if(variant!=='empty'){k.choose=()=>1;assert.throws(()=>k.resolveProgram(program,0,id),/Optional decision must be boolean/);assert.deepEqual(k.snapshot(),before);}
  for(const change of [n=>n.actor='unknown',n=>n.bind='other',n=>n.then=null]){const bad=structuredClone(program);change(bad);assert.throws(()=>k.preflight(bad),/optional parameters/);}
 }
 return forms.size;
}
function testOptionalCard(catalog,card){
 if(card.card_no==='HV-P02-004')for(const choice of ['accept','decline','empty']){
  const k=F.game(catalog);k.state.turn.phase='serve';const covered=k.addCard('HV-D01-009',0,'serve'),source=k.addCard(card.card_no,0,'hand');
  if(choice!=='empty')k.addCard(catalog.cards.find(c=>I.short(c.card_no)==='BP-013').card_no,1,'hand');
  const ev=k.zone(1,'hand')[0];let asks=0;k.choose=r=>{if(r.kind==='optional'){asks++;assert.equal(r.player,1);return choice==='accept';}return F.choose(r);};
  const before=k.snapshot();k.enter(source,'serve');const after=k.snapshot();assert.equal(k.top(0,'serve'),source);assert.equal(k.zone(0,'serve')[0],covered);assert.equal(asks,choice==='empty'?0:1);assert.equal(k.state.effects.filter(e=>e.kind==='watch').length,choice==='accept'?0:1);if(choice==='accept')assert.deepEqual(k.zone(1,'event'),[ev]);
  k.restore(before);k.enter(source,'serve');assert.deepEqual(k.snapshot(),after);
 }
 else if(card.card_no==='HV-P02-064')for(const area of ['serve','block','receive','toss','attack'])for(const variant of ['accept','decline','short']){
  const k=F.game(catalog);k.state.turn.phase=area;const id=k.addCard(card.card_no,0,'hand');for(let i=0;i<(variant==='short'?1:2);i++)k.addCard('HV-D01-009',0,'hand');let asks=0;k.choose=r=>{if(r.kind==='optional'){asks++;return variant==='accept';}return F.choose(r);};
  const before=k.snapshot();k.enter(id,area);const after=k.snapshot();assert.equal(asks,variant==='short'?0:1);assert.equal(k.zone(0,'drop').length,variant==='accept'?2:0);for(const p of ['serve','block','receive','toss','attack'])if(k.card(id).printed.parameters[p]!=='dash')assert.equal(k.parameter(id,p),variant==='accept'?k.card(id).printed.parameters[p]:0);k.restore(before);k.enter(id,area);assert.deepEqual(k.snapshot(),after);
 }
 else require('./card-scenarios').testCard(catalog,card);
}
module.exports={testOptional,testOptionalCard};
