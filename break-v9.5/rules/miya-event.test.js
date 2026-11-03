'use strict';
const assert=require('node:assert/strict'),{LocalSession}=require('./local-session'),H=require('../host-choice');
const next=s=>s.match.request(0)||s.match.request(1),answer=(s,value)=>s.command({kind:'answer',answer:H.makeAnswer(next(s),value)});
function fixture(code,mode,{double=false,guts=false,wrongSetter=false}={}){
 const deck=[code,code,'P01-063','P02-087','P02-016','P02-019',...Array(34).fill('D01-009')],s=new LocalSession({id:'miya-087',seed:7,decks:[deck,deck],mode,wantsAck:[true,false]}),m=s.match,k=m._kernel;
 Object.assign(m._m,{pending:null,continuation:null,phase:'rally',actor:0,turnNo:1,rally:1,server:1,pc:'toss',notices:[]});k.state.stage='rally';k.state.turn={id:1,player:0,phase:'toss',step:'free'};k.state.ball={kind:'attack',offense:0,owner:1};
 const put=(no,z)=>{const id=k.zone(0,'deck').find(id=>k.card(id).cardNo==='HV-'+no);assert(id);k._atomic(()=>k._move(id,0,z,k._context(id,0)));return id;};
 put(wrongSetter?'P01-063':'D01-009','receive');const setter=put(wrongSetter?'D01-009':double?code:'P01-063','hand'),attacker=put(code,'hand'),event=put('P02-087','hand');let newSetter,newAttacker;if(guts){newSetter=put('P02-016','toss');newAttacker=put('P02-019','attack');}m._pump();return {s,m,k,setter,attacker,event,newSetter,newAttacker};
}
for(const code of ['P02-077','PR-036','PR-040'])for(const mode of ['strict','numeric'])for(const double of [false,true]){
 const {s,m,k,setter,attacker,event}=fixture(code,mode,{double});answer(s,setter);if(double){assert.equal(next(s).kind,'name');answer(s,'宮侑');}assert.equal(next(s).kind,'attacker');answer(s,attacker);assert.equal(next(s).kind,'name');answer(s,'宮治');
 assert.equal(k.effectiveName(setter),'宮侑');assert.equal(k.effectiveName(attacker),'宮治');assert.equal(k.card(attacker).printed.name,'宮兄弟');const before=m.snapshot(),attack=k.parameter(attacker,'attack');answer(s,event);
 const seen=[];while(next(s)?.kind!=='turnEnd'){const r=next(s);assert(r);seen.push(r.kind);answer(s,r.kind==='entry_count'?0:r.kind==='target'?[attacker]:r.kind==='parameter'?'attack':H.aiAnswer(r).value);}
 assert(seen.includes('target')&&seen.includes('parameter'));assert.equal(k.parameter(attacker,'attack'),attack+1);assert.equal(k.zone(0,'hand').length,before.zones['0.hand'].length,'play one/draw one');
 while(s.entries.length){s.undo();if(next(s).kind==='event')break;}assert.equal(next(s).kind,'event');assert.deepEqual(m.snapshot().zones,before.zones);assert.deepEqual(m.snapshot().effects,before.effects);assert.equal(k.effectiveName(attacker),'宮治');
}
for(const code of ['P02-077','PR-036','PR-040']){
 const {s,m,k,setter,attacker,event,newSetter,newAttacker}=fixture(code,'strict',{guts:true});answer(s,setter);answer(s,attacker);answer(s,'宮治');answer(s,event);const offered=[];
 for(let i=0;i<20&&next(s)?.kind!=='turnEnd';i++){const r=next(s);if(r.kind==='entry')offered.push(...r.options.map(o=>o.value));answer(s,r.kind==='entry_count'?1:r.kind==='entry'?[r.options[0].value]:r.kind==='target'?[newAttacker]:r.kind==='parameter'?'attack':H.aiAnswer(r).value);}
 assert(offered.includes(newSetter)&&offered.includes(newAttacker));assert.equal(k.top(0,'toss'),newSetter);assert.equal(k.top(0,'attack'),newAttacker);assert.equal(k.parameter(newAttacker,'attack'),k.card(newAttacker).printed.parameters.attack+1);assert.equal(k.effectiveName(attacker),'宮兄弟','covered card returns to printed name');assert.equal(m._m.pc,'turnEnd');
}
for(const code of ['P02-077','PR-036','PR-040']){
 const {s,k,setter,attacker,event}=fixture(code,'strict',{wrongSetter:true});answer(s,setter);answer(s,attacker);answer(s,'宮治');const base=k.parameter(attacker,'attack'),hand=k.zone(0,'hand').length;answer(s,event);assert.equal(next(s).kind,'turnEnd','Only attack-name condition is insufficient');assert.equal(k.zone(0,'hand').length,hand,'Unconditional draw still resolves');assert.equal(k.parameter(attacker,'attack'),base,'No conditional +1 with a different setter');
}
console.log('P02-087: three Miya cards, strict/numeric, fixed/renamed setter, chosen name, Guts re-entry, +1, printed identity and Undo passed');
