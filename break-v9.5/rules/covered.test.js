'use strict';
const assert=require('node:assert/strict'),T=require('./covered-tests'),I=require('./node-inventory'),F=require('./frequent-node-tests'),catalog=require('./data/cards.json');
const cards=catalog.cards.filter(c=>c.profiles[0].activation?.trigger?.event==='source_covered');
for(const c of cards)T.testCoveredCard(catalog,c);
for(const [code,entrant]of [['P01-028','P01-025'],['P01-023','P02-061'],['P04-048','P04-046']])for(const ownFirst of [true,false]){
 const {k,id,target,dest}=T.chain(catalog,code,entrant,ownFirst),before=k.snapshot();k.enter(target,dest);const after=k.snapshot();
 const decisions=after.decisions.slice(before.decisions.length);assert(decisions.some(d=>d.request.kind==='trigger_order'),'Player chooses the order');
 if(code==='P01-028'){assert.equal(k.card(id).zone,'0.drop');assert.equal(k.parameter(target,'attack'),k.card(target).printed.parameters.attack+1,'Yamamoto resolves even after paying him as Guts');}
 if(code==='P01-023'){assert.equal(k.parameter(target,'receive'),k.card(target).printed.parameters.receive+(ownFirst?3:2));assert.equal(decisions.filter(d=>d.request.kind==='activate_payment').length,1,'Already-paid Yaku cannot pay himself again; Yaku-first leaves insufficient entry Guts');}
 if(code==='P04-048')assert(k.state.effects.some(e=>e.kind==='watch'&&e.source.id===id),'Covered source creates its watch even after being paid');
 k.restore(before);k.enter(target,dest);assert.deepEqual(k.snapshot(),after,'Both trigger orders replay exactly');
}
// Character invalidation does not apply to a skill of a covered Guts card (QA1144).
{
 const c=cards.find(c=>c.card_no==='HV-P01-023'),{k,id,target,dest}=T.setup(catalog,c);
 k.resolveProgram({kind:'invalidate_skill',actor:'self',selector:{type:'character'},duration:'this_turn'},0,id);k.enter(target,dest);
 assert.equal(k.parameter(target,'receive'),k.card(target).printed.parameters.receive+2);
}
// Filtering uses the new entrant's effective name and all school tags.
{
 const c=cards.find(c=>c.card_no==='HV-P01-023'),{k,id,target,dest}=T.setup(catalog,c);
 const enter=k._applyEntryName;k._applyEntryName=function(x,...args){enter.call(this,x,...args);if(x===target)this.effect('rename',{target:this.reference(x),name:'夜久衛輔'},this._context(x,0));};k.enter(target,dest);
 assert.equal(k.card(id).zone,'0.receive');assert.equal(k.parameter(target,'receive'),k.card(target).printed.parameters.receive);
}
{
 const c=cards.find(c=>c.card_no==='HV-P01-047'),{k,target,dest}=T.setup(catalog,c);k.card(target).printed.affiliation_tags.unshift('烏野');k.enter(target,dest);assert.equal(k.parameter(target,'attack'),k.card(target).printed.parameters.attack+1);
}
// Covered protection is tied to the actual new character, and expires at cleanup.
{
 const c=cards.find(c=>c.card_no==='HV-P04-021'),{k,id,target,dest}=T.setup(catalog,c);k.enter(target,dest);
 const num={kind:'numeric',target:'source',target_scope:{mode:'single',binding:'reference',membership:'snapshot_on_resolution'},parameter:'attack',operation:'add',value:-2};
 const base=k.parameter(target,'attack');k.resolveProgram(num,0,target);assert.equal(k.parameter(target,'attack'),base);
 const snap=k.snapshot();k.endTurn();k.beginTurn(1);k.resolveProgram(num,0,target);assert.equal(k.parameter(target,'attack'),base-2);k.restore(snap);
 k._atomic(()=>{k._move(id,0,'drop',k._context(id,0));k._move(target,0,'drop',k._context(target,0));});k.enter(target,dest,{reason:'skill'});k.resolveProgram(num,0,target);assert.equal(k.parameter(target,'attack'),base-2,'Re-entered instance is not protected');
}
// Printed block >=3 counts each actual centre/side entry, irrespective of modifiers.
{
 const c=cards.find(c=>c.card_no==='HV-P04-048'),{k,id,target,dest}=T.setup(catalog,c);k.enter(target,dest);k._atomic(()=>k._move(id,0,'drop',k._context(id,0)));k.endTurn();k.beginTurn(1,'block');
 const defs=catalog.cards.filter(c=>!c.profiles[0].program&&Number.isInteger(c.profiles[0].variants[0].printed.parameters.block)&&c.profiles[0].variants[0].printed.parameters.block>=3),chosen=[];
 for(const d of defs)if(!chosen.some(c=>c.profiles[0].variants[0].printed.name===d.profiles[0].variants[0].printed.name)){chosen.push(d);if(chosen.length===3)break;}
 const members=chosen.map(c=>k.addCard(c.card_no,1,'hand')),before=k.zone(0,'hand').length;const apply=k._applyEntryName;k._applyEntryName=function(x,...args){apply.call(this,x,...args);if(members.includes(x))this._numeric({kind:'numeric',target:'source',target_scope:{mode:'single',binding:'reference',membership:'snapshot_on_resolution'},parameter:'block',operation:'add',value:-4},this._context(x,1));};k.enterBlock(members,members[0]);assert.equal(k.zone(0,'hand').length,before+3);
 const low=k.addCard('HV-D01-009',1,'hand');k.card(low).printed.parameters.block=2;k.card(low).printed.name='低印刷值';k._applyEntryName=function(x,...args){apply.call(this,x,...args);if(x===low)this._numeric({kind:'numeric',target:'source',target_scope:{mode:'single',binding:'reference',membership:'snapshot_on_resolution'},parameter:'block',operation:'add',value:5},this._context(x,1));};k.enter(low,'block');assert.equal(k.zone(0,'hand').length,before+3);
}
console.log('covered entry: 5 cards, actual trigger/filter/cost cases, both printed entry orders, invalidation, source departure, effective names, protection expiry and three-blocker watch passed');
