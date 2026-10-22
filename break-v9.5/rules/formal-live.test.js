'use strict';
const assert=require('node:assert/strict'),E=require('../engine'),B=require('./legacy'),I=require('./node-inventory'),M=require('./modules'),T=require('./formal-node-tests'),catalog=require('./data/cards.json');
const copy=x=>JSON.parse(JSON.stringify(x));
function host(f,agent){const g=new E.Game({mode:'strict',seed:7,decks:['k1014','seijoh'],agents:[agent,agent]}),s=f.k.snapshot();for(const q of g.players){for(const[h,z]of Object.entries({hand:'hand',deck:'deck',drop:'drop',ev:'event',sets:'sets'}))q[h]=s.zones[q.idx+'.'+z].map(id=>I.short(s.cards[id].cardNo));for(const z of Object.keys(q.area))q.area[z]=s.zones[q.idx+'.'+z].map(id=>I.short(s.cards[id].cardNo));}g.cardState=null;g.beginTurn(g.players[0]);g.ball={type:'attack',off:8};g.rulePhase={draw:'drw',block:'blk',receive:'rcv',toss:'tos',attack:'atk'}[f.phase];g.cardSnapshot();return g;}
(async()=>{
 let checked=0;
 for(const card of I.scope(catalog).filter(c=>c.profiles[0].formal_cost&&M.eligible(c))){
  const p=card.profiles[0],code=I.short(card.card_no);let cancel=true,asks=0;
  const agent={wantsAck:true,async choose(g,p,r){asks++;if(cancel){assert.equal(r.kind,'event');return null;}if(['guts','gutsCourt'].includes(r.kind))return r.options.slice(0,r.need).map(o=>o.value);if(r.kind==='skill')return true;return r.options.find(o=>o.label?.includes('其餘放到牌庫底'))?.value??r.options[0].value;}};
  const g=host(T.seedCard(catalog,card),agent),q=g.players[0],snapshot=()=>copy({cards:g.cardSnapshot(),players:g.players.map(p=>{const{g,agent,...d}=p;return d;}),shared:g.sharedRulesState,pending:g.sharedRulesPending}),before=snapshot();
  assert(B.canPlay(g,q,code,g.rulePhase),code+' has a resolving continuation');assert.equal(asks,0,'Admission probing must never ask a player or consume a cost');assert.deepEqual(snapshot(),before);
  await g.eventLoop(q,g.rulePhase);assert.deepEqual(snapshot(),before,code+' cancel before declaration preserves every card and cost');cancel=false;await g.resolve(q,code,g.rulePhase);assert.equal(g.sharedRulesPending,null);
  if(code==='PR-082'){assert.equal(q.top('attack'),code);assert.equal(g.parameter(q,'attack','atk'),5);}
  const f=T.seedCard(catalog,card);for(const n of p.formal_cost.steps){if(n.kind==='move_self')f.k._atomic(()=>f.k._move(f.id,0,n.destination.split('.')[1],f.k._context(f.id,0)));else for(const a of n.areas)for(const x of [...f.k.zone(0,a)].slice(0,-1))f.k._atomic(()=>f.k._move(x,0,'deck',f.k._context(f.id,0)));}
  const blocked=host(f,agent),saved=blocked.cardSnapshot();assert.equal(B.canPlay(blocked,blocked.players[0],code,blocked.rulePhase),false);assert.deepEqual(blocked.cardSnapshot(),saved,'Insufficient cost does not consume or expose cards');const invalid=T.seedCard(catalog,card);invalid.k.resolveProgram({kind:'ban_action',actor:'self',action:'use_skill',scope:{},duration:'this_turn'},0);const checkpoint=invalid.k.snapshot();assert.deepEqual(invalid.k.useSkill(invalid.id),{performed:false,invalid:true});checkpoint.revision++;assert.deepEqual(invalid.k.snapshot(),checkpoint,'A forbidden skill cannot pay its declaration cost');checked++;
 }
 console.log('formal live: '+checked+' cards; read-only admission, cancellation before cost, unavailable cost, forbidden skills, real choices and hand back attack passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
