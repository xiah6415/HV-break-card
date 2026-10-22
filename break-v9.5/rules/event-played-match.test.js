'use strict';
const assert=require('node:assert/strict'),{Match}=require('./match'),H=require('../host-choice'),L=require('../card-library');
const basics=Object.values(L.data.cards).filter(c=>L.permission(c.code).kind==='basic').slice(0,8).map(c=>c.code),deck=['P02-007','P03-039','P03-091','P02-082'].flatMap(c=>Array(4).fill(c));for(let i=0;deck.length<40;i++)deck.push(basics[i%basics.length]);let total=0;
for(const seed of [7,11,19]){
 const m=new Match({seed,decks:[deck,deck]});
 // Continue complete matches from a conserved table with a prior serve Event already available as cost.
 for(const player of [0,1]){const id=m._kernel.zone(player,'deck').find(x=>m._kernel.card(x).cardNo==='HV-P03-091');m._kernel._atomic(()=>m._kernel._move(id,player,'event',m._kernel._context(id,player)));}
 let steps=0;const seen=new Set();
 while(m.snapshot().match.phase!=='finished'&&steps++<1800){let r=m.request(0)||m.request(1);assert(r);for(const e of m._kernel.state.effects)if(e.kind==='numeric'&&['HV-P02-007','HV-P03-039'].includes(m._kernel.state.cards[e.source?.id]?.cardNo))seen.add(e.id);const a=H.aiAnswer(r),wanted=r.kind==='serve'?'HV-P03-039':r.kind==='attacker'?'HV-P02-007':r.kind==='event'?r.options.find(o=>['HV-P03-091','HV-P02-082'].includes(o.card?.cardNo))?.card?.cardNo:null,option=r.options?.find(o=>o.card?.cardNo===wanted);if(option)a.value=option.value;assert(H.validate(r,a).ok);m.dispatch(a);}
 assert.equal(m.snapshot().match.phase,'finished');total+=seen.size;console.log('event-played match '+seed+': '+steps+' decisions / '+seen.size+' observed passive bonuses');
}
assert(total>0,'Real complete native matches must execute the new Event-triggered skills');
