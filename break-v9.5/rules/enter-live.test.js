'use strict';
const assert=require('node:assert/strict'),E=require('../engine'),B=require('./legacy'),I=require('./node-inventory'),T=require('./enter-node-tests'),catalog=require('./data/cards.json');
function host(f,agent){const g=new E.Game({mode:'strict',seed:7,decks:['k1014','seijoh'],agents:[agent,agent]}),s=f.k.snapshot();for(const p of g.players){for(const[h,z]of Object.entries({hand:'hand',deck:'deck',drop:'drop',ev:'event',sets:'sets'}))p[h]=s.zones[p.idx+'.'+z].map(id=>I.short(s.cards[id].cardNo));for(const z of Object.keys(p.area))p.area[z]=s.zones[p.idx+'.'+z].map(id=>I.short(s.cards[id].cardNo));}g.cardState=null;g.beginTurn(g.players[0]);g.ball={type:'attack',off:1};g.rulePhase={receive:'rcv',toss:'tos',attack:'atk'}[f.phase];return g;}
const answer=r=>['guts','gutsCourt'].includes(r.kind)?r.options.slice(0,r.need).map(o=>o.value):r.kind==='skill'?true:r.options[0].value;
(async()=>{
 for(const [code,area,who,cache,param,offset]of [['P02-083','receive','receiver','rcv','rcv',0],['P04-083','toss','setter','toss','tos',1],['P02-096','attack','attacker','atk','atk',0]]){
  const card=catalog.cards.find(c=>I.short(c.card_no)===code),f=T.seedCard(catalog,card),g=host(f,{choose:async(g,p,r)=>answer(r)}),p=g.players[0];p.ts.apass=offset;p.ts[cache]=g.parameter(p,area,param)+offset;p.ts[who]=p.top(area);p.ts[who+'Ref']=g.roleReference(p,area);const old=g.roleReference(p,area);
  await g.resolve(p,code,g.rulePhase);assert(!g.sameReference(old,g.roleReference(p,area)),code+' must replace active role');assert.equal(p.ts[who],p.top(area));assert(g.sameReference(p.ts[who+'Ref'],g.roleReference(p,area)));const top=f.k.top(0,area);f.k.playEvent(f.id);const next=f.k.top(0,area);assert.notEqual(top,next);assert.equal(p.ts[cache],f.k.parameter(next,area)+offset,code+' refreshes judgment cache and keeps contextual bonus');assert.equal(g.parameter(p,area,param),p.ts[cache]);
 }
 const card=catalog.cards.find(c=>c.card_no==='HV-P04-014'),f=T.seedCard(catalog,card);let checked=false;
 const agent={wantsAck:true,async choose(g,p,r){if(r.kind==='receiver')return 'P04-014';if(r.kind==='setter'){checked=true;assert.notEqual(p.ts.receiver,'P04-014');assert.equal(p.ts.receiver,p.top('receive'));assert(g.sameReference(p.ts.receiverRef,g.roleReference(p,'receive')));assert.equal(p.ts.rcv,g.parameter(p,'receive','rcv'));throw new Error('RECEIVER_VERIFIED');}if(r.kind==='event')return null;return answer(r);}};
 const g=host(f,agent);await assert.rejects(g.receiveTurn(g.players[0]),/RECEIVER_VERIFIED/);assert(checked);
 console.log('enter live: receive/toss/attack event replacement refreshes active identity/value; A-pass context retained; full receive flow uses actual replacement');
})().catch(e=>{console.error(e);process.exitCode=1;});
