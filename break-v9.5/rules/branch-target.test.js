'use strict';
const assert=require('node:assert/strict'),{fixture}=require('./batch-smoke'),{Kernel}=require('./core'),{visit}=require('./batch-index');
const catalog=require('./data/cards.json'),rules=require('./data/shared-rules.json');
function kernel(){return new Kernel({catalog,ruleIds:rules.rules.map(r=>r.id),fingerprint:'public-private-chooser',mode:'sandbox',choose:req=>{assert.equal(req.player,0,'QA1192/1317/1420: public cards are selected by skill controller');return req.count!=null?req.options.slice(0,req.count):req.options.at(-1);}});}
for(const [no,zone,count]of [['P01-066','event',2],['P02-046','receive',2],['PR-028','event',1]]){
 const k=kernel(),card=catalog.cards.find(c=>c.card_no==='HV-'+no),nodes=[];visit(card.profiles[0].program,n=>nodes.push(n));
 const move=nodes.find(n=>n.kind==='move'&&n.pool?.actor==='opponent');assert(move,no+' original public move node');
 for(let i=0;i<count;i++)k.addCard('HV-P01-001',1,zone);if(zone==='receive')k.addCard('HV-D01-009',1,zone);
 k.resolveProgram(move,0);assert.equal(k.zone(1,'drop').length,count);if(zone==='receive')assert.equal(k.zone(1,'receive').length,1);
}
const privateKernel=kernel();let privateChoice=false;
privateKernel.choose=req=>{assert.equal(req.player,1,'affected player retains their own hand-discard choice');privateChoice=true;return req.options.slice(0,req.count);};
privateKernel.addCard('HV-P01-001',1);privateKernel.addCard('HV-D01-009',1);
privateKernel.resolveProgram({kind:'move',pool:{kind:'selector',actor:'opponent',zone:'hand',filters:{}},destination:'owner.drop',count:1,count_mode:'exact'},0);assert(privateChoice);
// QA1361 allows either currently eligible side blocker at resolution. Do not
// invent an exact-entry-reference rule when the official ruling allows a pool.
const card=catalog.cards.find(c=>c.card_no==='HV-P02-082'),p=card.profiles[0],f=fixture(card,p,'attack',{conditioned:true,expanded:true,max:true},0),k=f.k;
const center=k.addCard('HV-D01-009',1,'block'),old=k.addCard('HV-P01-001',1,'side:0');let choices=0;
const choose=k.choose;k.choose=req=>{if(req.kind==='move_cards'&&req.destination==='owner.drop'){assert.equal(req.player,0);assert(req.options.includes(old));choices++;return [old];}return choose(req);};
k.playEvent(f.id);k.endTurn();k.beginTurn(1,'block');
const incoming=k.addCard('HV-P01-005',1);k.enter(incoming,'block',{side:true});
assert.equal(k.card(old).zone,'1.drop');assert.equal(k.card(incoming).zone,'1.side:1');
const next=k.addCard('HV-D04-003',1);k.enter(next,'block',{side:true});assert.equal(k.card(next).zone,'1.side:0');assert.equal(choices,1,'QA1359: one choice per effect instance');assert.equal(k.card(center).zone,'1.block');
k.assertState();console.log('branch-target: original QA1192/1317/1420 public move nodes use controller; private hand uses affected player; QA1359/1361 side pool and one-use retained');
