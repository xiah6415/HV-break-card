'use strict';
// Exercise live card profiles through actual effect-entry receipts and queues.
const assert=require('node:assert/strict'),{Kernel}=require('./core'),R=require('./runtime-data'),F=require('./frequent-node-tests');
const make=()=>new Kernel({catalog:R.catalog,ruleIds:R.ruleIds,fingerprint:R.fingerprint,mode:'live',choose:F.choose});
let cases=0,profiles=new Set(),excluded=[];
for(const card of R.catalog.cards){const p=card.profiles[0],a=p.activation,t=a?.trigger;if(a?.skill_type!=='passive'||!['self_entry','self_entry_cover'].includes(t?.event)||!p.runtime_approved)continue;
 const areas=t.event==='self_entry'?[...new Set(t.destination_any.flatMap(x=>x==='court'?['serve','block','receive','toss','attack']:x))]:['serve','receive','toss','attack','block'];
 for(const area of areas)for(const from of ['hand','drop','guts']){
  const k=make();k.state.turn.phase=area;k.state.ball={kind:'attack',offense:8,owner:1};const source=k.addCard('HV-P02-087',0,'event');for(let i=0;i<8;i++)k.addCard('HV-D01-009',0,'deck');for(let i=0;i<6;i++)k.addCard('HV-D01-009',0,area);
  if(t.event==='self_entry_cover'){const base=R.catalog.cards.find(c=>c.profiles[0].variants[0].printed.name===t.filters.covered_names[0]);assert(base);k.addCard(base.card_no,0,area);}
  const id=k.addCard(card.card_no,0,from==='guts'?area:from);if(from==='guts'){const list=k.zone(0,area);list.unshift(list.pop());}
  if(!k._entryOptions(id,0,area,false,'skill').names.length){excluded.push(card.card_no+' '+area+' '+from);continue;}
  k._atomic(()=>{k._enter(id,0,area,k._context(source,0),'skill');k._drain();});assert(k.state.events.some(e=>e.type==='resolve_trigger'&&!e.generated),card.card_no+' '+area+' '+from);assert.equal(k.state.queue.length,0);k.assertState();cases++;profiles.add(p.profile_id);
 }
}
// P02-087 must finish the Event bonus, then offer both entry skills in either
// order. Costs are paid in the destination area, not wherever the Guts came from.
let twins=0;
for(const reverse of [false,true])for(const cross of [false,true])for(const guts of [2,3])for(const decline of [false,true]){
 const k=make();k.state.turn.phase='attack';const event=k.addCard('HV-P02-087',0,'hand');for(let i=0;i<6;i++)k.addCard('HV-D01-009',0,'deck');const entered=[],seen=[];
 for(const [code,role,base,origin]of [['HV-P02-016','toss','HV-P01-063','serve'],['HV-P02-020','attack','HV-P01-064','receive']]){
  if(cross){const id=k.addCard(code,0,origin);k.addCard('HV-D01-009',0,origin);entered.push(id);for(let i=0;i<guts-1;i++)k.addCard('HV-D01-009',0,role);k.addCard(base,0,role);}
  else {const id=k.addCard(code,0,role);entered.push(id);for(let i=0;i<guts-1;i++)k.addCard('HV-D01-009',0,role);k.addCard(base,0,role);}
 }
 const printed=entered.map((id,i)=>k.card(id).printed.parameters[i?'attack':'toss']);let order=0;
 k.choose=r=>{seen.push(r);if(r.kind==='trigger_order'){assert.equal(r.options.length,2);assert(k.state.effects.some(e=>e.source?.id===event&&e.kind==='numeric'),'Event bonus precedes entry skills');order++;return reverse?r.options.at(-1):r.options[0];}if(r.kind==='activate_payment')return !decline;if(r.kind==='target')return [entered[0]];if(r.kind==='parameter')return 'serve';return F.choose(r);};
 const before=k.snapshot();k.playEvent(event);assert.equal(order,1);assert.equal(k.state.queue.length,0);assert(entered.every(id=>k.card(id).entrySkillName==='どんぴしゃり'));assert.equal(k.state.events.filter(e=>e.type==='resolve_trigger').length,2);
 const works=guts===3&&!decline;assert.equal(k.parameter(entered[0],'toss'),printed[0]+(works?2:0));assert.equal(k.parameter(entered[1],'attack'),printed[1]+(works?4:0));assert.equal(seen.filter(r=>r.kind==='activate_payment').length,guts===3?2:0);assert.equal(seen.filter(r=>r.kind==='guts').length,works?2:0);assert.equal(k.zone(0,'drop').length,works?6:0);
 assert.equal(k.state.effects.some(e=>e.kind==='invalid'&&e.source?.id===entered[0]),works);assert.equal(k.state.effects.some(e=>e.kind==='ban'&&e.scope?.max_count===2&&e.source?.id===entered[1]),works);const after=k.snapshot();k.assertState();k.restore(before);seen.length=0;order=0;k.playEvent(event);assert.deepEqual(k.snapshot(),after,'Replay preserves fees, order and Event-origin bonuses');twins++;
}
// All currently scripted Miya versions that P02-087 can place into toss/attack.
let versions=0;
for(const setter of ['P02-016','P02-017','P03-021','D03-001'])for(const attacker of ['P02-020','P02-021','P03-041','D03-002','PR-048']){
 const k=make();k.state.turn.phase='attack';const event=k.addCard('HV-P02-087',0,'hand');
 for(let i=0;i<8;i++)k.addCard('HV-D01-009',0,'deck');
 for(const no of ['P02-015','P02-019','P02-023','P02-025','P02-028','P02-031','P03-087'])k.addCard('HV-'+no,0,'drop');
 k.addCard('HV-D03-013',0,'event');
 const ids=[];for(const [code,area,top]of [[setter,'toss','P01-063'],[attacker,'attack','P01-064']]){ids.push(k.addCard('HV-'+code,0,area));for(let i=0;i<6;i++)k.addCard('HV-D01-009',0,area);k.addCard('HV-'+top,0,area);}
 k.playEvent(event);for(const id of ids)assert(k.state.publicLog.some(e=>e.type==='skill_resolved'&&e.source===id),setter+' / '+attacker+' should perform both affordable entry skills');assert.equal(k.state.queue.length,0);k.assertState();versions++;
}
console.log('Miya versions: '+versions+' full P02-087 setter/attacker combinations performed both entry skills');
console.log('effect entry: '+profiles.size+' live profiles / '+cases+' legal hand/drop/Guts routes; '+excluded.length+' illegal routes excluded; '+twins+' P02-087 order/cross-area/payment/decline cases passed');
if(excluded.length)console.log('Excluded: '+excluded.join(', '));
