'use strict';
const assert=require('node:assert/strict'),T=require('./external-tests'),F=require('./frequent-node-tests'),{attempt}=require('./decisions'),catalog=require('./data/cards.json');
assert.equal(T.testExternal(catalog),5);for(const code of T.codes)T.testExternalCard(catalog,catalog.cards.find(c=>c.card_no==='HV-'+code));
// Fair result comes from the checkpoint RNG, never from a player answer.
const coin={kind:'external_action',action:'coin',bind:'random',alternative_requires_both_consent:true};
{
 const k=F.game(catalog),id=k.addCard('HV-D01-009',0,'block');k.state.rng.word=0;const before=k.snapshot(),invoke=k=>k.resolveProgram(coin,0,id),first=attempt(k,before,invoke,[]);assert.equal(first.boundary.request.kind,'external_action');assert.equal(first.boundary.state.rng.calls,0);
 const tape=[{request:first.boundary.request,answer:true}],second=attempt(k,before,invoke,tape);assert.equal(second.boundary.request.result,'heads');assert.deepEqual(second.boundary.request.options,[true]);assert.equal(second.boundary.state.rng.calls,1);
 tape.push({request:second.boundary.request,answer:true});const result=attempt(k,before,invoke,tape);assert.equal(result.state.rng.calls,1);assert.deepEqual(attempt(k,before,invoke,tape).state,result.state);
 k.restore(before);let n=0;k.choose=()=>++n===1?true:'tails';assert.throws(()=>invoke(k),/Confirm coin result/);assert.deepEqual(k.snapshot(),before);
 const saved=k.snapshot();assert(k._paymentAvailable({kind:'sequence',steps:[coin]},k._context(id,0)));assert.deepEqual(k.snapshot(),saved,'Cost preview cannot consume a real flip');
}
// Module also completes the tilt action, while its dependent parameter-absence
// node stays locked. It grants no automatic ability to the incomplete card.
assert(!require('./modules').eligible(catalog.cards.find(c=>c.card_no==='HV-P02-027')));
console.log('external action: five forms, four cards, fair heads/tails, partial deck, separate draw choices, optional cheer, payment/preview/replay/invalid-result rollback passed');
