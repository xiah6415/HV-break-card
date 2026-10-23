'use strict';
const assert=require('node:assert/strict'),T=require('./slot-tests'),C=require('./covered-tests'),E=require('../engine'),I=require('./node-inventory'),catalog=require('./data/cards.json'),runtime=require('./runtime-data.json'),B=require('./legacy');
(async()=>{let count=0;
 for(const mode of ['positive','one','partial','copies','skip_first','extra','empty','no_add','invalid']){
  const f=T.setup(catalog,catalog.cards.find(c=>c.card_no==='HV-P02-089'),mode),{k}=f;let skipped=false;
  const agent={async choose(g,p,r){if(mode==='skip_first'&&!skipped&&r.prompt?.includes('選擇移動數量')){skipped=true;return r.options.find(o=>o.value===0).value;}return r.options[0].value;}},g=new E.Game({seed:7,mode:'strict',decks:['k1014','seijoh'],agents:[agent,agent]});C.install(g,k);g.rulePhase='drw';if(k.state.effects.length)g.sharedRulesState={version:1,fingerprint:runtime.fingerprint,next:k.state.next,effects:structuredClone(k.state.effects),receipts:[]};
  if(['empty','no_add'].includes(mode)){assert(!B.canPlay(g,g.players[0],'P02-089','drw'));count++;continue;}
  T.invoke(f);await g.resolve(g.players[0],'P02-089','drw');for(const p of g.players)for(const[h,z]of Object.entries({hand:'hand',deck:'deck',drop:'drop',ev:'event',sets:'sets'}))assert.deepEqual(p[h],k.zone(p.idx,z).map(x=>I.short(k.card(x).cardNo)),mode+' '+z);count++;
 }
 console.log('retrieve slots live: '+count+' game/core cases; independent choices, exact three-card discard, copies/skip/original hand, empty/ban/invalid and every zone passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
