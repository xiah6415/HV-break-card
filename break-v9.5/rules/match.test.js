'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {Match}=require('./match');
const F=require('./match-pilot-fixtures'),host=require('./host-contract');
const copy=x=>JSON.parse(JSON.stringify(x));
const envelope=(r,value)=>({matchId:r.matchId,requestId:r.requestId,epoch:r.epoch,actor:r.actor,value});
const opts={seed:7,deck:'skills',mulligan:true,preferBlock:true};
const create=()=>new Match({id:'pilot-7',seed:7,decks:[F.decks.skills,F.decks.skills]});
const next=m=>m.view(0).request||m.view(1).request;
function finish(m){for(let i=0;i<2000;i++){const raw=next(m);if(!raw)return F.newState(m);const q=F.newQuestion(m,raw),v=F.newAnswer(q,F.select(q,F.newState(m),raw.actor,opts));m.dispatch(envelope(raw,v));}throw Error('Did not finish');}
const wanted=new Set(['mulligan','block','activate_payment','payment_cards','target','turnEnd','lossConfirm','guts']),seen=new Set();
const baseline=F.runNew({...opts,snapshotAt:r=>{if(wanted.has(r.kind)&&!seen.has(r.kind)){seen.add(r.kind);return true;}return false;}});
let restores=0;
for(const cp of baseline.checkpoints){const m=create();m.restore(cp.snapshot);assert.deepEqual(finish(m),baseline.final);restores++;}
assert(restores>=7,'critical pending boundaries covered');
const payment=baseline.checkpoints.find(cp=>cp.snapshot.match.pending.kind==='payment_cards');assert(payment);
{
 const m=create();m.restore(payment.snapshot);const r=next(m),before=m.snapshot();
 const bad=[{...envelope(r,[]),actor:1-r.actor},envelope(r,[]),envelope(r,['not-a-card']),envelope(r,[r.options[0].value,r.options[0].value]),{...envelope(r,[r.options[0].value]),requestId:'old'}, {...envelope(r,[r.options[0].value]),epoch:r.epoch-1}];
 for(const answer of bad){assert.throws(()=>m.dispatch(answer),/INVALID_OR_STALE/);assert.deepEqual(m.snapshot(),before);}
 const v=m.view(r.actor);v.players[r.actor].hand.splice(0);assert.deepEqual(m.snapshot(),before,'views are not writable model aliases');
 assert.equal(m.view(1-r.actor).request,null);assert.equal(typeof m.view(r.actor).players[1-r.actor].hand.count,'number');
 assert(!JSON.stringify(m.view(r.actor)).includes('rng'));assert(!JSON.stringify(m.view(r.actor)).includes('continuation'));
 const stale=copy(r);m.restore(before);assert.throws(()=>m.dispatch(envelope(stale,[stale.options[0].value])),/STALE/);
 assert.deepEqual(finish(m),baseline.final);
}
{
 const m=create(),s=m.snapshot();
 for(const mutate of [s=>{s.match.id='other';},s=>{s.match.rng.word^=1;},s=>{s.match.coreVersion='other-core';},s=>{s.match.hostVersion='v2';},s=>{delete s.cards.c1;},s=>{s.match.decisionIndex++;},s=>{s.zones['0.deck'].push(s.zones['0.deck'][0]);}]){const bad=copy(s);mutate(bad);assert.throws(()=>m.restore(bad));assert.deepEqual(m.snapshot(),s);}
 const reordered=copy(s);reordered.cards=Object.fromEntries(Object.entries(reordered.cards).reverse());assert.doesNotThrow(()=>m.restore(reordered));
}
for(const cp of baseline.checkpoints.filter(cp=>['payment_cards','turnEnd'].includes(cp.snapshot.match.pending.kind))){
 const m=create();m.restore(cp.snapshot);const r=next(m),before=m.snapshot(),oldCards=before.zones[r.actor+'.receive'];assert(r.canLoss);
 m.command({kind:'loss',matchId:r.matchId,requestId:r.requestId,epoch:r.epoch,actor:r.actor});
 assert.throws(()=>m.dispatch(envelope(r,r.options[0].value)),/STALE/);
 const after=m.snapshot();assert.equal(after.match.rally,before.match.rally+1);assert.deepEqual(after.zones[r.actor+'.receive'],oldCards);assert.equal(after.match.server,1-r.actor);assert.equal(after.zones[r.actor+'.sets'].length,before.zones[r.actor+'.sets'].length-1);
 assert(after.match.notices.some(n=>n.type==='loss'&&n.reason==='主動 Loss（放棄這球）'));
}
const docs=fs.readFileSync(path.join(__dirname,'HOST-CONTRACT.md'),'utf8');
for(const kind of [...new Set([...host.gameKinds,...host.kernelKinds])])assert(docs.includes('| '+kind+' |'),'documented '+kind);
for(const file of ['../engine.js','core.js']){const source=fs.readFileSync(path.join(__dirname,file),'utf8');for(const m of source.matchAll(/(?:kind:\s*|_decide\(|_selection\([^\n]*?ctx,)'([a-zA-Z_]+)'/g)){if(['C','E','attack',...require('./core').capabilities.nodes].includes(m[1]))continue;assert([...host.gameKinds,...host.kernelKinds].includes(m[1]),'source kind '+m[1]);}}
const m=create(),r=next(m);assert(host.validateRequest(r));assert(host.validateAnswer(r,envelope(r,'serve')));assert(!host.validateAnswer(r,envelope(r,0)));assert(!host.validateRequest({...r,kind:'future'}));
assert.throws(()=>m.command({kind:'manual'}),/UNSUPPORTED_COMMAND/);
assert.throws(()=>new Match({decks:[F.decks.basic.map((c,i)=>i?'D01-009':'PR-022'),F.decks.basic]}),/UNSUPPORTED_SKILL/);
assert(!fs.readFileSync(path.join(__dirname,'match.js'),'utf8').includes("require('../engine"));
console.log(JSON.stringify({passed:true,restoredCriticalBoundaries:restores,invalidAnswersPreserveState:true,snapshotRngAndIdentity:true,privateViews:true,lossDuringPaymentAndTurnEnd:true,hostKinds:new Set([...host.gameKinds,...host.kernelKinds]).size,productionBridgeNotImported:true}));
