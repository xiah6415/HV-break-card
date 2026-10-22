'use strict';
const assert=require('node:assert/strict'),E=require('../engine'),T=require('./event-played-tests'),C=require('./covered-tests'),I=require('./node-inventory'),B=require('./legacy'),catalog=require('./data/cards.json');
const params={serve:'srv',block:'blk',receive:'rcv',toss:'tos',attack:'atk'};
function compare(g,k,label){for(const p of g.players){for(const[h,z]of Object.entries({hand:'hand',deck:'deck',drop:'drop',ev:'event',sets:'sets',...Object.fromEntries(Object.keys(params).map(z=>[z,z]))}))assert.deepEqual(p.area[h]||p[h],k.zone(p.idx,z).map(id=>I.short(k.card(id).cardNo)),label+' '+h);for(const z of Object.keys(params)){const top=k.top(p.idx,z);if(top)for(const [param,old]of Object.entries(params))assert.equal(g.parameter(p,z,old),k.parameter(top,param)==='dash'?null:k.parameter(top,param),label+' '+z+'.'+param);}}}
(async()=>{
 let n=0;for(const no of ['P02-007','P03-039'])for(const mode of ['positive','decline','short','wrong_role']){
  const card=catalog.cards.find(c=>c.card_no==='HV-'+no),{k,id,event,dest}=T.setup(catalog,card,mode),choose=k.choose,questions=[];
  k.choose=r=>r.kind==='target'?r.options.slice(0,r.count):choose(r);
  const agent={wantsAck:true,async choose(g,p,r){questions.push(r);if(r.kind==='skill'){if(no==='P03-039')assert.equal(g.parameter(p,'serve','srv'),6,'Public UI asks the fee after the Event sets serve to 6');return mode!=='decline';}if(r.kind==='guts')return r.options.slice(0,r.need).map(o=>o.value);return r.options[0].value;}};
  const g=new E.Game({seed:7,mode:'strict',decks:['k1014','seijoh'],agents:[agent,agent]});C.install(g,k);const code=I.short(k.card(event).cardNo);k.playEvent(event);await g.resolve(g.players[0],code,g.rulePhase);compare(g,k,no+' '+mode);
  const state=JSON.stringify(g.cardSnapshot()),actual=Object.values(g.cardState.cards).find(c=>c.code===code&&c.zone==='0.drop'||c.code===code&&c.zone==='0.ev');
  if(actual){const effects=JSON.stringify(g.sharedRulesState);await B.eventPlayed(g,g.players[0],actual.id,g.rulePhase);assert.equal(JSON.stringify(g.cardSnapshot()),state,'Duplicate Event receipt does not pay again');assert.equal(JSON.stringify(g.sharedRulesState),effects);}
  n++;
 }
 // Old-controller Event goes through the same after-resolution notification, but only when a matching observer exists.
 {
  const card=catalog.cards.find(c=>c.card_no==='HV-P03-039'),{k,id,event}=T.setup(catalog,card),agent={async choose(g,p,r){if(r.kind==='skill')return true;return r.options[0].value;}};
  const g=new E.Game({seed:7,mode:'strict',decks:['k1014','seijoh'],agents:[agent,agent]});C.install(g,k);const p=g.players[0];
  // A physical Event placement is not a play; notify the completed play explicitly (the numeric/legacy host API).
  const ref=B.eventPlayStarted(g,p,'P03-091');g.moveCode(p.hand,p.ev,'P03-091');const base=g.parameter(p,'serve','srv');await B.eventPlayed(g,p,ref,'srv');assert.equal(g.parameter(p,'serve','srv'),base+1);assert(p.drop.includes('P03-091'));
 }
 console.log('event-played live: '+n+' exact core/host states, post-effect payment UI, duplicate receipts and explicit numeric/legacy notification passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
