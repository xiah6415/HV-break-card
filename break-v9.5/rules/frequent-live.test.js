'use strict';
const assert=require('node:assert/strict'),E=require('../engine'),I=require('./node-inventory'),{fixture}=require('./batch-smoke'),{testModules}=require('./modules');
const catalog=require('./data/cards.json'),released=testModules(catalog).cards,roles=['serve','block','receive','toss','attack'],params={serve:'srv',block:'blk',receive:'rcv',toss:'tos',attack:'atk'};
(async()=>{
 for(const code of Object.keys(released)){
  const card=catalog.cards.find(c=>I.short(c.card_no)===code),p=card.profiles[0],phase=p.activation.skill_type==='passive'?p.activation.trigger.destination_any[0]:p.activation.activation_phases[0];
  const {k,id,entryReason='rule'}=fixture(card,p,phase,{rich:true,conditioned:true,expanded:true,max:true,key:'positive'},0,catalog),before=k.snapshot();
  const agent={wantsAck:true,async choose(g,p,r){if(r.kind==='skill')return true;if(r.kind==='guts'||r.kind==='gutsCourt')return r.options.slice(0,r.need).map(o=>o.value);return r.options.find(o=>o.label?.includes('其餘放到牌庫底'))?.value??r.options[0].value;}};
  const g=new E.Game({mode:'strict',seed:7,decks:['k1014','seijoh'],agents:[agent,agent]});
  for(const q of g.players){for(const [host,z]of Object.entries({hand:'hand',deck:'deck',drop:'drop',ev:'event',sets:'sets'}))q[host]=before.zones[q.idx+'.'+z].map(id=>I.short(before.cards[id].cardNo));for(const z of roles)q.area[z]=before.zones[q.idx+'.'+z].map(id=>I.short(before.cards[id].cardNo));}
  g.cardState=null;g.beginTurn(g.players[0]);g.ball={type:before.ball.kind,off:before.ball.offense};g.rulePhase={serve:'srv',block:'blk',draw:'drw',receive:'rcv',toss:'tos',attack:'atk'}[phase];
  if(p.activation.skill_type==='passive'){k.enter(id,phase,{reason:entryReason});await g.enterCharacter(g.players[0],phase,code);}
  else {p.activation.skill_type==='event'?k.playEvent(id):k.useSkill(id);await g.resolve(g.players[0],code,g.rulePhase);}
  for(const q of g.players){
   for(const [host,z]of Object.entries({hand:'hand',deck:'deck',drop:'drop',ev:'event',sets:'sets'}))assert.deepEqual(q[host],k.zone(q.idx,z).map(id=>I.short(k.card(id).cardNo)),code+' '+host);
   for(const area of roles){const top=k.top(q.idx,area);if(!top)continue;for(const [parameter,old]of Object.entries(params))assert.equal(g.parameter(q,area,old),k.parameter(top,parameter)==='dash'?null:k.parameter(top,parameter),code+' '+area+'.'+parameter);}
  }
 }
 console.log('live frequent batch: '+Object.keys(released).length+' cards; persistent-core vs public-game zones and all parameters passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
