'use strict';
const assert=require('node:assert/strict'),{Match}=require('./match'),H=require('../host-choice');
const library=require('../card-library'),basics=Object.values(library.data.cards).filter(c=>library.permission(c.code).kind==='basic').slice(0,9).map(c=>c.code);
const deck=['P01-082','P02-090','P03-093','P03-098','P04-087','P04-098','D02-011','P04-087'].concat(['P03-001','D03-003'].flatMap(c=>Array(3).fill(c)),basics.flatMap((c,i)=>Array(i===8?2:3).fill(c)));let total=0;
for(const seed of [7,11,19]){
 const m=new Match({seed,decks:[deck,deck]});let steps=0,seen=new Set();
 while(m.snapshot().match.phase!=='finished'&&steps++<1800){let r=m.request(0)||m.request(1);assert(r);if(r.context?.effectModes){assert(r.options.every(o=>!o.label.includes('牌庫底')));assert(r.prompt.includes('選擇1項效果'));seen.add(r.requestId);}if(seen.size){const saved=m.snapshot();m.restore(saved);r=m.request(0)||m.request(1);}const a=H.aiAnswer(r);assert(H.validate(r,a).ok);m.dispatch(a);}
 assert.equal(m.snapshot().match.phase,'finished');total+=seen.size;console.log('mode match seed '+seed+': '+steps+' decisions / '+seen.size+' observed mode choices / valid C choices and restore passed');
}
assert(total>0);
