'use strict';
const assert=require('node:assert/strict'),T=require('./shuffle-node-tests'),C=require('./covered-tests'),E=require('../engine'),I=require('./node-inventory'),catalog=require('./data/cards.json'),data=require('./runtime-data.json');
(async()=>{let n=0;
 for(const code of T.codes)for(const mode of ['positive','decline',...(code==='P01-034'||code==='PR-024'?['short','no_add','empty_hand']:code==='P04-093'?['no_court','empty_drop','both_empty','mixed_drop','empty']:['empty','no_target','no_add'])]){
  const f=T.setup(catalog,catalog.cards.find(c=>c.card_no==='HV-'+code),mode),{k}=f,logs=[];
  const agent={async choose(g,p,r){if(r.kind==='skill')return mode!=='decline';if(r.kind==='guts')return r.options.slice(0,r.need).map(o=>o.value);return r.options[0].value;}},g=new E.Game({seed:7,mode:'strict',decks:['k1014','seijoh'],agents:[agent,agent],onLog:s=>logs.push(s)});C.install(g,k);Object.assign(g.rngState,k.state.rng);if(k.state.effects.length)g.sharedRulesState={version:1,fingerprint:data.fingerprint,next:k.state.next,effects:structuredClone(k.state.effects),receipts:[]};
  const rng=structuredClone(g.rngState);if(f.p.activation.skill_type==='event'){g.playable(g.players[0],g.rulePhase);assert.deepEqual(g.rngState,rng,'Event preview must not consume shuffle randomness');}
  T.invoke(f);if(f.p.activation.skill_type==='event')await g.resolve(g.players[0],code,g.rulePhase);else await g.enterCharacter(g.players[0],f.phase,code);
  assert.deepEqual(g.rngState,k.state.rng,code+' '+mode+' exact RNG checkpoint');
  for(const p of g.players){for(const[h,z]of Object.entries({hand:'hand',deck:'deck',drop:'drop',ev:'event',sets:'sets'}))assert.deepEqual(p[h],k.zone(p.idx,z).map(x=>I.short(k.card(x).cardNo)),code+' '+mode+' '+z);for(const[z,param]of Object.entries({serve:'srv',block:'blk',receive:'rcv',toss:'tos',attack:'atk'})){assert.deepEqual(p.area[z],k.zone(p.idx,z).map(x=>I.short(k.card(x).cardNo)));const top=k.top(p.idx,z);if(top)assert.equal(g.parameter(p,z,param),k.parameter(top,z)==='dash'?null:k.parameter(top,z));}}
  assert.equal(logs.filter(s=>s.includes('洗牌（')).length,k.state.publicLog.filter(e=>e.type==='deck_shuffled').length,'One visible count-only shuffle notice');n++;
 }
 console.log('shuffle live: '+n+' actual host/core hand-deck order, all zones/parameters, bans, cost/optional cases, logs and preview/RNG neutrality passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
