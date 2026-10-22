'use strict';
const assert=require('node:assert/strict'),T=require('./self-entry-tests'),catalog=require('./data/cards.json');
assert.equal(T.testEnterSelf(catalog),3);
for(const code of T.codes){const card=catalog.cards.find(c=>c.card_no==='HV-'+code);T.testSelfCard(catalog,card);}
// QA1800/1801: a same-name center already present blocks the side entry.
{
 const card=catalog.cards.find(c=>c.card_no==='HV-P03-044'),f=T.setup(catalog,card),{k,id,target}=f;k.card(target).printed.name=k.card(id).printed.name;
 T.invoke(f);assert.equal(k.card(id).zone,'0.attack');const req=k.state.decisions.find(d=>d.request.kind==='activate_payment').request;assert(req.ineffectiveReason);
}
// The physical source cannot be replaced by a copy after leaving and returning.
{
 const card=catalog.cards.find(c=>c.card_no==='HV-D02-004'),f=T.setup(catalog,card),{k,id}=f,ctx=k._context(id,0),n=card.profiles[0].program.steps[0].then.steps[0];k._atomic(()=>{k._move(id,0,'drop',ctx);k._move(id,0,'attack',ctx);});assert.equal(k._atomic(()=>k._run(n,ctx)),false);assert.equal(k.card(id).zone,'0.attack');
}
console.log('self entry: 3 forms, 5 cards, QA1758/1800/1113/1876, conditions/costs/side capacity/restrictions/stale source and replay passed');

// QA1760/1761: no shared school, no characters or only three Events fail;
// declaration cost is still paid exactly once and never refunded.
for(const mode of ['three_events','empty_court','wrong_school']){
 const f=T.setup(catalog,catalog.cards.find(c=>c.card_no==='HV-P03-011')),{k,id}=f;
 if(mode==='three_events')while(k.zone(0,'event').length>3)k._atomic(()=>k._move(k.top(0,'event'),0,'deck',k._context(id,0)));
 if(mode==='empty_court')for(const area of ['serve','block','receive','toss','attack','side:0','side:1'])for(const x of [...k.zone(0,area)])k._atomic(()=>k._move(x,0,'deck',k._context(id,0)));
 if(mode==='wrong_school')k.addCard('HV-D01-009',0,'attack');
 const start=k.state.events.length;assert.equal(T.invoke(f).performed,false);assert.equal(k.card(id).zone,'0.drop');assert.equal(k.state.events.slice(start).filter(e=>e.type==='move'&&e.id===id&&e.reason==='declaration_cost').length,1);
}
