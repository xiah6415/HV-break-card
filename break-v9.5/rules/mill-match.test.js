'use strict';
const assert=require('node:assert/strict'),{Match}=require('./match'),H=require('../host-choice');
const deck=['P01-051','P02-067','P04-039','P04-043','P04-045','P04-051','P04-062','P04-095','PR-027','D01-009'].flatMap(c=>Array(4).fill(c));let total=0;
for(const seed of [7,11,19]){
 const m=new Match({seed,decks:[deck,deck]}),k=m._kernel;let steps=0,choices=0;
 while(m.snapshot().match.phase!=='finished'&&steps++<1800){let r=m.request(0)||m.request(1);assert(r);let answer;
  if(r.kind==='mill_count'){choices++;assert(r.options.every(o=>Number.isInteger(o.value)&&!o.card));const saved=m.snapshot();m.restore(saved);r=m.request(0)||m.request(1);answer=H.makeAnswer(r,Math.max(...r.options.map(o=>o.value)));}else answer=H.aiAnswer(r);
  assert(H.validate(r,answer).ok);m.dispatch(answer);
 }
 assert.equal(m.snapshot().match.phase,'finished');const milled=k.state.events.filter(e=>e.type==='move'&&e.from.endsWith('.deck')&&e.to.endsWith('.drop')).length;total+=milled;console.log('mill match seed '+seed+': '+choices+' count choices / '+milled+' milled cards / valid C decisions and restore passed');
}
assert(total>0);
