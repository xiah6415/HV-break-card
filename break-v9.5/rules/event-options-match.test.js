'use strict';
const assert=require('node:assert/strict'),{LocalSession}=require('./local-session'),H=require('../host-choice');
const deck=['P01-088','P03-086','D01-012','D04-003',...Array(36).fill('D01-009')];
function setup(code,withTarget=false,lower=false){
 const s=new LocalSession({id:'event-options',seed:7,decks:[deck,deck],mode:'numeric'}),m=s.match,k=m._kernel,phase=code==='P03-086'?'toss':'receive';
 Object.assign(m._m,{pending:null,continuation:null,phase:'rally',actor:0,turnNo:1,pc:phase==='toss'?'tossEvent':'receiveEvent'});k.state.turn={id:1,player:0,phase,step:'free'};k.state.ball={kind:'attack',offense:0,owner:1};
 const find=code=>Object.values(k.state.cards).find(c=>c.owner===0&&c.cardNo==='HV-'+code).id,move=(id,z)=>k._atomic(()=>k._move(id,0,z,k._context(id,0)));
 const id=find(code);move(id,'hand');
 if(code==='P03-086'){move(find('D01-009'),'toss');move(find('D01-012'),'event');if(lower)k._atomic(()=>k._numeric({kind:'numeric',operation:'add',parameter:'toss',value:-1,target:'$target',target_scope:{binding:'reference',membership:'snapshot_on_resolution',mode:'single'},duration:'this_turn'},{...k._context(id,0),bind:{target:k.reference(k.top(0,'toss'))}}));}
 else if(withTarget)move(find('D04-003'),'receive');
 m._pump();return {s,m,k,id};
}
const request=f=>f.m.request(0),answer=(f,value)=>f.s.command({kind:'answer',answer:value===undefined?H.aiAnswer(request(f)):H.makeAnswer(request(f),value)});
// A zero draw is excluded only when it leaves the entire Event inert.
for(const withTarget of [false,true]){
 const f=setup('P01-088',withTarget),before=f.m.snapshot();answer(f,f.id);let r=request(f);assert.equal(r.kind,'draw_count');assert.equal(r.options.some(o=>o.value===0),withTarget);assert.deepEqual(f.m.snapshot().rng,before.rng,'preflight does not consume live randomness');
 if(!withTarget){const state=f.m.snapshot();assert.throws(()=>answer(f,0),/INVALID/);assert.deepEqual(f.m.snapshot(),state);assert(f.s.undo());assert.equal(request(f).kind,'event');assert.equal(f.k.card(f.id).zone,'0.hand');answer(f,f.id);answer(f,1);}
 else{answer(f,0);answer(f);assert.equal(f.k.parameter(f.k.top(0,'receive'),'receive'),f.k.card(f.k.top(0,'receive')).printed.parameters.receive+2);}
 assert.equal(f.k.card(f.id).zone,'0.event');f.k.assertState();
}
// P03-086: declining the only remaining effective branch is unavailable when
// the setter already has 2; it remains available after a real numeric change.
for(const lower of [false,true]){
 const f=setup('P03-086',false,lower);answer(f,f.id);assert.equal(request(f).kind,'target');answer(f);assert.equal(request(f).kind,'activate_payment');assert.equal(request(f).options.some(o=>o.value===false),lower);
 const saved=f.m.snapshot();f.m.restore(saved);assert.throws(()=>f.m.restore({...saved,match:{...saved.match,coreVersion:'break.match.local.2'}}),/mismatch/);
 answer(f,lower?false:true);for(let i=0;request(f)?.origin==='kernel'&&i<20;i++)answer(f);assert.equal(request(f).kind,'event');assert.equal(f.k.parameter(f.k.top(0,'toss'),'toss'),2);f.k.assertState();
}
console.log('Native Event options: inert zero/decline pruned, effective zero/decline preserved, RNG/Undo/replay and old checkpoint rejection passed');
