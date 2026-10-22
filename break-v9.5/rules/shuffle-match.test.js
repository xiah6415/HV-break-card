'use strict';
const assert=require('node:assert/strict'),{Match}=require('./match'),H=require('../host-choice');
const deck=['P01-034','PR-024','P04-093','P04-094','D04-003','D01-009','P01-004','P03-048','D04-001','P02-048'].flatMap(c=>Array(4).fill(c));let shuffles=0;
for(const seed of [7,11,19]){
 const m=new Match({seed,decks:[deck,deck]}),k=m._kernel;let steps=0,restored=false;
 while(m.snapshot().match.phase!=='finished'&&steps++<2000){let r=m.request(0)||m.request(1);assert(r);if(k.state.publicLog.some(e=>e.type==='deck_shuffled')&&!restored){const saved=m.snapshot();m.restore(saved);r=m.request(0)||m.request(1);restored=true;}
  let a=H.aiAnswer(r);if(r.kind==='event'){const v=r.options.find(o=>o.value!==null);if(v)a=H.makeAnswer(r,v.value);}if(['serve','setter'].includes(r.kind)){const o=r.options.find(o=>o.card?.cardNo==='HV-'+(r.kind==='serve'?'P01-034':'PR-024'));if(o)a=H.makeAnswer(r,o.value);}
  assert(H.validate(r,a).ok);m.dispatch(a);
 }
 assert.equal(m.snapshot().match.phase,'finished');const n=k.state.publicLog.filter(e=>e.type==='deck_shuffled').length;shuffles+=n;console.log('shuffle match seed '+seed+': '+steps+' decisions / '+n+' actual shuffles / RNG '+k.state.match.rng.calls+' / complete game passed');
}
assert(shuffles>0,'Full matches must exercise real shuffle execution');
