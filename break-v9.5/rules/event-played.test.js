'use strict';
const assert=require('node:assert/strict'),T=require('./event-played-tests'),catalog=require('./data/cards.json');
const cards=catalog.cards.filter(c=>['HV-P02-007','HV-P03-039'].includes(c.card_no));
for(const c of cards)T.testEventCard(catalog,c);
// QA1269: the Event's own draw and +1 settle before the optional three-Guts cost.
{
 const{k,id,event}=T.setup(catalog,cards.find(c=>c.card_no==='HV-P02-007')),choose=k.choose,base=k.card(id).printed.parameters.attack;
 k.choose=r=>{if(r.kind==='activate_payment'){assert.equal(k.parameter(id,'attack'),base+1);assert.equal(k.zone(0,'hand').length,1);assert(k.zone(0,'event').includes(event));assert.equal(k.state.queue.length,0);}return choose(r);};k.playEvent(event);
}
// QA1268/1799: each play creates a fresh opportunity; costs cannot be doubled in one use.
for(const c of cards){
 const{k,id,event,dest}=T.setup(catalog,c),serve=dest==='serve';
 if(serve){k._move(event,0,'deck',k._context(id,0));for(let i=0;i<2;i++)k.addCard('HV-P02-086',0,'event');}
 const one=serve?k.addCard('HV-P02-086',0,'hand'):event,two=k.addCard(serve?'HV-P02-086':'HV-P02-082',0,'hand'),base=k.parameter(id,dest),before=k.snapshot();
 k.playEvent(one);k.playEvent(two);assert.equal(k.parameter(id,dest),base+(serve?2:10));
 if(serve)assert.equal(k.zone(0,'event').length,1,'Two plays pay exactly four of five available Events');else assert.equal(k.zone(0,'attack').length,1,'Two plays pay all six Guts');
 const after=k.snapshot();k.restore(before);k.playEvent(one);k.playEvent(two);assert.deepEqual(k.snapshot(),after);
}
// P03-039: the just-played Event remains a valid Event-zone candidate (documented inference).
{
 const{k,id,event}=T.setup(catalog,cards.find(c=>c.card_no==='HV-P03-039'));k.playEvent(event);assert.equal(k.card(event).zone,'0.drop');assert.equal(k.parameter(id,'serve'),7);assert.equal(k.zone(0,'hand').length,2,'Its already-created moved-source watch still draws after it pays itself');
}
// Effect placement and non-serve play do not meet the trigger.
{
 const c=cards.find(c=>c.card_no==='HV-P03-039'),{k,id,event}=T.setup(catalog,c);k.resolveProgram({kind:'move_self',destination:'owner.event'},0,event);assert.equal(k.parameter(id,'serve'),k.card(id).printed.parameters.serve);assert(!k.state.events.some(e=>e.type==='event_played'));
}
{
 const{k,id,event}=T.setup(catalog,cards.find(c=>c.card_no==='HV-P03-039'));k.state.turn.phase='draw';k.playEvent(event);assert.equal(k.parameter(id,'serve'),k.card(id).printed.parameters.serve);
}
// Invalidated Event effects still count as a played Event; character invalidation suppresses the passive.
for(const type of ['event','character']){
 const{k,id,event}=T.setup(catalog,cards.find(c=>c.card_no==='HV-P03-039'));k.resolveProgram({kind:'invalidate_skill',actor:'self',selector:{type},duration:'this_turn'},0,id);k.playEvent(event);
 assert.equal(k.parameter(id,'serve'),type==='event'?k.card(id).printed.parameters.serve+1:6);
}
{const{k,id,event}=T.setup(catalog,cards.find(c=>c.card_no==='HV-P02-007')),base=k.parameter(id,'attack');k.playEvent(event);k.resolveProgram({kind:'move_self',destination:'owner.hand'},0,event);k.playEvent(event);assert.equal(k.parameter(id,'attack'),base+10);assert.equal(k.card(event).eventPlaySerial,2);}
// The third entry shape is tested independently of P03-047's still-unreleased cap module.
for(const mode of ['positive','phase','origin','role','type']){
 const k=require('./frequent-node-tests').game(catalog),id=k.addCard('HV-P03-047',0,mode==='role'?'receive':'toss'),event=k.addCard(mode==='type'?'HV-D01-009':'HV-P02-082',0,'event');k.state.turn.phase=mode==='phase'?'draw':'attack';let seen=0;
 k._resolveSkill=(p,ctx)=>{assert.equal(ctx.source.id,id);seen++;return true;};
 k._atomic(()=>{k._emit({type:'event_played',player:0,card:event,origin:mode==='origin'?'drop':'hand',playSerial:1});k._drain();});assert.equal(seen,mode==='positive'?1:0,'Toss-source / attack-Event trigger '+mode);
}
console.log('event-played: two cards, after-effect timing, repeated plays, exact/insufficient costs, just-played Event fee, placement/phase negatives, invalidation and replay passed');
