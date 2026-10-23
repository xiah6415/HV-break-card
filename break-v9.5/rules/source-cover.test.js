'use strict';
const assert=require('node:assert/strict'),T=require('./source-cover-tests'),catalog=require('./data/cards.json');
assert.equal(T.testCover(catalog),1);const card=catalog.cards.find(c=>c.card_no==='HV-P03-028');T.testCard(catalog,card);
// QA1787/1788: neither the payment card nor the later back attacker needs Youth.
const f=T.setup(catalog,card),{k,id,fee}=f;k.resolveProgram({kind:'numeric',target:'source',target_scope:{mode:'single',binding:'reference',membership:'snapshot_on_resolution'},parameter:'receive',operation:'add',value:4,duration:'this_turn'},0,id);T.invoke(f);assert.equal(k.parameter(fee,'receive'),2);
for(let i=0;i<2;i++){const x=k.addCard('HV-D01-009',0,'hand');k.resolveProgram({kind:'keyword',keyword:'back_attack',N:3,parameters:{}},0,x);assert.equal(k.parameter(x,'attack'),4);assert(!k.card(x).printed.affiliation_tags.includes('ユース'));}
k.endTurn();k.beginTurn(1,'receive');k.endTurn();k.beginTurn(0,'attack');const x=k.addCard('HV-D01-009',0,'hand');k.resolveProgram({kind:'keyword',keyword:'back_attack',N:3,parameters:{}},0,x);assert.equal(k.parameter(x,'attack'),3,'This-turn watch expires');
console.log('source cover: exact Guts payment, identity replacement without entry, Youth/skill gates, covered-source persistence, non-Youth back attacks, expiry and replay passed');
