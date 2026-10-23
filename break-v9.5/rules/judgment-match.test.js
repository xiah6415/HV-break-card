'use strict';
const assert=require('node:assert/strict'),{Match}=require('./match'),H=require('../host-choice');
const deck=['P02-039','P02-040','P01-001','P01-009','D01-009','D04-003','P01-004','P03-048','D04-001','P01-051'].flatMap(c=>Array(4).fill(c));let failures=0,registered=new Set();
for(const seed of [7,11,19]){
 const m=new Match({seed,decks:[deck,deck]}),k=m._kernel;let steps=0,restored=false;
 while(m.snapshot().match.phase!=='finished'&&steps++<2000){let r=m.request(0)||m.request(1);assert(r);if(r.kind==='lossConfirm'&&r.context.reason?.includes('必定失敗'))failures++;if(r.kind==='block'){if(!restored){const saved=m.snapshot();m.restore(saved);r=m.request(0)||m.request(1);restored=true;}}
  let a=H.aiAnswer(r);if(r.kind==='defend'&&r.options.some(o=>o.value==='block'))a=H.makeAnswer(r,'block');
  if(['setter','attacker'].includes(r.kind)){const v=r.options.find(o=>o.card?.cardNo===(r.kind==='setter'?'HV-P02-040':'HV-P02-039'));if(v)a=H.makeAnswer(r,v.value);}
  if(r.kind==='block')a=H.makeAnswer(r,{cards:[r.options[0].value],center:r.options[0].value});

  assert(H.validate(r,a).ok);m.dispatch(a);for(const e of k.state.effects)if(e.kind==='judgment_failure')registered.add(seed+':'+e.id);
 }
 assert.equal(m.snapshot().match.phase,'finished');console.log('forced judgment match seed '+seed+': '+steps+' decisions / complete local game passed');
}
assert(registered.size>0,'Full matches must actually register the forced-failure skill');
assert(failures>0,'Full matches must actually reach forced block Loss confirmation');
console.log('forced judgment full matches: '+registered.size+' rules / '+failures+' forced Loss confirmations passed');
