'use strict';
const assert=require('node:assert/strict'),{Match}=require('./match'),H=require('../host-choice');
const deck=['P01-032','P02-016','P02-029','P02-066','P03-009','P03-053','P03-063','P03-073','P04-013','P04-020'].flatMap(c=>Array(3).fill(c)).concat(['P03-092','P03-092'],['D01-001','D01-009'].flatMap(c=>Array(4).fill(c)));let total=0;
for(const seed of [7,11,19]){
 const m=new Match({seed,decks:[deck,deck]});let steps=0,seen=new Set();
 while(m.snapshot().match.phase!=='finished'&&steps++<1800){let r=m.request(0)||m.request(1);assert(r);for(const e of m._kernel.state.effects.filter(e=>e.kind==='invalid'))seen.add(e.id);if(seen.size){const saved=m.snapshot();m.restore(saved);r=m.request(0)||m.request(1);}const a=H.aiAnswer(r);assert(H.validate(r,a).ok);m.dispatch(a);}
 assert.equal(m.snapshot().match.phase,'finished');total+=seen.size;console.log('invalid match seed '+seed+': '+steps+' decisions / '+seen.size+' observed invalidations / valid C choices and restore passed');
}
assert(total>0);
