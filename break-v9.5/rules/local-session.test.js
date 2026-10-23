'use strict';
const assert=require('node:assert/strict'),{LocalSession}=require('./local-session'),H=require('../host-choice');
const deck=Array(40).fill('D01-009'),copy=x=>structuredClone(x),request=s=>s.match.request(0)||s.match.request(1);
function answer(s,r=request(s),value){return s.command({kind:'answer',answer:value===undefined?H.aiAnswer(r):H.makeAnswer(r,value)});}
function advance(s,predicate,server=0){for(let i=0;i<300;i++){const r=request(s);assert(r);if(predicate(r,s.match.snapshot()))return r;const param={serve:'serve',receiver:'receive',setter:'toss',attacker:'attack'}[r.kind];answer(s,r,r.kind==='firstService'?(r.actor===server?'serve':'receive'):param?r.options.slice().sort((a,b)=>s.match._kernel.parameter(b.value,param)-s.match._kernel.parameter(a.value,param))[0].value:undefined);}throw Error('Boundary not reached');}
function create(mode='numeric'){const s=new LocalSession({id:'local-test',seed:7,decks:[deck,deck],mode});advance(s,r=>r.kind==='turnEnd');assert.equal(request(s).actor,0);return s;}
const manual=(s,action,r=request(s))=>s.command({kind:'manual',matchId:r.matchId,requestId:r.requestId,epoch:r.epoch,actor:r.actor,action});
function canonical(s){s=copy(s);if(s.match.pending){delete s.match.pending.epoch;delete s.match.pending.requestId;}return s;}
function own(s){return s.view(0).players[0].court[0];}
// One physical model and one RNG; the compatibility checkpoint field is a copy.
{
 const s=create(),k=s.match._kernel,b=s.match.snapshot();assert(!Object.hasOwn(k.state.match,'rng'));assert.deepEqual(b.rng,b.match.rng);
 const expected=(()=>{let word=(b.rng.word+0x6D2B79F5)>>>0,t=word;t=Math.imul(t^t>>>15,1|t);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;})();
 assert.equal(s.match._random(),expected);assert.equal(k.state.rng.calls,b.rng.calls+1);k._random();assert.equal(k.state.rng.calls,b.rng.calls+2);
 s.match.restore(b);assert.equal(s.match._random(),expected);const wrong=copy(b);wrong.match.rng.word^=1;assert.throws(()=>s.match.restore(wrong),/checkpoint/);const old=copy(b);old.match.coreVersion='break.match.pilot.1';assert.throws(()=>s.match.restore(old),/mismatch/);
}
// Adjusting all five fields stays through the original pending command; Undo
// restores both the decision and full effects rather than projecting an offset.
for(const parameter of ['serve','block','receive','toss','attack']){
 const s=create(),t=own(s),before=s.match.snapshot(),r=request(s);manual(s,{kind:'adjust',ref:{id:t.id,incarnation:t.incarnation},parameter,delta:1});
 assert.equal(own(s).parameters[parameter],t.parameters[parameter]+1);assert.equal(request(s).kind,'turnEnd');assert.throws(()=>answer(s,r),/STALE/);assert(s.undo());assert.deepEqual(canonical(s.match.snapshot()),canonical(before));assert.equal(s.match.snapshot().rng.calls,before.rng.calls);
}
{
 const s=create(),t=own(s),before=s.match.snapshot(),n=s.entries.length;
 for(const action of [{kind:'adjust',ref:{id:t.id,incarnation:t.incarnation+1},parameter:'serve',delta:1},{kind:'adjust',ref:{id:t.id,incarnation:t.incarnation},parameter:'serve',delta:2},{kind:'adjust',ref:{id:s.view(0).players[0].hand[0].id,incarnation:s.view(0).players[0].hand[0].incarnation},parameter:'serve',delta:1},{kind:'discard',player:1,ref:{id:t.id,incarnation:t.incarnation}},{kind:'draw',player:8}]){assert.throws(()=>manual(s,action));assert.deepEqual(s.match.snapshot(),before);assert.equal(s.entries.length,n);}
 const strict=create('strict');assert.equal(request(strict).canManual,false);assert.throws(()=>manual(strict,{kind:'draw'}),/UNSUPPORTED/);
}
// Drawing refreshes the original selectable hand. Own discard uses a physical
// reference; opponent discard is private and selected by the affected player.
{
 const s=create(),before=s.match.snapshot(),count=s.view(0).players[0].hand.length;manual(s,{kind:'draw'});assert.equal(s.view(0).players[0].hand.length,count+1);assert(s.undo());assert.deepEqual(canonical(s.match.snapshot()),canonical(before));
 manual(s,{kind:'draw',player:1});assert.equal(s.view(0).players[1].hand.count,before.zones['1.hand'].length+1);assert(!Array.isArray(s.view(0).players[1].hand));assert(s.undo());
 const c=s.view(0).players[0].hand[0];manual(s,{kind:'discard',ref:{id:c.id,incarnation:c.incarnation}});assert.equal(s.view(0).players[0].hand.length,count-1);assert(s.undo());
 manual(s,{kind:'discard',player:1});const r=request(s);assert.equal(r.actor,1);assert.equal(r.kind,'discard');assert.equal(s.match.view(0).request,null);assert(!r.canManual&&!r.canLoss);const hand=s.match.snapshot().zones['1.hand'].length;answer(s,r);assert.equal(s.match.snapshot().zones['1.hand'].length,hand-1);assert.equal(request(s).actor,0);assert(s.undo());assert.deepEqual(canonical(s.match.snapshot()),canonical(before));
}
// Numeric mode retains the free window even with no playable Event, allowing
// a failed receive value to be corrected before the actual judgment.
{const cards=['D01-009','D02-005','D04-006','D03-007'].flatMap(c=>Array(10).fill(c)),s=new LocalSession({id:'receive-manual',seed:7,decks:[cards,cards],mode:'numeric'});advance(s,r=>r.kind==='receiver'&&r.actor===0,1);let r=request(s);const id=r.options.slice().sort((a,b)=>s.match._kernel.parameter(b.value,'receive')-s.match._kernel.parameter(a.value,'receive'))[0].value,value=s.match._kernel.parameter(id,'receive');while(s.match.snapshot().ball.offense<=value)manual(s,{kind:'ball',delta:1});answer(s,request(s),id);r=request(s);assert.equal(r.kind,'event');assert.equal(r.timing,'receive');assert(r.canManual);const c=s.view(0).players[0].court.find(c=>c.role==='receive');manual(s,{kind:'adjust',ref:{id:c.id,incarnation:c.incarnation},parameter:'receive',delta:1});answer(s,request(s),null);assert.equal(request(s).kind,'setter','Manual receive adjustment is applied before judgment');}
// The incoming serve is adjustable too; no attack-only domain is inferred.
{
 const s=create();answer(s);advance(s,r=>r.canManual&&r.actor===1);const before=s.match.snapshot();assert.equal(before.ball.kind,'serve');manual(s,{kind:'ball',delta:-1});assert.equal(s.match.snapshot().ball.offense,before.ball.offense-1);assert.equal(s.status().enabled,false,'Own Undo stops after handing the turn to the opponent');
}
// Manual draw can suspend in a generated skill choice using the same journal.
// Undo cancels that pending reply and restores the already-existing watcher.
{
 const s=create(),k=s.match._kernel,t=own(s);k._atomic(()=>k._registerWatch({kind:'watch',event:'hand_added',actor:'self',filters:{},duration:'this_turn',per_object:true,remaining_uses:null,then:{kind:'move',pool:{kind:'selector',actor:'self',zone:'hand',filters:{}},destination:'owner.drop',count:1,count_mode:'exact',bind:'moved'}},k._context(t.id,0)));
 const before=s.match.snapshot();manual(s,{kind:'draw'});const r=request(s);assert.equal(r.origin,'kernel');assert(!r.canManual);assert.throws(()=>manual(s,{kind:'draw'}),/STALE/);assert(s.undo());assert.deepEqual(canonical(s.match.snapshot()),canonical(before));assert.throws(()=>answer(s,r),/STALE/);
}
{const s=create(),k=s.match._kernel,t=own(s);k._atomic(()=>k.effect('protect',{targets:[{id:t.id,incarnation:t.incarnation}],ballOwner:null,parameter:'all'},k._context(t.id,0)));const value=own(s).parameters.serve;manual(s,{kind:'adjust',ref:{id:t.id,incarnation:t.incarnation},parameter:'serve',delta:-1});assert.equal(own(s).parameters.serve,value,'Manual decreases obey protection');}
// A committed fixed outgoing choice is retained across a manual refresh.
{const s=new LocalSession({id:'fixed-outgoing',seed:7,decks:Array(2).fill(['D01-009','D02-005','D04-006','D03-007'].flatMap(c=>Array(10).fill(c))),mode:'numeric'});advance(s,r=>r.kind==='attacker'&&r.actor===0,1);const k=s.match._kernel;k._atomic(()=>{for(const N of [2,3])k.effect('keyword',{keyword:'feint',N,actor:0,parameters:{}},k._context(null,0));});const fixture=k.snapshot();fixture.match.pending=null;fixture.match.continuation=null;k.state.match.continuation={baseline:fixture,answers:[]};answer(s);if(request(s).kind==='event')answer(s,request(s),null);assert.equal(request(s).kind,'mode');answer(s,request(s),3);assert.equal(request(s).kind,'turnEnd');const target=s.view(0).players[0].court.find(c=>c.role==='attack'),count=k.state.decisions.filter(d=>d.request.kind==='mode').length;manual(s,{kind:'adjust',ref:{id:target.id,incarnation:target.incarnation},parameter:'attack',delta:1});assert.equal(request(s).kind,'turnEnd');assert.equal(request(s).context.outgoing.offense,3);assert.equal(k.state.decisions.filter(d=>d.request.kind==='mode').length,count);assert.equal(k.state.effects.filter(e=>e.keyword==='feint_block_ban').length,1);assert(s.undo());assert.equal(request(s).context.outgoing.offense,3);}
console.log('local core: numeric five-field/ball/draw/discard commands, affected-player privacy, full checkpoint Undo, stale refusal, shared RNG and generated-choice cancellation passed');
