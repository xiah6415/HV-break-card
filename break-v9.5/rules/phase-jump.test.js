'use strict';
const assert=require('node:assert/strict'),T=require('./phase-jump-tests'),F=require('./frequent-node-tests'),catalog=require('./data/cards.json');
const cards=catalog.cards.filter(c=>['HV-P01-037','HV-P03-030'].includes(c.card_no));assert.equal(T.testPhaseJump(catalog),1);
for(const card of cards){T.testPhaseCard(catalog,card);
 const{k,id}=T.setup(catalog,card);k.resolveProgram({kind:'ban_action',actor:'self',action:'enter_character',scope:{printed_receive_gte:6},duration:'this_turn'},0,id);k.enter(id,'block');assert.equal(k.state.turn.phase,'draw');k.advancePhase('draw');const hand=k.zone(0,'hand').length;k.drawRule(0);assert.equal(k.zone(0,'hand').length,hand+1);
 const def=catalog.cards.find(c=>!c.profiles[0].program&&Number.isInteger(c.profiles[0].variants[0].printed.parameters.receive)&&c.profiles[0].variants[0].printed.affiliation_tags.includes('青葉城西')),target=k.addCard(def.card_no,0,'hand');k.advancePhase('receive');k.enter(target,'receive');assert.equal(k.parameter(target,'receive'),k.card(target).printed.parameters.receive+(card.card_no==='HV-P01-037'?3:2));
 const blocked=k.addCard('HV-D01-009',0,'hand');k.card(blocked).printed.parameters.receive=6;assert.throws(()=>k.enter(blocked,'receive'),/restriction|legal entry/);assert.equal(k.state.turn.id,1,'Jump preserves turn and its restrictions');
 k.endTurn();assert(!k.state.effects.some(e=>e.kind==='watch'));
}
// QA1162/1794: another entry skill waiting in the old block window is cancelled.
for(const [code,other]of [['P01-037','P01-054'],['P03-030','P03-026']]){
 const card=cards.find(c=>c.card_no==='HV-'+code),{k,id}=T.setup(catalog,card);for(let i=0;i<3;i++)k.addCard('HV-D01-009',0,'block');const second=k.addCard('HV-'+other,0,'hand');
 const old=k.choose;k.choose=r=>r.kind==='trigger_order'?r.options.find(q=>k.state.queue.find(x=>x.id===q).source.id===id):old(r);const base=k.card(second).printed.parameters.block;k.enterBlock([id,second],id);assert.equal(k.state.turn.phase,'draw');assert.equal(k.parameter(second,'block'),base);assert.equal(k.state.queue.length,0);assert.equal(k.state.events.filter(e=>e.type==='resolve_trigger').length,1,'Only the jump skill resolves');
}
// Exact tags: pseudo Youth does not satisfy Youth; the subsequent bonus itself is unrestricted.
{
 const card=cards.find(c=>c.card_no==='HV-P03-030'),{k,id}=T.setup(catalog,card);k.card(id).printed.affiliation_tags=['疑似ユース'];k.enter(id,'block');assert.equal(k.state.turn.phase,'block');
}
{
 const card=cards.find(c=>c.card_no==='HV-P03-030'),{k,id}=T.setup(catalog,card);k.enter(id,'block');k.advancePhase('receive');const target=k.addCard('HV-D01-009',0,'hand');k.enter(target,'receive');assert.equal(k.parameter(target,'receive'),4,'A non-Youth receiver also receives +2');
}
console.log('phase jump: unique shape, 2 real cards, >=8/short/decline/school, start of draw, same-turn bans, old trigger cancellation, receiver bonuses, expiry and replay passed');
