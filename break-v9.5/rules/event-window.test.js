'use strict';
const assert=require('node:assert/strict'),{Match}=require('./match'),H=require('../host-choice');
function fixture(mode,code,withTargets=false){
 const deck=[code,'D01-009','P01-001','P01-006',...Array(36).fill('D01-009')],m=new Match({seed:7,decks:[deck,deck],mode}),k=m._kernel;
 const put=(no,z)=>{const id=k.zone(0,'deck').find(id=>k.card(id).cardNo==='HV-'+no);assert(id);k._atomic(()=>k._move(id,0,z,k._context(id,0)));return id;};
 put('D01-009','receive');const id=put(code,'hand');if(withTargets){put('P01-001','drop');put('P01-006','drop');}
 Object.assign(m._m,{pending:null,continuation:null,phase:'rally',actor:0,turnNo:1,rally:1,pc:'receiveEvent',notices:[]});k.state.stage='rally';k.state.turn={id:1,player:0,phase:'receive',step:'free'};k.state.ball={kind:'attack',offense:0,owner:1};m._pump();return {m,id};
}
for(const mode of ['numeric','strict']){
 for(const code of ['D01-009','PR-029']){const {m}=fixture(mode,code);assert.notEqual(m.request(0)?.kind,'event',mode+' skips unavailable effect '+code);assert.equal(m.request(0)?.kind,'lossConfirm');}
 const {m,id}=fixture(mode,'PR-029',true),r=m.request(0);assert.equal(r.kind,'event');assert(r.options.some(o=>o.value===id));assert(r.options.some(o=>o.value===null));assert(r.canLoss);assert.equal(r.canManual,mode==='numeric');assert.equal(m.request(1),null,'opponent cannot answer the window');
 m.command({kind:'answer',answer:H.makeAnswer(r,null)});assert.notEqual(m.request(0)?.kind,'event');
 // Entire games, including all six free windows, must never stop on an empty
 // Event prompt. Mandatory draw, turn end and Loss acknowledgments still exist.
 const deck=['D01-009','D02-005','D04-006','D03-007'].flatMap(c=>Array(10).fill(c)),full=new Match({seed:7,decks:[deck,deck],mode}),seen=new Set();
 for(let i=0;i<3000&&full._m.phase!=='finished';i++){const q=full.request(0)||full.request(1);assert(q);seen.add(q.kind);if(q.kind==='event')assert(q.options.some(o=>o.card),'empty Event prompt');full.command({kind:'answer',answer:H.aiAnswer(q)});}
 assert.equal(full._m.phase,'finished');for(const kind of ['ack','turnEnd','lossConfirm'])assert(seen.has(kind),kind+' is preserved');
}
// Reconnecting to a numeric room paused on the old empty window can still
// consume its pending answer, then proceed using the new silent behavior.
{
 const {m}=fixture('numeric','D01-009');
 Object.assign(m._m,{pending:null,continuation:null,pc:'receiveEvent'});
 m._event=function(next){this._ask('event',this._m.actor,{type:'single'},[null]);this._next(next);};m._pump();
 const snapshot=m.snapshot(),r=m.request(0);assert.equal(r.kind,'event');delete m._event;m.restore(snapshot);
 m.command({kind:'answer',answer:H.makeAnswer(m.request(0),null)});assert.equal(m.request(0).kind,'lossConfirm');
 assert.equal(m._m.history.at(-1).kind,'event');
}
console.log('Event windows: both modes skip absent/unusable effects, retain usable choices, privacy, Loss/manual and full games');
