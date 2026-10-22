'use strict';
const assert=require('node:assert/strict'),{Match}=require('./match'),H=require('../host-choice');
const library=require('../card-library'),basics=Object.values(library.data.cards).filter(c=>library.permission(c.code).kind==='basic').slice(0,9).map(c=>c.code);
const added=['P01-066','P01-090','P02-058','P03-083','P04-007','P04-064','P04-100','PR-080','PR-084','P03-020','P03-041','P03-064','P04-070'];const events=added.filter(c=>library.card(c).kind==='E').slice(0,3),chars=added.filter(c=>library.card(c).kind==='C');const deck=['PR-051','PR-051',...events.flatMap(c=>[c,c]),...chars.flatMap(c=>Array(3).fill(c)).slice(0,32)];for(let i=0;deck.length<40;i++)deck.push(basics[i%basics.length]);let total=0;
for(const seed of [7,11,19]){
 const m=new Match({seed,decks:[deck,deck]});let steps=0,seen=new Set();
 while(m.snapshot().match.phase!=='finished'&&steps++<1800){let r=m.request(0)||m.request(1);assert(r);for(const e of m._kernel.state.effects.filter(e=>e.kind==='protect'))seen.add(e.id);if(seen.size){const saved=m.snapshot();m.restore(saved);r=m.request(0)||m.request(1);}const a=H.aiAnswer(r);if(r.kind==='event'){const p=r.options.find(o=>o.card?.cardNo==='HV-PR-051');if(p)a.value=p.value;}assert(H.validate(r,a).ok);m.dispatch(a);}
 assert.equal(m.snapshot().match.phase,'finished');total+=seen.size;console.log('protect match seed '+seed+': '+steps+' decisions / '+seen.size+' observed protections / valid C choices and restore passed');
}
assert(total>0);
