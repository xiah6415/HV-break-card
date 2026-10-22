'use strict';
const assert=require('node:assert/strict'),{Match}=require('./match'),H=require('../host-choice');
const deck=['P01-084','P02-088','P02-097','BP-013'].flatMap(c=>Array(2).fill(c)).concat(['P02-020','P02-031','P04-037','P04-078','P01-035','P01-017','D01-001','D01-005'].flatMap(c=>Array(4).fill(c)));let total=0;
for(const seed of [7,11,1]){
 const m=new Match({seed,decks:seed===1?Array(2).fill(['P01-002','P01-035','P02-020','P02-031','P01-017','D01-001','D01-005','D04-003','P04-037','P04-078'].flatMap(c=>Array(4).fill(c))):[deck,deck]});let steps=0,bans=new Set();
 while(m.snapshot().match.phase!=='finished'&&steps++<1800){let r=m.request(0)||m.request(1);assert(r);for(const e of m._kernel.state.effects.filter(e=>e.kind==='ban'))bans.add(e.id);if(bans.size){const saved=m.snapshot();m.restore(saved);r=m.request(0)||m.request(1);}const a=H.aiAnswer(r);assert(H.validate(r,a).ok);m.dispatch(a);}
 assert.equal(m.snapshot().match.phase,'finished');total+=bans.size;console.log('ban match seed '+seed+': '+steps+' decisions / '+bans.size+' observed bans / valid C choices and restore passed');
}
assert(total>0,'Full games must exercise an actual restriction');
