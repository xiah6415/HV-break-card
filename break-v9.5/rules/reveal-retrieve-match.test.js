'use strict';
const assert=require('node:assert/strict'),{Match}=require('./match'),H=require('../host-choice');
const deck=['D04-013','P01-092','D04-003','P01-004','P03-048','D04-001','D01-009','P01-022','P01-030','P01-020'].flatMap(c=>Array(4).fill(c));let flips=0;
for(const seed of [7,11,19]){
 const m=new Match({seed,decks:[deck,deck]}),k=m._kernel;let steps=0,restored=false;
 while(m.snapshot().match.phase!=='finished'&&steps++<2000){let r=m.request(0)||m.request(1);assert(r);if(r.kind==='revealResult'){if(r.source?.cardNo==='HV-D04-013')flips++;if(!restored){const saved=m.snapshot();m.restore(saved);r=m.request(0)||m.request(1);restored=true;}}
  let a=H.aiAnswer(r);if(r.kind==='event'){const v=r.options.find(o=>o.value!==null);if(v)a=H.makeAnswer(r,v.value);}if(r.kind==='optional'&&r.options.some(o=>o.value===true))a=H.makeAnswer(r,true);
  assert(H.validate(r,a).ok);m.dispatch(a);
 }
 assert.equal(m.snapshot().match.phase,'finished');console.log('reveal retrieval match seed '+seed+': '+steps+' decisions / '+k.state.publicLog.filter(e=>e.type==='deck_view').length+' public views / complete local game passed');
}
assert(flips>0,'Full matches must actually confirm a public reveal for a playable reveal skill');
