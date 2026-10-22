'use strict';
const assert=require('node:assert/strict'),E=require('../engine'),I=require('./node-inventory'),{setup}=require('./entry-observer-tests'),catalog=require('./data/cards.json');
const params={serve:'srv',block:'blk',receive:'rcv',toss:'tos',attack:'atk'},roles=Object.keys(params),B=require('./legacy');
(async()=>{
 let count=0;
 for(const card of I.scope(catalog).filter(c=>I.entryKey(c)==='passive:character_entry'&&require('./modules').eligible(c)))for(const mode of ['positive','wrong_role','short']){
  const f=setup(catalog,card,mode),{k,id,target,dest}=f,before=k.snapshot(),choose=k.choose;
  k.choose=r=>r.kind==='parameter'?r.options.at(-1):choose(r);
  const agent={wantsAck:true,async choose(g,p,r){if(r.kind==='skill')return true;if(r.kind==='guts')return r.options.slice(0,r.need).map(o=>o.value);return r.options[0].value;}};
  const g=new E.Game({mode:'strict',seed:7,decks:['k1014','seijoh'],agents:[agent,agent]});
  for(const p of g.players){for(const [h,z]of Object.entries({hand:'hand',deck:'deck',drop:'drop',ev:'event',sets:'sets'}))p[h]=before.zones[p.idx+'.'+z].map(x=>I.short(before.cards[x].cardNo));for(const z of roles)p.area[z]=before.zones[p.idx+'.'+z].map(x=>I.short(before.cards[x].cardNo));}
  g.cardState=null;g.beginTurn(g.players[0]);for(const p of g.players)p.ts.sides=[...before.zones[p.idx+'.side:0'],...before.zones[p.idx+'.side:1']].map(x=>I.short(before.cards[x].cardNo));g.rulePhase={serve:'srv',block:'blk',receive:'rcv',toss:'tos',attack:'atk'}[dest];g.ball={type:'attack',off:8};
  const code=I.short(k.card(target).cardNo);k.enter(target,dest);if(dest==='attack')await g.enterAttack(g.players[0],code);else await g.enterCharacter(g.players[0],dest,code);
  for(const p of g.players){for(const [h,z]of Object.entries({hand:'hand',deck:'deck',drop:'drop',ev:'event',sets:'sets'}))assert.deepEqual(p[h],k.zone(p.idx,z).map(x=>I.short(k.card(x).cardNo)),card.card_no+' '+mode+' '+h);
   for(const z of roles){assert.deepEqual(p.area[z],k.zone(p.idx,z).map(x=>I.short(k.card(x).cardNo)));const top=k.top(p.idx,z);if(top)for(const [param,old]of Object.entries(params))assert.equal(g.parameter(p,z,old),k.parameter(top,param)==='dash'?null:k.parameter(top,param),card.card_no+' '+mode+' '+z+'.'+param);}}
  if(card.card_no==='HV-P03-033'&&mode==='positive')assert.equal(g.players[0].ts.attacker,'P03-033','Back attack uses actual substituted attacker');
  if(card.card_no==='HV-P03-016'&&mode==='positive'){k.state.turn.phase='attack';k.enter(id,'attack');g.rulePhase='atk';await g.enterAttack(g.players[0],'P03-016');assert.equal(g.parameter(g.players[0],'attack','atk'),k.parameter(id,'attack'));assert.equal(k.parameter(id,'attack'),k.card(id).printed.parameters.attack+2,'Generated watch follows the returned source into a new character instance');}
  if(card.card_no==='HV-PR-023'&&mode==='positive'){const saved=JSON.stringify(g.cardSnapshot());await B.charactersEntered(g,g.players[0],[{key:dest}]);assert.equal(JSON.stringify(g.cardSnapshot()),saved,'Duplicate actual-entry receipt cannot charge twice');}
  count++;
 }
 console.log('entry observer live: '+count+' real entry/cost/absent-source cases, physical zones, all parameters and replaced attacker match the core');
})().catch(e=>{console.error(e);process.exitCode=1;});
