'use strict';
const assert=require('node:assert/strict'),I=require('./node-inventory'),{fixture}=require('./batch-smoke'),catalog=require('./data/cards.json');
const card=code=>catalog.cards.find(c=>I.short(c.card_no)===code),basic=catalog.cards.find(c=>!c.profiles[0].program&&c.type==='character').card_no,event=catalog.cards.find(c=>c.type==='event').card_no;
function setup(code,cards=[]){const c=card(code),p=c.profiles[0],phase=p.activation.skill_type==='passive'?p.activation.trigger.destination_any[0]:p.activation.activation_phases[0],f=fixture(c,p,phase,{rich:true,conditioned:true,expanded:true,max:true,key:'positive'},0,catalog);for(const id of [...f.k.zone(0,'deck')])f.k._atomic(()=>f.k._move(id,0,'sets',f.k._context(f.id,0)));const ids=cards.slice().reverse().map(no=>f.k.addCard(no,0,'deck')).reverse();f.phase=phase;f.milled=ids;f.invoke=()=>p.activation.skill_type==='event'?f.k.playEvent(f.id):f.k.enter(f.id,phase);return f;}
for(const code of ['P04-039','P04-043','P04-045','P04-095'])for(const events of [0,1,2,3]){
 const f=setup(code,[...Array(events).fill(event),...Array(3-events).fill(basic),basic]),{k,id}=f,before=k.snapshot();f.invoke();const after=k.snapshot(),fx=after.effects.slice(before.effects.length),added=after.events.slice(before.events.length).filter(e=>e.type==='move'&&e.from==='0.deck'&&e.to==='0.hand').length;
 assert.deepEqual(k.zone(0,'drop').filter(x=>f.milled.includes(x)),f.milled.slice(0,3),'Only the chosen three top cards are milled');
 if(code==='P04-039')assert.equal(fx.filter(e=>e.kind==='numeric'&&e.parameter==='attack').reduce((n,e)=>n+e.value,0),[0,2,4,8][events]);
 if(code==='P04-043'){assert.equal(fx.filter(e=>e.kind==='keyword').length,events?1:0);if(events)assert.equal(k.outgoing('attack',1).offense,events===1?4:7);}
 if(code==='P04-045'){assert.equal(fx.filter(e=>e.kind==='numeric').reduce((n,e)=>n+e.value,0),events?2:0);assert.equal(added,events>=2?1:0);}
 if(code==='P04-095'){assert.equal(fx.filter(e=>e.kind==='numeric').length,events?2:1);assert.equal(added,events?1:0);if(events)assert.equal(fx.filter(e=>e.kind==='numeric')[0].target.id,fx.filter(e=>e.kind==='numeric')[1].target.id,'Keep original chosen character');}
 k.restore(before);f.invoke();assert.deepEqual(k.snapshot(),after,'Mill counted-Event threshold Undo '+code+' '+events);
}
for(const [code,tag]of [['P01-051','梟谷'],['P04-051','和久谷南']])for(const mode of ['hit','miss','empty']){
 const match=catalog.cards.find(c=>!c.profiles[0].program&&c.profiles[0].variants[0].printed.affiliation_tags.includes(tag)).card_no,f=setup(code,mode==='empty'?[]:[mode==='hit'?match:basic]),{k}=f,start=k.snapshot();f.invoke();
 assert.equal(k.state.ball.offense,start.ball.offense-(mode==='hit'?3:0));assert.equal(k.state.turn.phase,mode==='hit'?'draw':'block');assert.equal(k.zone(0,'drop').filter(x=>f.milled.includes(x)).length,mode==='empty'?0:1);if(mode==='empty')assert(!k.state.decisions.slice(start.decisions.length).some(d=>d.request.kind==='activate_payment'));
}
for(const size of [0,1,2]){
 const match=catalog.cards.find(c=>!c.profiles[0].program&&c.profiles[0].variants[0].printed.affiliation_tags.includes('白鳥沢')&&c.profiles[0].variants[0].printed.year_tags.includes(3)).card_no,f=setup('P04-062',Array(size).fill(match)),{k,id}=f,printed=k.card(id).printed.parameters.receive;f.invoke();assert.equal(k.parameter(id,'receive'),printed+2,'Earlier paid bonus survives short/empty effect deck');assert.equal(k.zone(0,'hand').filter(x=>f.milled.includes(x)).length,size?1:0,'Retrieve only an actual milled card');
}
{
 const f=setup('PR-027'),{k,id}=f;f.invoke();k._atomic(()=>k._move(id,0,'drop',k._context(id,0)));k.endTurn();k.beginTurn(1);const a=k.addCard(basic,1,'hand'),b=k.addCard(basic,1,'hand'),own=k.zone(0,'deck').length,deck=k.zone(1,'deck').length;
 k.notifyHandAdditions([{player:1,card:a,operation:'add_hand'},{player:1,card:b,operation:'add_hand'}]);assert.equal(k.zone(1,'deck').length,Math.max(0,deck-6));assert.equal(k.zone(0,'deck').length,own);const before=k.zone(1,'drop').length;k.drawRule(1);assert.equal(k.zone(1,'drop').length,before,'Rule draws do not trigger non-draw additions');
}
console.log('mill cards: Event counts 0/1/2/3, exact empty cost, short effect, same-target bonus, actual-mill retrieval, opponent repeated additions and Undo passed');
