'use strict';
const assert=require('node:assert/strict'),{Match}=require('./rules/match'),H=require('./host-choice'),AI=require('./match-ai');
function fixture(ball=2,paid=false){
 const codes=paid?['D01-001',...Array(39).fill('D01-009')]:['P01-088','D04-011','D02-005','D03-007','D03-007',...Array(35).fill('D01-009')],m=new Match({id:'plan',seed:7,decks:[codes,codes]}),k=m._kernel;
 for(const c of Object.values(k.state.cards))k._atomic(()=>k._move(c.id,c.owner,'deck',k._context(c.id,c.owner)));
 const put=(no,z,p=0)=>{const id=k.zone(p,'deck').find(id=>k.card(id).cardNo==='HV-'+no);assert(id);k._atomic(()=>k._move(id,p,z,k._context(id,p)));return id;};
 const hand=(paid?['D01-001','D01-009','D01-009']:['P01-088','D01-009','D03-007','D01-009','D03-007']).map(c=>put(c,'hand'));
 for(const p of [0,1]){put('D01-009','sets',p);put('D01-009','sets',p);}put('D01-009','hand',1);
 if(paid){put('D01-009','attack');put('D01-009','attack');put('D01-009','toss');}else{put('D04-011','receive');put('D02-005','toss');}
 Object.assign(m._m,{pending:null,continuation:null,phase:'rally',actor:0,turnNo:1,rally:1,server:1,pc:paid?'attack':'receiveEvent',notices:[]});k.state.stage='rally';k.state.turn={id:1,player:0,phase:paid?'attack':'receive',step:'free'};k.state.ball={kind:'attack',offense:ball,owner:1};m._pump();if(paid)m.dispatch(H.makeAnswer(m.request(0),hand[0]));return {m,hand};
}
assert.deepEqual(AI.LEVELS.easy,{slip:0,samples:1,roles:false,block:true});assert.deepEqual(AI.LEVELS.normal,{slip:0,samples:2,roles:true,block:true});
for(const [ball,want]of [[2,null],[3,null],[4,'event'],[6,null]]){
 const {m,hand}=fixture(ball),before=m.snapshot(),epoch=m.epoch,r=m.request(0),answer=AI.answer(m,r,{level:'hard'});assert(H.validate(r,answer).ok);assert.equal(answer.value,want==='event'?hand[0]:want,'receive '+ball);assert.deepEqual(m.snapshot(),before);assert.equal(m.epoch,epoch);
 // Follow the actual selected line through receive, toss, attack and turn handoff.
 let n=0;while(n++<40&&m._m.actor===0&&m._m.phase!=='finished'&&m._m.pc!=='lossConfirm'){const q=m.request(0);if(!q)break;m.dispatch(n===1?answer:AI.answer(m,q,{level:'hard'}));}
 if(ball===4){assert.equal(m._kernel.state.ball.owner,0,'rescue completes the counterattack');assert.equal(m._m.roleTotals[0].receive,4);}
}
{
 const {m}=fixture(2,true),r=m.request(0);assert.equal(r.kind,'activate_payment');assert.equal(AI.answer(m,r,{level:'hard'}).value,false,'already threatening attack preserves Guts');r.context.ineffectiveReason='來球不是攻擊';assert.equal(AI.answer(m,r,{level:'hard'}).value,false,'ineffective costs never paid');
}
{
 const {m}=fixture(),r=m.request(0),card=r.options[0];r.options=Array.from({length:14},(_,i)=>({...card,id:'option-'+i,value:'test-'+i})).concat({id:'pass',value:null,label:'繼續'});const list=AI.planningCandidates(r);assert.equal(list.length,10);assert.equal(list[0],null,'pass survives cap and wins ties');
 // All failed simulations must choose the legal pass, not the first event.
 assert.equal(AI.answer(m,r,{level:'hard'}).value,null);
}
{const {m}=fixture(4),original=Match.prototype.command;let count=0;Match.prototype.command=function(...args){count++;return original.apply(this,args);};try{AI.answer(m,m.request(0),{level:'hard'});assert(count<=AI.PLAN_COMMAND_LIMIT,'deterministic command budget');}finally{Match.prototype.command=original;}}
console.log('Hard planning: remapped levels; safe receive holds, +1 rescue completes counterattack, useless boost holds, Guts and ineffective fees preserved, candidate cap/pass, non-mutation passed');
