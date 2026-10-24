'use strict';
const assert=require('node:assert/strict'),{Match}=require('./rules/match'),H=require('./host-choice'),AI=require('./match-ai');
function setup(actor=0){const deck=['P01-088',...Array(39).fill('D01-009')],m=new Match({seed:7,decks:[deck,deck],mode:'numeric'}),k=m._kernel,id=Object.values(k.state.cards).find(c=>c.owner===actor&&c.cardNo==='HV-P01-088').id;k._atomic(()=>k._move(id,actor,'hand',k._context(id,actor)));const hidden=k.top(1-actor,'deck');k._atomic(()=>k._move(hidden,1-actor,'hand',k._context(hidden,1-actor)));k.state.turn={id:1,player:actor,phase:'receive',step:'free'};k.state.ball={kind:'serve',offense:1,owner:1-actor};Object.assign(m._m,{pending:null,continuation:null,phase:'rally',actor,turnNo:1,rally:1,pc:'receiveEvent'});m._pump();return {m,k,id};}
for(const actor of [0,1]){
 const {m,k}=setup(actor),before=JSON.stringify(m.snapshot()),sample=AI.simulation(m,actor,12345),state=sample._kernel.state,base=state.match.continuation.baseline;
 assert.equal(JSON.stringify(m.snapshot()),before);assert.deepEqual(state.zones[actor+'.deck'],base.zones[actor+'.deck']);assert.deepEqual(state.rng,base.rng);assert.notEqual(state.rng.word,k.state.rng.word);
 const other=AI.clone(m);for(let s=other._kernel.state;s;s=s.match?.continuation?.baseline){s.zones[actor+'.deck'].reverse();s.zones[(1-actor)+'.deck'].reverse();const h=s.zones[(1-actor)+'.hand'],d=s.zones[(1-actor)+'.deck'];if(h.length&&d.length&&!sample.request(actor)?.options.some(o=>o.value===h[0])){[h[0],d[0]]=[d[0],h[0]];s.cards[h[0]].zone=(1-actor)+'.hand';s.cards[d[0]].zone=(1-actor)+'.deck';}}const b=AI.simulation(other,actor,12345);assert.deepEqual(b._kernel.state.zones,state.zones,'samples do not depend on true hidden order');assert.deepEqual(AI.answer(other,other.request(actor)),AI.answer(m,m.request(actor)),'decisions do not depend on actual hidden allocation/order');
}
{
 const {m,k,id}=setup(),sample=AI.simulation(m,0,12345),expected=sample._kernel.top(0,'deck');assert.notEqual(expected,k.top(0,'deck'));
 sample.command({kind:'answer',answer:H.makeAnswer(sample.request(0),id)});sample.command({kind:'answer',answer:H.makeAnswer(sample.request(0),1)});assert.equal(sample._kernel.top(0,'hand'),expected,'sampling survives continuation replay');sample._kernel.assertState();
}
// A source already moved to a public zone during a suspended payment stays
// in its original baseline slot so the answer tape remains replayable.
{
 const {m,id}=setup();m.command({kind:'answer',answer:H.makeAnswer(m.request(0),id)});const before=m.snapshot(),sample=AI.simulation(m,0,12345);assert.equal(sample._kernel.card(id).zone,'0.event');assert.equal(sample._kernel.state.match.continuation.baseline.cards[id].zone,before.match.continuation.baseline.cards[id].zone);assert.equal(sample.request(0).requestId,m.request(0).requestId);
}
console.log('AI replay masking: both seats, baseline sampling, hidden-order independence, sampled RNG, visible source, non-mutation and real Event draw passed');
