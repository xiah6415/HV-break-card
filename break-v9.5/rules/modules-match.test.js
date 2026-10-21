'use strict';
const assert=require('node:assert/strict'),{Match}=require('./match');
const F=require('./match-pilot-fixtures'),L=require('../card-library'),host=require('../host-choice');
// Only the existing cards-choice shape is used. Test actual suspended requests
// in the persistent match core, with C validating answers; no browser shape added.
for(const [code,tag] of [['P01-086','青葉城西'],['P03-089','音駒']]){
 const basics=Object.values(L.data.cards).filter(c=>c.status==='basic'&&c.schoolTags.includes(tag)).slice(0,4).map(c=>c.code);
 const deck=code==='P03-089'?['D01-009','D02-005','D04-006','D03-007','P01-017','P01-038','P01-086','P03-089'].flatMap((c,i)=>Array(i<4?4:i<6?8:4).fill(c)):[...basics.flatMap(c=>Array(8).fill(c)),...Array(8).fill(code)];
 const m=new Match({seed:7,id:code,decks:[deck,deck]});let steps=0,retrievals=0,restored=false;
 while(m.snapshot().match.phase!=='finished'&&steps++<1000){
  let r=m.request(0)||m.request(1);
  if(r.kind==='move_cards'){
   assert.equal(r.source.cardNo,'HV-'+code);retrievals++;
   if(!restored){const snapshot=m.snapshot();m.restore(snapshot);r=m.request(0)||m.request(1);restored=true;}
  }
  const q=F.newQuestion(m,r),value=F.newAnswer(q,F.select(q,F.newState(m),r.actor,{mulligan:true,preferBlock:true}));
  let answer=host.makeAnswer(r,value);if(!host.validate(r,answer).ok)answer=host.aiAnswer(r);assert(host.validate(r,answer).ok);m.dispatch(answer);
 }
 assert.equal(m.snapshot().match.phase,'finished');assert(retrievals>0&&restored);
 console.log(code+': full new-core match / retrieval choice / C answer / local restore passed');
}
