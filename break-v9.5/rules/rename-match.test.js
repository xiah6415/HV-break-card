'use strict';
const assert=require('node:assert/strict'),{Match}=require('./match'),H=require('../host-choice');
const deck=[...Array(4).fill('P01-072'),...Array(4).fill('PR-012'),...Array(32).fill('D01-009')],env=(r,value)=>H.makeAnswer(r,value);
{
 const m=new Match({seed:7,decks:[deck,deck]}),k=m._kernel;Object.assign(m._m,{pending:null,continuation:null,phase:'rally',actor:0,turnNo:1,pc:'block'});k.state.turn={id:1,player:0,phase:'block',step:'free'};k.state.ball={kind:'attack',offense:0,owner:1};
 const ids=k.zone(0,'deck').filter(id=>k.card(id).cardNo==='HV-P01-072').slice(0,3);assert.equal(ids.length,3);for(const id of ids)k._atomic(()=>k._move(id,0,'hand',k._context(id,0)));
 m._pump();let r=m.request(0);assert.equal(r.kind,'block');assert(H.checkValue(r,{cards:ids.slice(0,2),center:ids[0]}).ok);assert(!H.checkValue(r,{cards:ids,center:ids[0]}).ok,'Three copies cannot share only two names');
 let selection=H.createSelection(r);selection=H.toggle(r,selection,ids[0]);selection=H.toggle(r,selection,ids[1]);assert.equal(selection.picked.length,2,'Generic selector allows distinct future names');selection=H.toggle(r,selection,ids[2]);assert.equal(selection.picked.length,2);
 m.dispatch(env(r,{cards:ids.slice(0,2),center:ids[0]}));r=m.request(0);assert.equal(r.kind,'name');const first=r.options[0].value;m.dispatch(env(r,first));r=m.request(0);assert.equal(r.kind,'name');assert.equal(r.options.length,1);assert.notEqual(r.options[0].value,first);
 const snapshot=m.snapshot();m.restore(snapshot);r=m.request(0);m.dispatch(env(r,r.options[0].value));assert.equal(k.effectiveName(ids[0]),first);assert.equal(k.effectiveName(ids[1]),'日向・孤爪','Side blocker returns to printed name after cleanup');assert(k.zone(0,'drop').includes(ids[1]));assert.equal(m.request(0).kind,'turnEnd');
}
for(const seed of [7,11,19]){
 const m=new Match({seed,decks:[deck,deck]}),k=m._kernel;let steps=0,names=0;
 while(m.snapshot().match.phase!=='finished'&&steps++<1000){let r=m.request(0)||m.request(1);assert(r);if(r.kind==='name'){names++;const before=m.snapshot();m.restore(before);r=m.request(0)||m.request(1);}const answer=H.aiAnswer(r);assert(H.validate(r,answer).ok);m.dispatch(answer);}
 assert.equal(m.snapshot().match.phase,'finished');assert(names>0);console.log('rename new-core full match seed '+seed+': '+names+' pre-entry choices / valid C decisions / restore passed');
}
