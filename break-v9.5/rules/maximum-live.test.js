'use strict';
const assert=require('node:assert/strict'),T=require('./maximum-tests'),C=require('./covered-tests'),E=require('../engine'),I=require('./node-inventory'),catalog=require('./data/cards.json'),runtime=require('./runtime-data.json'),B=require('./legacy');
(async()=>{let count=0;
 for(const mode of ['positive','wrong_role','wrong_phase','invalid','external']){
  const f=T.setup(catalog,catalog.cards.find(c=>c.card_no==='HV-P03-047'),mode,4),{k,id}=f,agent={async choose(g,p,r){if(r.kind==='skill')return true;return r.options[0].value;}},g=new E.Game({seed:7,mode:'strict',decks:['k1014','seijoh'],agents:[agent,agent]});C.install(g,k);g.rulePhase=f.phase==='attack'?'atk':'rcv';for(const b of f.initialBoost)g.boostParameter(g.players[0],b.key,b.param,b.value);if(mode==='invalid')g.sharedRulesState={version:1,fingerprint:runtime.fingerprint,next:k.state.next,effects:structuredClone(k.state.effects.filter(e=>e.kind!=='numeric')),receipts:[]};
  const p=g.players[0];if(mode!=='wrong_role'){p.ts.setter='P03-047';p.ts.setterRef=g.roleReference(p,'toss');p.ts.toss=g.parameter(p,'toss','tos');}
  for(const [i,event]of f.events.entries()){
   k.playEvent(event);await g.resolve(p,'P03-096',g.rulePhase);assert.equal(g.parameter(p,mode==='wrong_role'?'receive':'toss','tos'),k.parameter(id,'toss'),mode+' Event '+(i+1));if(mode!=='wrong_role')assert.equal(p.ts.toss,k.parameter(id,'toss'),'Cached zero setter value updates exactly once');for(const[h,z]of Object.entries({hand:'hand',deck:'deck',drop:'drop',ev:'event',sets:'sets'}))assert.deepEqual(p[h],k.zone(0,z).map(x=>I.short(k.card(x).cardNo)),mode+' '+z);
   const ref=g.cardReference(p,'ev',i),before=JSON.stringify(g.cardSnapshot()),value=g.parameter(p,mode==='wrong_role'?'receive':'toss','tos');await B.eventPlayed(g,p,ref.id,g.rulePhase);assert.equal(g.parameter(p,mode==='wrong_role'?'receive':'toss','tos'),value,'Duplicate Event receipt never adds a second point');assert.equal(JSON.stringify(g.cardSnapshot()),before);
  }count++;
 }
 console.log('source skill maximum live: '+count+' four-Event game/core cases; cached zero setter, independent high bonus, phase/role/invalidation, invalid Event placement and duplicate receipt passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
