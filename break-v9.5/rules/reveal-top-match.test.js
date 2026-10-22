'use strict';
const assert=require('node:assert/strict'),{Match}=require('./match'),H=require('../host-choice');
const deck=['P01-010','P01-092','P01-093','D01-009','D04-003','P01-004','P03-048','D04-001','P02-048','P01-034'].flatMap(c=>Array(4).fill(c));let flips=0;
for(const seed of [7,11,19]){
 const m=new Match({seed,decks:[deck,deck]}),k=m._kernel;let steps=0,restored=false;
 while(m.snapshot().match.phase!=='finished'&&steps++<2000){let r=m.request(0)||m.request(1);assert(r);if(r.kind==='revealResult'){flips++;if(!restored){const saved=m.snapshot();m.restore(saved);r=m.request(0)||m.request(1);restored=true;}}
  let a=H.aiAnswer(r);if(r.kind==='event'){const v=r.options.find(o=>o.value!==null);if(v)a=H.makeAnswer(r,v.value);}if(r.kind==='serve'){const o=r.options.find(o=>o.card?.cardNo==='HV-P01-010');if(o)a=H.makeAnswer(r,o.value);}
  assert(H.validate(r,a).ok);m.dispatch(a);
 }
 assert.equal(m.snapshot().match.phase,'finished');console.log('reveal match seed '+seed+': '+steps+' decisions / '+k.state.publicLog.filter(e=>e.type==='deck_view').length+' public views / complete local game passed');
}
assert(flips>0,'Full matches must actually confirm a public reveal');
