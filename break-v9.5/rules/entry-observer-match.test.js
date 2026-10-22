'use strict';
const assert=require('node:assert/strict'),{Match}=require('./match'),H=require('../host-choice');
const codes=['P02-010','P03-016','P03-033','P03-094','P04-011','P04-028','P04-034','P04-056','PR-023','D01-009'],deck=codes.flatMap(c=>Array(4).fill(c));let total=0;
for(const seed of [7,11,19]){
 const m=new Match({seed,decks:[deck,deck]}),k=m._kernel;let steps=0,restored=false;
 while(m.snapshot().match.phase!=='finished'&&steps++<1500){let r=m.request(0)||m.request(1);assert(r);if(['activate_payment','trigger_order','reveal'].includes(r.kind)&&!restored){const saved=m.snapshot();m.restore(saved);r=m.request(0)||m.request(1);restored=true;}const a=H.aiAnswer(r);assert(H.validate(r,a).ok);m.dispatch(a);}
 assert.equal(m.snapshot().match.phase,'finished');const triggers=k.state.events.filter(e=>e.type==='resolve_trigger'&&!e.generated).length;total+=triggers;console.log('observer match seed '+seed+': '+steps+' C decisions / '+triggers+' actual triggers / local restore passed');
}
assert(total>0,'Full matches must exercise actual passive effects');
