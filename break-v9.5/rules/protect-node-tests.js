'use strict';
const assert=require('node:assert/strict'),I=require('./node-inventory'),F=require('./frequent-node-tests');
const scope={mode:'single',binding:'reference',membership:'snapshot_on_resolution'};
const num=(parameter,value,target='source',operation='add')=>({kind:'numeric',target,parameter,value,operation,target_scope:scope,duration:'current_turn_cleanup_or_role_exit'});
function testProtect(catalog){
 const forms=I.forms(catalog).protect_numeric_decrease;
 for(const {node:n}of forms.values()){
  const k=F.game(catalog),id=k.addCard('HV-D01-009',0,'attack'),ctx=k._context(id,0);ctx.event.character=k.reference(id);k.card(id).printed.affiliation_tags=['稲荷崎'];
  k._atomic(()=>k._run(n,ctx));if(n.duration==='next_opponent_turn'){k.endTurn();k.beginTurn(1);}
  if(n.parameter==='offense'){
   k.state.ball={owner:0,kind:'attack',offense:9};const op=k.addCard('HV-D01-009',1,'block');assert.equal(k.resolveProgram(num('attack_offense',-2,'opponent_ball'),1,op),false);assert.equal(k.state.ball.offense,9);k.state.turn.phase='block';assert(k.resolveProgram({kind:'keyword',keyword:'one_touch',N:2,parameters:{}},1,op));assert.equal(k.state.ball.offense,9);assert.equal(k.state.turn.phase,'draw','The independent phase jump still executes');
   k.state.ball.owner=1;assert(k.resolveProgram(num('attack_offense',-2,'opponent_ball'),0,id));assert.equal(k.state.ball.offense,7,'Other owner is not protected');
  }else{
   for(const p of ['serve','block','receive','toss','attack']){const old=k.parameter(id,p);if(old==='dash')continue;const protectedValue=n.parameter==='all'||n.parameter===p;k.resolveProgram(num(p,-2),0,id);assert.equal(k.parameter(id,p),old-(protectedValue?0:2));if(protectedValue){k.resolveProgram(num(p,old-3,'source','set'),0,id);assert.equal(k.parameter(id,p),old);k.resolveProgram(num(p,1),0,id);assert.equal(k.parameter(id,p),old+1);}}
   const other=k.addCard('HV-D01-009',1,'attack'),base=k.parameter(other,'attack');k.resolveProgram(num('attack',-2),1,other);assert.equal(k.parameter(other,'attack'),base-2);
   if(n.target_scope.membership==='continuous_matching'){
    const future=k.addCard('HV-D01-009',0,'hand');k.card(future).printed.affiliation_tags=['稲荷崎'];k.card(future).printed.name='Future';k.advancePhase('receive');k.enter(future,'receive');const old=k.parameter(future,'receive');k.resolveProgram(num('receive',-3),0,future);assert.equal(k.parameter(future,'receive'),old,'Normal future entry is protected');
    const event=k.addCard('HV-D01-012',0,'event'),fromDrop=k.addCard('HV-D01-009',0,'drop');k.card(fromDrop).printed.affiliation_tags=['稲荷崎'];k.card(fromDrop).printed.name='Event Future';k._atomic(()=>k._enter(fromDrop,0,'toss',k._context(event,0),'skill'));const value=k.parameter(fromDrop,'toss');k.resolveProgram(num('toss',-3),0,fromDrop);assert.equal(k.parameter(fromDrop,'toss'),value,'Event future entry is protected');
    k._atomic(()=>k._move(id,0,'drop',ctx));assert(k._protected(k.reference(future),'receive',k._context(future,0)),'Resolved protection survives its source leaving');k.card(future).printed.affiliation_tags=['烏野'];assert(!k._protected(k.reference(future),'receive',k._context(future,0)),'Membership is evaluated at use time');
   }else{k._atomic(()=>k._move(id,0,'drop',ctx));const next=k.addCard('HV-D01-009',0,'attack');assert(!k._protected(k.reference(next),n.parameter,k._context(next,0)),'Single target protection does not transfer');}
  }
  if(k.state.turn.step!=='free')k.advancePhase('receive');const saved=k.snapshot();k.endTurn();assert(!k.state.effects.some(e=>e.kind==='protect'));k.restore(saved);k.loss(k.state.turn.player);k.finishLoss();assert(!k.state.effects.length);k.restore(saved);assert.deepEqual(k.snapshot(),saved);
 }
 // QA1779: enemy attack reductions resolve after the new back-attack entry;
 // the subsequent ball shield preserves 1 toss + (4 - 2) attack = 3.
 {
  const k=F.game(catalog),kenma=k.addCard('HV-D02-001',1,'receive'),w=I.nodes(catalog.cards.find(c=>c.card_no==='HV-D02-001').profiles[0]).find(n=>n.kind==='watch');k.state.turn.player=1;k.registerWatch(w,1,kenma);k.endTurn();k.beginTurn(0,'receive');
  const source=k.addCard('HV-P03-020',0,'hand');k.enter(source,'receive');
  const setter=catalog.cards.find(c=>!c.profiles[0].program&&c.profiles[0].variants[0].printed.parameters.toss===1&&c.profiles[0].variants[0].printed.name!==k.effectiveName(source));const t=k.addCard(setter.card_no,0,'hand');k.advancePhase('toss');k.enter(t,'toss');
  const ev=catalog.cards.find(c=>c.type==='event'&&c.profiles[0].variants[0].printed.affiliation_tags.includes('ユース'));k.addCard(ev.card_no,0,'event');
  const attacker=catalog.cards.find(c=>!c.profiles[0].program&&c.profiles[0].variants[0].printed.parameters.attack===3&&c.profiles[0].variants[0].printed.name!==k.effectiveName(t));const a=k.addCard(attacker.card_no,0,'hand');k.advancePhase('attack');k.enter(a,'attack');assert.equal(k.top(0,'attack'),source);assert.equal(k.parameter(source,'attack'),2);const offense=k.parameter(source,'attack')+k.parameter(t,'toss');assert.equal(offense,3);k.state.ball={owner:0,kind:'attack',offense};k.endTurn();k.beginTurn(1,'block');k.resolveProgram(num('attack_offense',-2,'opponent_ball'),1,kenma);assert.equal(k.state.ball.offense,3);
 }
 {
  const card=catalog.cards.find(c=>c.card_no==='HV-P01-091'),p=card.profiles[0],{k,id}=require('./batch-smoke').fixture(card,p,'receive',{rich:true,conditioned:true,expanded:true,max:true,key:'positive'},0,catalog),ctx=k._context(id,0);k.effect('protect',{targets:[],ballOwner:1,parameter:'offense'},ctx);let asks=0;const choose=k.choose;k.choose=r=>{if(r.kind==='activate_payment'){asks++;assert(r.ineffectiveReason.includes('防降'));return false;}return choose(r);};const drop=k.zone(0,'drop').length,off=k.state.ball.offense;k.playEvent(id);assert.equal(asks,1);assert.equal(k.zone(0,'drop').length,drop);assert.equal(k.state.ball.offense,off);
 }
 return forms.size;
}
function testProtectCard(catalog,card){
 if(card.profiles[0].activation.trigger?.event==='character_entry')return; // entry-observer tests cover declaration/short/wrong role
 const p=card.profiles[0],phase=p.activation.skill_type==='passive'?p.activation.trigger.destination_any[0]:p.activation.activation_phases[0];
 for(const variant of ['positive','decline','short']){
  const {k,id,entryReason='rule'}=require('./batch-smoke').fixture(card,p,phase,{rich:true,conditioned:true,expanded:true,max:true,key:'positive'},0,catalog),choose=k.choose;
  if(variant==='decline')k.choose=r=>r.kind==='activate_payment'?false:choose(r);
  if(variant==='short')for(const n of I.nodes(p).filter(n=>n.kind==='pay_guts'))for(const area of n.areas==='source_area'?[phase]:n.areas==='court'?['serve','block','receive','toss','attack']:n.areas)for(const x of [...k.zone(0,area)].slice(0,area===phase?k.zone(0,area).length:-1))k._atomic(()=>k._move(x,0,'deck',k._context(id,0)));
  const invoke=()=>p.activation.skill_type==='event'?k.playEvent(id):p.activation.skill_type==='active'?k.useSkill(id):k.enter(id,phase,{reason:entryReason}),before=k.snapshot();
  try{invoke();}catch(e){if(e.message!=='OPEN-EVENT-NO-CHANGE'&&!(variant==='short'&&e.code==='ILLEGAL_ACTION'))throw e;assert.deepEqual(k.snapshot(),before);}
  const after=k.snapshot(),protectedEffects=after.effects.slice(before.effects.length).filter(e=>e.kind==='protect');
  if(variant==='positive')assert(protectedEffects.length||I.nodes(p).some(n=>n.kind==='watch'),card.card_no+' must protect or create its deferred protection');
  k.restore(before);try{invoke();}catch(e){if(e.message!=='OPEN-EVENT-NO-CHANGE'&&!(variant==='short'&&e.code==='ILLEGAL_ACTION'))throw e;}assert.deepEqual(k.snapshot(),after,card.card_no+' protection replay');
 }
}
module.exports={testProtect,testProtectCard,num};
