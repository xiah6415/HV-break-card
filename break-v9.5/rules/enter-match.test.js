'use strict';
const assert=require('node:assert/strict'),{Match}=require('./match'),H=require('../host-choice');
const deck=['P01-019','P02-037','P02-060','P02-083','P02-096','P04-002','P04-014','P04-016','P04-083','D01-009'].flatMap(c=>Array(require('../card-library').card(c)?.kind==='E'?2:4).fill(c)).concat(Array(3).fill('D01-001'),Array(3).fill('D01-002'));let total=0;
for(const seed of [7,11,19]){
 const m=new Match({seed,decks:[deck,deck]}),k=m._kernel;let steps=0,choices=0;
 while(m.snapshot().match.phase!=='finished'&&steps++<2000){let r=m.request(0)||m.request(1);assert(r);
  if(['entry','entry_count'].includes(r.kind)){choices++;const saved=m.snapshot();m.restore(saved);r=m.request(0)||m.request(1);}
  const answer=H.aiAnswer(r);assert(H.validate(r,answer).ok);m.dispatch(answer);
 }
 assert.equal(m.snapshot().match.phase,'finished');total+=choices;console.log('enter match seed '+seed+': '+steps+' decisions / '+choices+' entry choices / valid C answers and restore passed');
}
assert(total>0,'Full games must reach actual entry selection');
