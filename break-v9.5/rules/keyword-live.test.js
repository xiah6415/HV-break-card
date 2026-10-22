'use strict';
const assert=require('node:assert/strict'),E=require('../engine'),B=require('./legacy'),I=require('./node-inventory'),{fixture}=require('./batch-smoke');
const catalog=require('./data/cards.json'),roles=['serve','block','receive','toss','attack'],phaseMap={serve:'srv',block:'blk',receive:'rcv',toss:'tos',attack:'atk',draw:'drw'};
const agent={wantsAck:true,async choose(g,p,r){if(r.kind==='skill')return true;if(r.kind==='guts'||r.kind==='gutsCourt')return r.options.slice(0,r.need).map(o=>o.value);if(r.ctx?.keywordOutgoing)return Math.max(...r.options.map(o=>o.value));return r.options[0].value;}};
function blank(){const g=new E.Game({seed:7,decks:['k1014','seijoh'],agents:[agent,agent]});for(const p of g.players){for(const z of ['hand','deck','drop','ev','sets'])p[z]=[];for(const z of roles)p.area[z]=[];}g.beginTurn(g.players[0]);g.ball={type:'attack',off:1};g.rulePhase='blk';return g;}
function prepared(code,edit=()=>{}){const card=catalog.cards.find(c=>I.short(c.card_no)===code),p=card.profiles[0],phase=p.activation.skill_type==='passive'?p.activation.trigger.destination_any[0]:p.activation.activation_phases[0],{k}=fixture(card,p,phase,{rich:true,max:true,conditioned:true,expanded:true,key:'positive'},0,catalog),s=k.snapshot(),g=blank();for(const q of g.players){for(const [host,z]of Object.entries({hand:'hand',deck:'deck',drop:'drop',ev:'event',sets:'sets'}))q[host]=s.zones[q.idx+'.'+z].map(id=>I.short(s.cards[id].cardNo));for(const z of roles)q.area[z]=s.zones[q.idx+'.'+z].map(id=>I.short(s.cards[id].cardNo));q.ts.sides=[...s.zones[q.idx+'.side:0'],...s.zones[q.idx+'.side:1']].map(id=>I.short(s.cards[id].cardNo));}g.ball={type:s.ball.kind,off:s.ball.offense};g.rulePhase=phaseMap[phase];edit(g);g.cardState=null;return {g,phase};}
(async()=>{
 for(const side of [false,true]){
  const g=blank(),[p,o]=g.players;p.hand=['P02-038'];p.area.block=['D01-009'];o.hand=['D01-009'];
  if(side){g.moveCode(p.hand,p.ts.sides ||= [],'P02-038');await B.charactersEntered(g,p,[{key:'side:0',origin:'hand',reason:'rule'}]);}else await g.enterCharacter(p,'block','P02-038');
  await B.judgment(g,p,'block_success',{defense:99});assert.equal(g.sharedRulesState.effects.filter(e=>e.kind==='watch'&&e.event==='character_entry').length,side?1:0,'Side-only follow-up before cleanup');
  // Multiple end replacements use a regular choice, with readable numeric options.
  if(side){const e=g.sharedRulesState.effects.find(e=>e.kind==='keyword'&&e.keyword==='doshat');g.sharedRulesState.effects.push({...JSON.parse(JSON.stringify(e)),id:'second-doshat',N:7});}
  assert.equal((await B.outgoing(g,p,'block',0)).off,side?7:4);
  if(p.ts.sides?.length)g.cleanupSides(p);g.finishTurn(p);g.beginTurn(o);g.rulePhase='rcv';await g.enterCharacter(o,'receive','D01-009');assert.equal(g.parameter(o,'receive','rcv'),E.st('D01-009','rcv')-(side?1:0));
 }
 {
  const g=blank(),p=g.players[0];g.ball.off=8;p.hand=['P01-060'];p.area.block=['D01-009','D01-009'];p.agent={...agent,async choose(g,p,r){if(r.kind==='block')return {cards:['P01-060'],center:'P01-060'};return agent.choose(g,p,r);}};let called=0;g.receiveTurn=async()=>{called++;assert.equal(g.ball.off,6);return {type:'attack',off:7};};assert.deepEqual(await g.blockTurn(p,[]),{type:'attack',off:7});assert.equal(called,1,'One-touch skips failed block and goes to own draw');
 }
 for(const touch of [false,true]){
  const {g}=prepared('P01-068',g=>{const o=g.players[1];o.hand=[touch?'P01-060':'D01-009'];if(touch)o.area.block=['D01-009','D01-009'];});const [p,o]=g.players;await g.enterCharacter(p,'attack','P01-068');g.finishTurn(p);g.beginTurn(o);g.rulePhase='blk';
  if(touch){await g.enterCharacter(o,'block','P01-060');assert.equal(o.ts.keywordJump,'draw','Own phase jump removes queued opponent blockout');}
  else await assert.rejects(g.enterCharacter(o,'block','D01-009'),e=>e.who===o&&e.why.includes('ブロックアウト'));
 }
 {
  const {g}=prepared('P01-041'),[p,o]=g.players;await g.enterCharacter(p,'attack','P01-041');assert.equal((await B.outgoing(g,p,'attack',99)).off,4);g.finishTurn(p);g.beginTurn(o);assert.equal(g.blockMax(o),0,'Feint prevents both normal and skill block entry');
 }
 {
  const {g}=prepared('P04-054',g=>{g.players[0].area.toss=['D04-003'];g.players[0].hand.push('D03-007');});const p=g.players[0];await g.enterCharacter(p,'receive','P04-054');g.rulePhase='tos';await g.enterCharacter(p,'toss','D03-007');assert.equal(g.parameter(p,'toss','tos'),E.st('D03-007','tos')+1);g.moveCode(p.area.toss,p.drop,'D03-007');assert.equal(g.parameter(p,'toss','tos'),E.st('D04-003','tos'),'Exposing Guts never counts as entry');
 }
 {
  const g=blank(),p=g.players[0];p.hand=['D04-005'];g.ball.off=2;p.agent={...agent,async choose(g,p,r){if(r.kind==='block')return {cards:['D04-005'],center:'D04-005'};return agent.choose(g,p,r);}};const place=g.place.bind(g);g.place=(p,a,c)=>{place(p,a,c);g.effect(p,a).mods.blk=-E.st(c,'blk');};await assert.rejects(g.blockTurn(p,[]),e=>e.who===p&&e.why.includes('攔網'));assert.equal(p.ts.keywordResolved,undefined,'A failed block never becomes a doshat return');
 }
 console.log('keyword live: side success / multiple end values / one-touch flow / blockout and jump cancellation / feint / A-pass exposure passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
