'use strict';
const assert=require('node:assert/strict'),T=require('./reveal-top-tests'),{attempt}=require('./decisions'),catalog=require('./data/cards.json');
const card=code=>catalog.cards.find(c=>c.card_no==='HV-'+code);assert.equal(T.testRevealTop(catalog),1);assert.equal(T.testMoveResult(catalog),1);for(const code of T.codes)T.testRevealCard(catalog,card(code));
// Mandatory reveal: first confirmation exposes no deck IDs; the second displays
// the top card while its watch/ban is still unapplied and the deck is unmoved.
{
 const f=T.setup(catalog,card('P01-010')),{k,shown}=f,before=k.snapshot(),invoke=()=>T.invoke(f),first=attempt(k,before,invoke,[]);assert.equal(first.boundary.request.kind,'reveal');assert(!JSON.stringify(first.boundary.request).includes(shown));assert.equal(first.boundary.state.effects.length,0);
 const tape=[{request:first.boundary.request,answer:true}],second=attempt(k,before,invoke,tape);assert.equal(second.boundary.request.kind,'revealResult');assert.deepEqual(second.boundary.request.options,[shown]);assert.equal(second.boundary.state.zones['0.deck'].at(-1),shown);assert.equal(second.boundary.state.effects.length,0);tape.push({request:second.boundary.request,answer:[]});const done=attempt(k,before,invoke,tape);assert.equal(done.state.zones['0.deck'][0],shown);assert.equal(done.state.effects.filter(e=>e.kind==='watch').length,1);assert.deepEqual(attempt(k,before,invoke,tape).state,done.state);
}
// QA1128: repeated opposing setters get -2, including zero becoming negative;
// the registered effect survives its source leaving and ends after that turn.
{
 const f=T.setup(catalog,card('P01-010')),{k,id}=f;T.invoke(f);k._atomic(()=>k._move(id,0,'drop',k._context(id,0)));k.endTurn();k.beginTurn(1,'toss');for(const code of ['HV-D01-009','HV-D04-003']){const x=k.addCard(code,1,'hand');k.enter(x,'toss');assert.equal(k.parameter(x,'toss'),k.card(x).printed.parameters.toss-2);}k.endTurn();k.beginTurn(0,'toss');const x=k.addCard('HV-D04-003',0,'hand');k.enter(x,'toss');assert.equal(k.parameter(x,'toss'),k.card(x).printed.parameters.toss);
}
// QA1243/1245: the revealed Event has no affiliation; no shared affiliation
// means success even though multiple schools are represented on the court.
for(const parameter of ['serve','block','receive','toss','attack']){
 const f=T.setup(catalog,card('P01-093'),'positive',parameter),{k,target}=f;T.invoke(f);assert.equal(k.parameter(target,parameter),k.card(target).printed.parameters[parameter]+1);const req=k.state.decisions.find(d=>d.request.kind==='parameter').request;assert(req.options.includes('block'),'A printed zero is selectable');
 k.endTurn();k.beginTurn(1,'receive');const event=k.addCard('HV-P01-075',1,'hand'),before=k.snapshot();assert.throws(()=>k.playEvent(event),/forbidden/,'QA1247: a receive Event also bearing attack is forbidden');assert.deepEqual(k.snapshot(),before);k.endTurn();k.beginTurn(0,'receive');assert(k.permission({action:'play_event',player:0,origin:'rule',icons:['receive','attack']}).allowed,'Ban expires');
}
// Per-name lock still permits a second Event placement without repeated skills.
for(const code of ['P01-092','P01-093']){const f=T.setup(catalog,card(code)),{k}=f;T.invoke(f);const second=k.addCard(card(code).card_no,0,'hand'),n=k.state.decisions.length;assert(k.playEvent(second).invalid);assert.equal(k.card(second).zone,'0.event');assert.equal(k.state.decisions.length,n);}
console.log('reveal-top/move-result: two node shapes, three cards, staged visible reveal, same-target bonus, all five parameters, negative setters, source departure, duplicate Events, dual-icon ban, expiry and replay passed');
