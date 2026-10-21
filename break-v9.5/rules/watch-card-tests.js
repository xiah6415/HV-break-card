'use strict';
const assert=require('node:assert/strict'),I=require('./node-inventory'),{fixture}=require('./batch-smoke'),{matchesPrinted}=require('./batch-fixtures');
function testWatchCard(catalog,card){
 const p=card.profiles[0],watches=I.nodes(p).filter(n=>n.kind==='watch');
 for(const w of watches)for(const expired of [false,true]){
  const phase=p.activation.skill_type==='passive'?p.activation.trigger.destination_any[0]:p.activation.activation_phases[0];
  const {k,id,entryReason='rule'}=fixture(card,p,phase,{rich:true,max:true,conditioned:true,expanded:true,key:'positive'},0,catalog);
  const entryName=I.nodes(p).find(n=>n.kind==='compare'&&n.field==='source.entry_skill_name');
  if(p.activation.skill_type==='event')k.playEvent(id);else if(p.activation.skill_type==='active')k.useSkill(id);else if(entryName){const event=k.addCard(catalog.cards.find(c=>c.profiles[0].variants[0].printed.name===entryName.value).card_no,0,'event');k._atomic(()=>{k._enter(id,0,phase,k._context(event,0),'skill');k._drain();});}else k.enter(id,phase,{reason:entryReason});
  const effect=k.state.effects.find(e=>e.kind==='watch'&&e.then.node_id===w.then.node_id);assert(effect,'Positive card must register watch '+card.card_no);
  // Generated effects remain valid after the declaring card has left play.
  k._atomic(()=>k._move(id,0,'drop',k._context(id,0)));
  if(w.duration==='next_opponent_turn'){k.endTurn();k.beginTurn(1);}
  if(expired){k.endTurn();k.beginTurn(1-k.state.turn.player);}
  const player=expired?k.state.turn.player:effect.actor;
  let target,invoke;
  if(w.event==='character_entry'){
   const f=w.filters,area=f.role==='side_blocker'?'side:0':['block','center_blocker'].includes(f.role)?'block':f.role&&f.role!=='character'?f.role:'attack';
   const filters=Object.fromEntries(Object.entries(f).filter(([key])=>!['role','entry_origins'].includes(key)));
   const other=area==='attack'?k.top(player,'toss'):area==='toss'?k.top(player,'receive'):null;
   const blockers=area==='block'||area.startsWith('side')?['block','side:0','side:1'].map(z=>k.top(player,z)).filter(Boolean):[];
   const def=catalog.cards.find(c=>{const printed=c.profiles[0].variants[0].printed;return !c.profiles[0].program&&matchesPrinted(c.profiles[0],{type:'character',...filters})&&printed.parameters[area.startsWith('side')?'block':area]!=='dash'&&(!other||k.effectiveName(other)!==printed.name)&&!blockers.some(id=>k.effectiveName(id)===printed.name)&&(!area.startsWith('side')||k.top(player,'block')||c.card_no!=='HV-D01-009');});assert(def,'Missing follow-up character '+card.card_no);
   target=k.addCard(def.card_no,player,'hand');if(area.startsWith('side')&&!k.top(player,'block'))k.addCard('HV-D01-009',player,'block');k.advancePhase(area.startsWith('side')?'block':area);
   invoke=()=>k.enter(target,area.startsWith('side')?'block':area,{side:area.startsWith('side')});
  }else if(w.event==='hand_added'){
   target=k.addCard('HV-D01-009',player,'drop');invoke=()=>k.resolveProgram({kind:'move_self',destination:'owner.hand'},player,target);
  }else if(w.event==='loss'){
   const move=I.nodes({program:w.then}).find(n=>n.kind==='move'),def=catalog.cards.find(c=>matchesPrinted(c.profiles[0],move.pool.filters));target=k.addCard(def.card_no,0,'hand');invoke=()=>k.loss(player);
  }else assert.fail('Missing released-card follow-up '+w.event);
  const before=k.snapshot();invoke();const after=k.snapshot(),fired=after.events.slice(before.events.length).filter(e=>e.type==='resolve_trigger'&&e.generated);
  assert.equal(fired.length,expired?0:1,card.card_no+' '+w.event+' expiry='+expired);
  if(!expired){
   const nums=I.nodes({program:w.then}).filter(n=>n.kind==='numeric');
   for(const n of nums){const param=n.parameter==='chosen'?after.effects.findLast(e=>e.kind==='numeric'&&e.target.id===target).parameter:n.parameter;assert.equal(k.parameter(target,param),n.operation==='set'?n.value:k.card(target).printed.parameters[param]+n.value,card.card_no+' exact generated numeric');}
   if(w.event==='hand_added')assert.equal(k.zone(0,'hand').length,before.zones['0.hand'].length+1);
   if(w.event==='loss')assert.equal(k.zone(0,'hand').length,before.zones['0.hand'].length-1);
   if(w.remaining_uses===1)assert.equal(k.state.effects.find(e=>e.id===effect.id).remaining,0);
  }
  k.assertState();k.restore(before);invoke();assert.deepEqual(k.snapshot(),after,'Generated card effect Undo/replay '+card.card_no);
 }
}
module.exports={testWatchCard};
