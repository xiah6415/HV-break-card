'use strict';
const assert=require('node:assert/strict'),T=require('./source-cover-tests'),C=require('./covered-tests'),E=require('../engine'),I=require('./node-inventory'),catalog=require('./data/cards.json'),data=require('./runtime-data.json');
(async()=>{let n=0;
 for(const code of T.codes)for(const mode of ['positive','wrong_tag','wrong_role','short','wrong_fee','decline','invalid']){
  const f=T.setup(catalog,catalog.cards.find(c=>c.card_no==='HV-'+code),mode),{k}=f,logs=[],requests=[];
  const agent={async choose(g,p,r){requests.push(r);if(mode==='decline'){const skip=r.options.find(o=>o.label==='不登場'||o.value===false);if(skip)return skip.value;}if(r.kind==='skill')return true;if(r.kind==='guts')return r.options.slice(0,r.need).map(o=>o.value);return r.options[0].value;}},g=new E.Game({seed:7,mode:'strict',decks:['k1014','seijoh'],agents:[agent,agent],onLog:s=>logs.push(s)});C.install(g,k);Object.assign(g.rngState,k.state.rng);if(k.state.effects.length)g.sharedRulesState={version:1,fingerprint:data.fingerprint,next:k.state.next,effects:structuredClone(k.state.effects),receipts:[]};
  const rng=structuredClone(g.rngState);if(f.p.activation.skill_type==='event'){g.playable(g.players[0],g.rulePhase);assert.deepEqual(g.rngState,rng);}
  T.invoke(f);if(f.p.activation.skill_type==='event')await g.resolve(g.players[0],code,g.rulePhase);else await g.enterCharacter(g.players[0],f.phase,I.short(k.card(f.target).cardNo));
  for(const p of g.players){for(const[h,z]of Object.entries({hand:'hand',deck:'deck',drop:'drop',ev:'event',sets:'sets'}))assert.deepEqual(p[h],k.zone(p.idx,z).map(x=>I.short(k.card(x).cardNo)),code+' '+mode+' '+z);for(const[z,param]of Object.entries({serve:'srv',block:'blk',receive:'rcv',toss:'tos',attack:'atk'})){assert.deepEqual(p.area[z],k.zone(p.idx,z).map(x=>I.short(k.card(x).cardNo)),code+' '+mode+' '+z);const top=k.top(p.idx,z);if(top)for(const[parameter,old]of Object.entries({serve:'srv',block:'blk',receive:'rcv',toss:'tos',attack:'atk'}))assert.equal(g.parameter(p,z,old),k.parameter(top,parameter)==='dash'?null:k.parameter(top,parameter),code+' '+mode+' '+z+'.'+parameter);}}
  assert.deepEqual(g.rngState,rng);for(const p of g.players)assert.deepEqual(p.ts.sides,['side:0','side:1'].map(z=>k.top(p.idx,z)).filter(Boolean).map(x=>I.short(k.card(x).cardNo)));n++;
 }
 console.log('source cover live: '+n+' real game/core cases; exact-name fees, Youth/role conditions, invalidation, all zones/parameters and side identities passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
