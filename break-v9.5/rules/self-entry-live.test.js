'use strict';
const assert=require('node:assert/strict'),E=require('../engine'),T=require('./self-entry-tests'),C=require('./covered-tests'),I=require('./node-inventory'),catalog=require('./data/cards.json'),data=require('./runtime-data.json');
const params={serve:'srv',block:'blk',receive:'rcv',toss:'tos',attack:'atk'};
async function runHost(g,f,code){if(f.target)await g.enterCharacter(g.players[0],f.dest,I.short(f.k.card(f.target).cardNo));else await g.resolve(g.players[0],code,g.rulePhase);}
function install(g,f){C.install(g,f.k);if(f.k.state.effects.length)g.sharedRulesState={version:1,fingerprint:data.fingerprint,next:f.k.state.next,effects:structuredClone(f.k.state.effects),receipts:[]};}
(async()=>{let count=0;
 for(const code of T.codes)for(const mode of code==='P03-011'?['positive','negative','restricted']:['positive','short','decline','restricted','wrong_role']){
  const card=catalog.cards.find(c=>c.card_no==='HV-'+code),f=T.setup(catalog,card,mode),{k,id}=f,seen=[];
  const agent={async choose(g,p,r){seen.push(r);if(r.kind==='skill')return mode!=='decline';if(r.kind==='guts')return r.options.slice(0,r.need).map(o=>o.value);return r.options[0].value;}},g=new E.Game({mode:'strict',seed:7,decks:['k1014','seijoh'],agents:[agent,agent]});install(g,f);T.invoke(f);await runHost(g,f,code);
  for(const p of g.players){for(const[h,z]of Object.entries({hand:'hand',deck:'deck',drop:'drop',ev:'event',sets:'sets'}))assert.deepEqual(p[h],k.zone(p.idx,z).map(x=>I.short(k.card(x).cardNo)),code+' '+mode+' '+z);for(const area of Object.keys(params))assert.deepEqual(p.area[area],k.zone(p.idx,area).map(x=>I.short(k.card(x).cardNo)));assert.deepEqual(p.ts.sides,['side:0','side:1'].flatMap(a=>k.zone(p.idx,a)).map(x=>I.short(k.card(x).cardNo)));for(const area of [...Object.keys(params),...p.ts.sides.map((_,i)=>'side:'+i)]){const top=k.top(p.idx,area);if(top)for(const[param,old]of Object.entries(params))assert.equal(g.parameter(p,area,old),k.parameter(top,param)==='dash'?null:k.parameter(top,param),code+' '+mode+' '+area+'.'+param);}}
  if(mode==='restricted'&&['P03-044','D02-004'].includes(code)){const r=seen.find(r=>r.kind==='skill');assert(r.ctx.ineffectiveReason);assert.equal(await E.AI.choose(g,g.players[0],r),false,'AI refuses a wholly ineffective entry cost');}
  count++;
 }
 console.log('self entry live: '+count+' public-game / core cases, all zones/parameters, compulsory drop, partial effects, human warning and AI refusal passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={install,runHost};
