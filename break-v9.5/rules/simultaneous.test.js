'use strict';
const assert=require('node:assert/strict'),T=require('./simultaneous-tests'),catalog=require('./data/cards.json');
assert.equal(T.testGroup(catalog),1);for(const code of T.codes)T.testCard(catalog,catalog.cards.find(c=>c.card_no==='HV-'+code));
// QA1368/1369: both entry skills are pending after the Event's bonus;
// their controller can choose either order, never interrupt the Event itself.
for(const reverse of [false,true]){
 const f=T.setup(catalog,catalog.cards.find(c=>c.card_no==='HV-P02-087')),{k}=f;
 for(const [i,code]of ['HV-P02-016','HV-P02-020'].entries()){
  const old=f.entries[i],c=k.card(old),id=k.addCard(code,0,c.zone.split('.')[1]),zone=k.zone(0,c.zone.split('.')[1]);zone.splice(zone.indexOf(id),1);zone.splice(zone.indexOf(old),0,id);k._atomic(()=>k._move(old,0,'deck',k._context(f.id,0)));f.entries[i]=id;
 }
 const choose=k.choose;let sorted=false;k.choose=r=>{if(r.kind==='trigger_order'){assert.equal(r.options.length,2);assert(k.state.effects.some(e=>e.kind==='numeric'),'Event bonus before any entry skill');assert(f.entries.every(id=>k.role(id)!=='guts'));sorted=true;return reverse?r.options.at(-1):r.options[0];}if(r.kind==='activate_payment')return false;return choose(r);};T.invoke(f);assert(sorted);assert.equal(k.state.events.filter(e=>e.type==='resolve_trigger').length,2);
}
console.log('simultaneous entry: complete-group checkpoint, original-skill priority, player trigger order, any-area Guts, side fees/limits, restrictions, partial/declined choices and replay passed');
