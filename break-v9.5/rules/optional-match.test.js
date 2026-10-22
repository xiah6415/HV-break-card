'use strict';
const assert=require('node:assert/strict'),{Match}=require('./match'),H=require('../host-choice');
const library=require('../card-library'),basics=Object.values(library.data.cards).filter(c=>library.permission(c.code).kind==='basic').slice(0,9).map(c=>c.code);
const deck=['P02-004','P02-064'].flatMap(c=>Array(3).fill(c)).concat(Array(4).fill('BP-013'),Array(4).fill('D01-012'),basics.flatMap((c,i)=>Array(i===8?2:3).fill(c)));let total=0;
for(const seed of [7,11,19]){
 const m=new Match({seed,decks:[deck,deck]});let steps=0,seen=new Set();
 while(m.snapshot().match.phase!=='finished'&&steps++<1800){let r=m.request(0)||m.request(1);assert(r);if(r.kind==='optional'){assert(r.prompt.includes('是否執行'));seen.add(r.requestId);}if(seen.size){const saved=m.snapshot();m.restore(saved);r=m.request(0)||m.request(1);}const a=H.aiAnswer(r);assert(H.validate(r,a).ok);m.dispatch(a);}
 assert.equal(m.snapshot().match.phase,'finished');total+=seen.size;console.log('optional match seed '+seed+': '+steps+' decisions / '+seen.size+' observed optional choices / valid C choices and restore passed');
}
assert(total>0);
