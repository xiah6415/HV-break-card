'use strict';
const assert=require('node:assert/strict'),E=require('../engine'),bridge=require('./legacy'),{Match}=require('./match');
const T=require('./node-module-tests'),I=require('./node-inventory'),F=require('./match-pilot-fixtures'),HC=require('../host-choice');
const catalog=require('./data/cards.json'),codes=Object.keys(require('./modules').testModules(catalog).cards);
(async()=>{
 for(const code of codes){
  const card=catalog.cards.find(c=>I.short(c.card_no)===code),n=I.nodes(card.profiles[0]).find(n=>n.kind==='deck_selection');
  if(I.dependencies(card).some(kind=>!['sequence','deck_selection'].includes(kind)))continue;
  const {k,ctx,shown}=T.deckFixture(catalog,n),seen=[];
  const agent={wantsAck:true,async choose(g,p,r){seen.push(r);return r.options.find(o=>o.value===1)?.value??r.options[0].value;}};
  const g=new E.Game({seed:7,decks:['k1014','seijoh'],agents:[agent,E.AI]});
  for(const p of g.players){p.hand=[];p.deck=[];p.drop=[];p.ev=[];p.sets=[];for(const key of Object.keys(p.area))p.area[key]=[];}
  const p=g.players[0];g.beginTurn(p);p.hand=[code];p.deck=k.zone(0,'deck').map(id=>I.short(k.card(id).cardNo));
  const phase={draw:'drw',receive:'rcv',toss:'tos',attack:'atk',serve:'srv',block:'blk'}[card.profiles[0].activation.activation_phases[0]];
  assert(bridge.canPlay(g,p,code,phase));await g.resolve(p,code,phase);
  assert.deepEqual(p.ev,[code]);assert(p.hand.length>0);assert(seen[0].options.every(o=>!o.card),'flip must not leak the hidden cards');
  assert(seen.some(r=>r.options.filter(o=>o.card).length===shown.length),'player sees every viewed card');
  assert(p.deck.length<shown.length+1);
  const deck=[...F.decks.basic.slice(0,32),...Array(8).fill(code)],m=new Match({seed:7,id:code,decks:[deck,deck]});
  let viewed=0,steps=0;
  while(m.snapshot().match.phase!=='finished'&&steps++<1000){
   let r=m.request(0)||m.request(1);
   if(r.kind==='revealResult'){viewed++;const snapshot=m.snapshot();m.restore(snapshot);r=m.request(0)||m.request(1);assert.equal(r.input.max,0);}
   const q=F.newQuestion(m,r),value=r.kind==='move_count'?r.options.at(-1).value:F.newAnswer(q,F.select(q,F.newState(m),r.actor,{mulligan:true,preferBlock:true}));
   let answer=HC.makeAnswer(r,value);if(!HC.validate(r,answer).ok)answer=HC.aiAnswer(r);assert(HC.validate(r,answer).ok);m.dispatch(answer);
  }
  assert.equal(m.snapshot().match.phase,'finished');assert(viewed>0);
  console.log(code+': old live game + full persistent match + private flip + viewed-card restore passed');
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
