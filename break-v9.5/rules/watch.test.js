'use strict';
const assert=require('node:assert/strict');
const E=require('../engine'),bridge=require('./legacy'),{Kernel}=require('./core'),{attempt}=require('./decisions'),data=require('./runtime-data.json');
const copy=x=>JSON.parse(JSON.stringify(x)),cases=[];
const flush=()=>new Promise(r=>setImmediate(r));
function fixture(choose=async(g,p,r)=>r.kind==='target'?(r.options.find(o=>o.value==='toss')||r.options[0]).value:r.options[0].value) {
  const log=[],g=new E.Game({seed:7,reveal:0,decks:['seijoh','k1014'],agents:[{wantsAck:true,choose},{wantsAck:true,choose}],onLog:s=>log.push(s)});
  for(const q of g.players){q.hand=[];q.deck=[];q.drop=[];q.ev=[];q.sets=[];for(const a in q.area)q.area[a]=[];}
  const [p,o]=g.players;g.beginTurn(p);p.hand=['P01-087'];p.deck=['D04-003'];p.area.serve=['P01-033'];p.area.toss=['D04-003'];p.ts.setter='D04-003';p.ts.toss=2;
  o.hand=['P01-004'];o.drop=['P01-006','P01-002'];o.deck=['D01-009'];return {g,p,o,log};
}
async function activate(f){await f.g.resolve(f.p,'P01-087','tos');f.g.beginTurn(f.o);}
async function check(name,run){await run();cases.push({name,passed:true});}
const conserve=g=>assert.equal(Object.keys(g.cardSnapshot().cards).length,Object.values(g.cardState.zones).flat().length);
(async()=>{
  await check('Real data chooses any Oikawa, applies the bonus once and preserves a pending watcher',async()=>{
    const f=fixture(async(g,p,r)=>{assert.equal(r.kind,'target');assert.deepEqual(r.options.map(o=>o.value),['serve','toss']);assert.equal(p.hand.length,1);return 'serve';});
    await f.g.resolve(f.p,'P01-087','srv');assert.equal(f.g.parameter(f.p,'serve','tos'),2);assert.equal(f.p.ts.toss,2);assert.equal(f.g.sharedRulesState.effects.length,1);assert.equal(f.g.sharedRulesState.effects[0].duration.activeTurn,null);assert.equal(f.g.sharedRulesPending,null);conserve(f.g);
  });
  await check('The draw and watcher remain independent of a skill-hand-add ban',async()=>{
    const f=fixture();f.p.restrict.no_add=1;await f.g.resolve(f.p,'P01-087','tos');assert.equal(f.p.deck.length,1);assert.equal(f.p.ts.toss,3);assert.equal(f.g.sharedRulesState.effects.length,1);
  });
  await check('No matching serve/toss name leaves the card unavailable and unchanged',async()=>{
    const f=fixture();f.p.area.serve=[];f.p.area.toss=[];f.p.area.attack=['P01-033'];assert(!bridge.canPlay(f.g,f.p,'P01-087','tos'));await assert.rejects(f.g.resolve(f.p,'P01-087','tos'),/OPEN-EVENT-NO-CHANGE/);assert.deepEqual(f.p.hand,['P01-087']);assert(!f.g.sharedRulesState);
  });
  for(const actor of [0,1])await check('Affected player '+actor+' chooses their own discard with exact physical identity',async()=>{
    const f=fixture();if(actor===0){f.g.beginTurn(f.o);f.p=f.g.players[1];f.o=f.g.players[0];f.p.hand=['P01-087'];f.p.area.serve=['P01-033'];f.p.deck=['D04-003'];f.o.hand=['P01-004'];f.o.drop=['P01-006'];}
    await activate(f);let seen=false;const before=f.g.cardSnapshot(),id=before.zones[f.o.idx+'.drop'][0];
    f.o.agent.choose=async(g,p,r)=>{seen=true;assert.equal(p,f.o);assert(r.canLoss);assert.match(r.prompt,/非抽牌加入/);assert(r.options.some(o=>o.value===id));return id;};
    await f.g.sadd(f.o,'P01-006',f.o.drop);assert(seen);assert(!f.g.cardState.zones[f.o.idx+'.hand'].includes(id));assert(f.g.cardState.zones[f.o.idx+'.drop'].includes(id));assert.equal(f.g.sharedRulesState.receipts.length,1);conserve(f.g);
  });
  await check('An existing-hand card can be discarded instead of the newly added card',async()=>{
    const f=fixture();await activate(f);const id=f.g.cardReference(f.o,'hand').id;f.o.agent.choose=async()=>id;await f.g.sadd(f.o,'P01-006',f.o.drop);assert.deepEqual(f.o.hand,['P01-006']);
  });
  await check('Ordinary and skill draws never activate the non-draw watcher',async()=>{
    const f=fixture();f.o.deck=['D01-009','D01-009'];await activate(f);f.o.agent.choose=async()=>{throw Error('draw cannot request a discard');};f.g.draw(f.o);f.g.sdraw(f.o);assert.equal(f.o.hand.length,3);assert.equal(f.g.sharedRulesState.receipts.length,0);
  });
  await check('A blocked addition emits no trigger and keeps the exact source card',async()=>{
    const f=fixture();await activate(f);f.o.restrict.no_add=1;const before=f.g.cardSnapshot();assert.equal(await f.g.sadd(f.o,'P01-006',f.o.drop),false);assert.deepEqual(f.g.cardSnapshot(),before);assert.equal(f.g.sharedRulesState.receipts.length,0);
  });
  await check('Generated watcher survives its source leaving Event',async()=>{
    const f=fixture();await f.g.resolve(f.p,'P01-087','tos');f.g.moveCode(f.p.ev,f.p.drop,'P01-087');f.g.beginTurn(f.o);await f.g.sadd(f.o,'P01-006',f.o.drop);assert.equal(f.o.hand.length,1);assert.equal(f.g.sharedRulesState.effects.length,1);
  });
  await check('Every real addition generates a new trigger, even for a repeated physical card',async()=>{
    const f=fixture();await activate(f);const id=f.g.cardState.zones['1.drop'][0];f.o.agent.choose=async()=>id;
    await f.g.sadd(f.o,'P01-006',f.o.drop);await f.g.sadd(f.o,'P01-006',f.o.drop);assert.equal(f.g.sharedRulesState.receipts.length,2);assert.deepEqual(f.o.hand,['P01-004']);assert.equal(f.g.sharedRulesState.effects.length,1);conserve(f.g);
  });
  await check('Multiple watchers queue together; their controller chooses order, then the affected player discards twice',async()=>{
    const f=fixture();f.p.hand=['P01-087','P01-087'];f.p.deck=['D04-003','D04-003'];f.o.hand=['P01-004','D01-009'];
    await f.g.resolve(f.p,'P01-087','tos');await f.g.resolve(f.p,'P01-087','tos');assert.equal(new Set(f.g.sharedRulesState.effects.map(e=>e.id)).size,2);f.g.beginTurn(f.o);
    const kinds=[];f.p.agent.choose=async(g,p,r)=>{kinds.push('order');assert.equal(r.options.length,2);assert(!r.canLoss);return r.options.at(-1).value;};f.o.agent.choose=async(g,p,r)=>{kinds.push('discard');return r.options[0].value;};
    await f.g.sadd(f.o,'P01-006',f.o.drop);assert.deepEqual(kinds,['order','discard','discard']);assert.equal(f.o.hand.length,1);assert(!f.o.restrict.oremo);assert(!f.o.pending.oremo);conserve(f.g);
  });
  await check('A legacy multi-card skill completes all additions before its generated triggers resolve',async()=>{
    const f=fixture();f.o.hand=['PR-029'];await activate(f);const requests=[];
    f.o.agent.choose=async(g,p,r)=>{requests.push(r.kind);if(r.kind==='retrieve')return r.options[0].value;assert.equal(p.hand.length>=1,true);return r.options[0].value;};
    await f.g.resolve(f.o,'PR-029','drw');assert.deepEqual(requests,['retrieve','retrieve','rulesChoice','rulesChoice']);assert.equal(f.o.hand.length,0);assert.equal(f.g.sharedRulesState.receipts.length,2);assert.deepEqual(f.g.sharedRulesEvents,[]);conserve(f.g);
  });
  await check('Loss during the second retrieval does not run the first queued trigger inside the unfinished skill',async()=>{
    const f=fixture();f.o.hand=['PR-029'];await activate(f);let retrievals=0;
    f.o.agent.choose=async(g,p,r)=>{assert.equal(r.kind,'retrieve');return ++retrievals===1?r.options[0].value:{__loss:true};};
    await assert.rejects(f.g.resolve(f.o,'PR-029','drw'),e=>e.why?.includes('主動 Loss'));assert.equal(f.g.sharedRulesDepth,0);assert.equal(f.g.sharedRulesEvents.length,1);assert.equal(f.g.sharedRulesState.receipts.length,0);assert(f.o.hand.includes('P01-002'));bridge.loss(f.g);assert.deepEqual(f.g.sharedRulesEvents,[]);
  });
  await check('An actual addition still triggers after its card moves again within the same legacy effect',async()=>{
    const f=fixture();await activate(f);f.o.agent.choose=async(g,p,r)=>r.kind==='discard'?'P01-006':r.options[0].value;
    await bridge.legacyEffect(f.g,async()=>{await f.g.sadd(f.o,'P01-006',f.o.drop);await f.g.discard(f.o,'test');});assert.equal(f.o.hand.length,0);assert.equal(f.g.sharedRulesState.receipts.length,1);conserve(f.g);
  });
  await check('A foreign shared settlement preserves active watchers and does not repeat earlier numeric bonuses',async()=>{
    const f=fixture();f.o.hand=['P01-088'];f.o.area.receive=['P04-026'];f.o.ts.receiver='P04-026';f.o.ts.rcv=5;await activate(f);f.o.ts.receiver='P04-026';f.o.ts.rcv=5;
    f.o.agent.choose=async(g,p,r)=>r.kind==='target'?'receive':r.options[0].value;await f.g.resolve(f.o,'P01-088','rcv');assert.equal(f.o.ts.rcv,7);assert.equal(f.g.sharedRulesState.effects.length,1);assert.equal(f.g.sharedRulesState.receipts.length,0);await f.g.sadd(f.o,'P01-006',f.o.drop);assert.equal(f.g.sharedRulesState.receipts.length,1);assert.equal(f.o.ts.rcv,7);
  });
  await check('Pending choice journal is JSON-replayable to the identical request, without changing the host',async()=>{
    const f=fixture();f.o.hand=['PR-029','P01-004'];await activate(f);let resolve;f.o.agent.choose=async()=>new Promise(r=>resolve=r);const pending=f.g.sadd(f.o,'P01-006',f.o.drop);await flush();
    const journal=copy(f.g.sharedRulesPending),before=copy(f.g.cardState);assert(journal.command.events.length===1);assert(journal.request.kind==='move_cards');
    assert.deepEqual(f.g.playable(f.o,'drw'),[]);await assert.rejects(f.g.resolve(f.o,'PR-029','drw'),/already awaiting/);assert.deepEqual(f.g.cardState,before,'an unresolved trigger blocks new legacy skills before placement');
    const k=new Kernel({catalog:data.catalog,ruleIds:data.ruleIds,fingerprint:data.fingerprint,mode:'live',state:journal.baseline});const step=attempt(k,journal.baseline,x=>x.notifyHandAdditions(journal.command.events),journal.answers);assert.deepEqual(step.boundary.request,journal.request);assert.deepEqual(f.g.cardState,before);assert.equal(bridge.canPlay(f.g,f.o,'P01-088','rcv'),false);
    resolve(journal.request.options[0]);await pending;assert.equal(f.g.sharedRulesPending,null);
  });
  await check('Normal turn end expires watchers; a later turn does not reactivate them',async()=>{
    const f=fixture();await activate(f);f.g.finishTurn(f.o);assert.deepEqual(f.g.sharedRulesState.effects,[]);f.g.beginTurn(f.p);f.g.beginTurn(f.o);f.o.agent.choose=async()=>{throw Error('expired watcher');};await f.g.sadd(f.o,'P01-006',f.o.drop);assert.equal(f.o.hand.length,2);
  });
  await check('Duplicate receipt is ignored; a stale fabricated event is rejected',async()=>{
    const f=fixture();await activate(f);const id=f.g.cardState.zones['1.drop'][0];f.o.agent.choose=async(g,p,r)=>r.options.find(o=>o.value!==id).value;
    await f.g.sadd(f.o,'P01-006',f.o.drop);const receipt=f.g.sharedRulesState.receipts[0],revision=+receipt.split(':').at(-1);const before=f.g.cardSnapshot();await bridge.handAdded(f.g,f.o,id,revision);assert.deepEqual(f.g.cardSnapshot(),before);await assert.rejects(bridge.handAdded(f.g,f.o,id,revision-1),/Stale/);
  });
  await check('Loss during discard preserves the actual addition; the real interval clears all pending watchers',async()=>{
    const STOP=Symbol('next serve');let turns=0;const f=fixture();f.p.sets=['D04-003'];f.o.sets=['P01-004'];await activate(f);f.o.agent.choose=async()=>({__loss:true});let lost;
    try{await f.g.sadd(f.o,'P01-006',f.o.drop);}catch(e){lost=e;}assert(lost?.why.includes('主動 Loss'));assert(f.o.hand.includes('P01-006'));assert(f.g.sharedRulesPending);
    bridge.loss(f.g);assert.deepEqual(f.g.sharedRulesState.effects,[]);assert.deepEqual(f.g.sharedRulesEvents,[]);assert.equal(f.g.sharedRulesPending,null);
    const g=new E.Game({seed:7,decks:['seijoh','k1014'],agents:[E.AI,E.AI]});g.serveTurn=async function(p){this.beginTurn(p);if(turns++){assert.deepEqual(this.sharedRulesState.effects,[]);assert.equal(this.sharedRulesPending,null);assert.deepEqual(this.sharedRulesEvents,[]);throw STOP;}
      const source=this.players[0];this.beginTurn(source);
      for(const [code,to] of [['P01-033','0.serve'],['P01-087','0.hand']]){const state=this.cardSnapshot(),card=Object.values(state.cards).find(c=>c.owner===0&&c.code===code);this.moveCard(card.zone,to,state.zones[card.zone].indexOf(card.id));}
      await this.resolve(source,'P01-087','srv');assert.equal(this.sharedRulesState.effects.length,1);this.lost(source,'test');};await assert.rejects(g.run(),e=>e===STOP);

  });
  await check('Version and unsupported watcher families are rejected before another card moves',async()=>{
    const f=fixture();await activate(f);const original=copy(f.g.sharedRulesState),before=f.g.cardSnapshot();f.g.sharedRulesState.fingerprint='wrong';await assert.rejects(f.g.sadd(f.o,'P01-006',f.o.drop),/version/);
    assert.deepEqual(f.g.cardSnapshot(),before);f.g.sharedRulesState=original;f.g.sharedRulesState.effects[0].event='character_entry';await assert.rejects(bridge.handAdded(f.g,f.o,f.g.cardReference(f.o,'hand').id,f.g.cardState.revision),/Unintegrated/);assert.equal(Object.keys(f.g.cardState.cards).length,Object.keys(before.cards).length);
  });
  console.log(JSON.stringify({passed:cases.length,failed:0,cases},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
