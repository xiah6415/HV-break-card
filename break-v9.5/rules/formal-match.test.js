'use strict';
const assert=require('node:assert/strict'),{Match}=require('./match'),H=require('../host-choice');
const deck=['P01-031','P02-011','P02-035','P02-041','P03-013','P03-014','P03-056','P04-031','PR-045','PR-082'].flatMap(c=>Array(4).fill(c));let total=0;
for(const seed of [7,11,19]){
 const m=new Match({seed,decks:[deck,deck]}),k=m._kernel;let steps=0;
 while(m.snapshot().match.phase!=='finished'&&steps++<1800){let r=m.request(0)||m.request(1);assert(r);if(r.origin==='kernel'){const saved=m.snapshot();m.restore(saved);r=m.request(0)||m.request(1);}const a=H.aiAnswer(r);assert(H.validate(r,a).ok);m.dispatch(a);}
 assert.equal(m.snapshot().match.phase,'finished');const paid=k.state.events.filter(e=>e.type==='move'&&e.reason==='declaration_cost').length;total+=paid;console.log('formal match seed '+seed+': '+steps+' decisions / '+paid+' declaration costs / C choices and restore passed');
}
assert(total>0,'Complete games must exercise real declaration costs');
