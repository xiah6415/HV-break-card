'use strict';
const assert=require('node:assert/strict'),{Match}=require('./match'),T=require('./absent-tests'),catalog=require('./data/cards.json');
for(const off of [3,4]){
 const f=T.setup(catalog,catalog.cards.find(c=>c.card_no==='HV-P02-027')),{k}=f;T.invoke(f);k.endTurn();k.beginTurn(1,'block');for(const [code,side]of [['HV-P01-001',false],['HV-P01-009',true]]){const id=k.addCard(code,1,'hand');k.enter(id,'block',{side});}k.state.ball={kind:'attack',offense:off,owner:0};
 const deck=['D01-009','D04-003','P01-001','P01-009','P01-004','P03-048','D04-001','P01-051','P01-014','P01-026'].flatMap(c=>Array(4).fill(c)),m=new Match({seed:7,decks:[deck,deck]});const match=structuredClone(m._m);k.state.match=match;m._kernel=k;m._m.actor=1;m._m.pc='blockJudge';m._m.phase='rally';m._m.pending=null;m._m.continuation=null;
 const before=k.snapshot();m._step();assert.equal(m._m.roleTotals[1].block,3);assert.equal(m._m.pc,off===3?'turnEnd':'lossConfirm');const after=k.snapshot(),next=structuredClone(m._m);k.restore(before);m._step();assert.deepEqual(k.snapshot(),after);assert.deepEqual(m._m,next,'Native match checkpoint replay');
}
console.log('parameter absence match: native block judgment omits the center, 3/4 boundary and checkpoint replay passed');
