'use strict';
const assert=require('node:assert/strict'),T=require('./shuffle-node-tests'),F=require('./frequent-node-tests'),E=require('../engine'),catalog=require('./data/cards.json');
assert.equal(T.testShuffle(catalog),2);for(const code of T.codes)T.testShuffleCard(catalog,catalog.cards.find(c=>c.card_no==='HV-'+code));
// Independent compatibility check against the existing host shuffle, including
// indistinguishable printed copies and the next random operation after it.
for(const count of [0,1,2,9]){
 const k=F.game(catalog),source=k.addCard('HV-D01-009',0,'event'),ids=Array.from({length:count},()=>k.addCard('HV-D01-009',0,'deck'));
 const g=new E.Game({mode:'strict',seed:7,decks:['k1014','seijoh'],agents:[E.AI,E.AI]}),p=g.players[0];p.deck=Array(count).fill('D01-009');g.cardState=null;g.cardSnapshot();const original=[...g.cardState.zones['0.deck']];Object.assign(g.rngState,{algorithm:'mulberry32-v1',word:123,calls:0});k.state.rng={...g.rngState};const saved=k.snapshot();
 k.resolveProgram({kind:'shuffle',actor:'self'},0,source);g.shuffle(p.deck);const after=k.snapshot();assert.deepEqual(k.zone(0,'deck').map(id=>ids.indexOf(id)),g.cardState.zones['0.deck'].map(id=>original.indexOf(id)));assert.deepEqual(k.state.rng,g.rngState);assert.equal(k._random(),g.rand(),'The next flip/dice shares the advanced random stream');
 k.restore(saved);k.resolveProgram({kind:'shuffle',actor:'self'},0,source);assert.deepEqual(k.snapshot(),after,'Exact duplicate-card permutation and RNG restore');
}

console.log('shuffle: two actors, four cards, QA1937–1939, paid/optional/short/empty cases, private order, exact host RNG/physical-copy permutation and replay passed');
