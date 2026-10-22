'use strict';
const assert=require('node:assert/strict'),T=require('./external-tests'),C=require('./covered-tests'),E=require('../engine'),I=require('./node-inventory'),catalog=require('./data/cards.json');
(async()=>{let n=0;
 for(const code of T.codes)for(const mode of code==='P02-048'?['positive','tails','short','empty','decline']:code==='PR-037'?['positive','short','decline']:code==='PR-050'?['positive','skip_action','wrong_name','draw']:['positive','no_draw','empty']){
  const f=T.setup(catalog,catalog.cards.find(c=>c.card_no==='HV-'+code),mode),{k,id}=f,requests=[],logs=[];
  const agent={async choose(g,p,r){requests.push(r);if(r.kind==='skill')return !(mode==='decline'||mode==='skip_action');if(r.kind==='guts')return r.options.slice(0,r.need).map(o=>o.value);if(r.prompt?.includes('選擇抽牌數量')&&mode==='no_draw')return 0;return r.options[0].value;}},g=new E.Game({seed:7,mode:'strict',decks:['k1014','seijoh'],agents:[agent,agent],onLog:s=>logs.push(s)});C.install(g,k);g.rulePhase={serve:'srv',draw:'drw',attack:'atk',block:'blk'}[f.phase];Object.assign(g.rngState,k.state.rng);const rng=structuredClone(g.rngState);if(f.p.activation.skill_type==='event'){g.playable(g.players[0],g.rulePhase);assert.deepEqual(g.rngState,rng,'Host declaration preview must not consume RNG');}
  T.invoke(f);if(f.p.activation.skill_type==='event')await g.resolve(g.players[0],code,g.rulePhase);else await g.enterCharacter(g.players[0],f.phase,code);
  assert.deepEqual(g.rngState,k.state.rng,code+' '+mode+' exact RNG checkpoint');
  for(const p of g.players){for(const[h,z]of Object.entries({hand:'hand',deck:'deck',drop:'drop',ev:'event',sets:'sets'}))assert.deepEqual(p[h],k.zone(p.idx,z).map(x=>I.short(k.card(x).cardNo)),code+' '+mode+' '+z);for(const[z,param]of Object.entries({serve:'srv',block:'blk',receive:'rcv',toss:'tos',attack:'atk'})){assert.deepEqual(p.area[z],k.zone(p.idx,z).map(x=>I.short(k.card(x).cardNo)));const top=k.top(p.idx,z);if(top)assert.equal(g.parameter(p,z,param),k.parameter(top,z)==='dash'?null:k.parameter(top,z));}}
  if(code==='P02-048'&&mode!=='decline'){assert(requests.some(r=>r.prompt?.includes('不能指定結果')));assert(requests.some(r=>r.prompt?.includes(mode==='positive'?'硬幣結果：正面':'硬幣結果：反面')));assert(logs.some(s=>s.includes('擲硬幣：')));}
  n++;
 }
 console.log('external live: '+n+' public game vs core cases, all zones, RNG/probe neutrality, visible result, shortage/decline and owner choices passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
