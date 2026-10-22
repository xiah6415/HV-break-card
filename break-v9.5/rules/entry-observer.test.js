'use strict';
const assert=require('node:assert/strict'),I=require('./node-inventory'),F=require('./frequent-node-tests'),catalog=require('./data/cards.json'),E=require('./entry-observer-tests');
const defs=I.scope(catalog).filter(c=>I.entryKey(c)==='passive:character_entry'),shapes=new Map(defs.map(c=>[JSON.stringify(I.clean(c.profiles[0].activation.trigger)),c]));
let checks=0;
for(const card of shapes.values()){
 const t=card.profiles[0].activation.trigger;
 for(const mode of ['match',...((t.filters.role==='block'||t.filters.role_any?.includes('block'))?['match_side']:[]),...(t.source_role==='block'?['source_side']:[]),'opponent','source_guts',...(t.source_role?['source_wrong_role']:[]),...Object.keys(t.filters).map(f=>'filter:'+f),'pending_drop','pending_hand']){
  const k=F.game(catalog),sourceArea=mode==='source_side'?'side:0':mode==='source_wrong_role'?(t.source_role==='serve'?'toss':'serve'):t.source_role||'receive',source=k.addCard(card.card_no,0,sourceArea),player=mode==='opponent'?1:0;
  if(mode==='source_guts')k.addCard('HV-D01-009',0,sourceArea);
  let role=mode==='match_side'?'side:0':t.filters.role_any?.[0]||t.filters.role||'attack';const target=k.addCard('HV-D01-001',player,'hand'),p=k.card(target).printed;
  p.name=t.filters.names?.[0]||'Entered';p.affiliation_tags=t.filters.tags||['Other'];p.position_tags=['WS'];p.parameters=Object.fromEntries(['serve','block','receive','toss','attack'].map(x=>[x,2]));if(t.filters.printed_attack!==undefined)p.parameters.attack=t.filters.printed_attack;
  let origin='hand';const filter=mode.startsWith('filter:')?mode.slice(7):null;
  if(filter==='names')p.name='Wrong name';if(filter==='tags')p.affiliation_tags=[];if(filter==='printed_attack')p.parameters.attack++;if(filter==='position_has_any_other_than')p.position_tags=[...t.filters.position_has_any_other_than];if(filter==='entry_origins')origin='drop';if(filter==='role'||filter==='role_any')role='serve';
  const dest=role==='block'?'block':role;if(sourceArea.startsWith('side:')||dest.startsWith('side:'))k.addCard('HV-D01-009',player,'block');k._atomic(()=>k._move(target,player,dest,k._context(target,player)));let resolved=0;
  // Isolate trigger admission from child effect nodes, which have their own modules.
  k._admit=()=>{};k._resolveSkill=()=>{resolved++;return false;};
  k._atomic(()=>{k._emit({type:'character_entry',player,card:target,character:k.reference(target),role:k.role(target),origin});
   if(mode.startsWith('pending_'))k._move(source,0,mode==='pending_drop'?'drop':'hand',k._context(source,0));k._drain();});
  assert.equal(resolved,['match','match_side','source_side','pending_drop'].includes(mode)?1:0,card.card_no+' '+mode);checks++;
 }
}
for(const card of defs.filter(c=>require('./modules').eligible(c)))E.testEntryCard(catalog,card);
// Real queued watchers survive the source returning to hand and expire at turn end.
{
 const card=catalog.cards.find(c=>c.card_no==='HV-P03-016'),{k,id,target,dest}=E.setup(catalog,card);k.enter(target,dest);assert.equal(k.card(id).zone,'0.hand');assert(k.state.effects.some(e=>e.kind==='watch'));
 const next=k.addCard(catalog.cards.find(c=>!c.profiles[0].program&&c.profiles[0].variants[0].printed.name==='百沢雄大').card_no,0,'hand');k.state.turn.phase='attack';k.enter(next,'attack');assert.equal(k.parameter(next,'attack'),k.card(next).printed.parameters.attack+2);k.endTurn();assert.equal(k.parameter(next,'attack'),k.card(next).printed.parameters.attack);
}
// Two intrinsic skills share the ordinary player-selected trigger-order queue.
for(const last of [false,true]){
 const card=catalog.cards.find(c=>c.card_no==='HV-P03-033'),{k,id}=E.setup(catalog,card),extra=k.addCard('HV-PR-023',0,'receive');
 for(let i=0;i<2;i++){k.addCard('HV-D01-009',0,'receive');const a=k.zone(0,'receive');a.unshift(a.pop());}
 const gray=catalog.cards.find(c=>!c.profiles[0].program&&c.profiles[0].variants[0].printed.name==='灰羽リエーフ'&&c.profiles[0].variants[0].printed.parameters.attack!=='dash'),target=k.addCard(gray.card_no,0,'hand');let orders=0;const choose=k.choose;
 k.choose=r=>{if(r.kind==='trigger_order'){orders++;return last?r.options.at(-1):r.options[0];}return choose(r);};const start=k.state.events.length;k.enter(target,'attack');
 assert.equal(orders,1);assert.equal(k.state.events.slice(start).filter(e=>e.type==='resolve_trigger'&&!e.generated).length,2);assert.equal(k.top(0,'attack'),id);assert.equal(k.parameter(id,'attack'),4);assert.equal(k.state.queue.length,0);
}
console.log('entry observers: '+shapes.size+' trigger forms / '+checks+' gate and pending cases / eight cards, generated-watch expiry and Undo passed');
