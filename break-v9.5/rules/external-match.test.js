'use strict';
const assert=require('node:assert/strict'),{Match}=require('./match'),H=require('../host-choice');
const deck=['P02-048','PR-037','D01-009','D04-003','P01-004','D04-001','P03-048','D01-001','PR-050','PR-063'].flatMap(c=>Array(4).fill(c));let actions=0,flips=0;
for(const seed of [7,11,19]){
 const m=new Match({seed,decks:[deck,deck]}),k=m._kernel;let steps=0,restored=false;
 while(m.snapshot().match.phase!=='finished'&&steps++<2000){let r=m.request(0)||m.request(1);assert(r);if(['external_action','external_result'].includes(r.kind)){actions++;if(r.kind==='external_result')flips++;if(!restored){const saved=m.snapshot();m.restore(saved);r=m.request(0)||m.request(1);restored=true;}}
  let a=H.aiAnswer(r);if(r.kind==='event'){const v=r.options.find(o=>o.value!==null);if(v)a=H.makeAnswer(r,v.value);}if(r.kind==='defend'&&r.options.some(o=>o.value==='block'))a=H.makeAnswer(r,'block');if(['attacker','block'].includes(r.kind)){const o=r.options.find(o=>o.card?.cardNo==='HV-'+(r.kind==='block'?'P02-048':'PR-037'));if(o)a=H.makeAnswer(r,r.kind==='block'?{cards:[o.value],center:o.value}:o.value);}
  assert(H.validate(r,a).ok);m.dispatch(a);
 }
 assert.equal(m.snapshot().match.phase,'finished');console.log('external match seed '+seed+': '+steps+' decisions / RNG '+k.state.rng.calls+' / full local match passed');
}
assert(actions>0&&flips>0,'Full matches must actually exercise physical confirmations and flips');
