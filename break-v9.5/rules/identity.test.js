'use strict';
const assert=require('node:assert/strict');
const E=require('../engine'),I=require('./identity'),L=require('./lifecycle');
const {UndoSession}=require('../undo-tools');
const copy=x=>JSON.parse(JSON.stringify(x));
const cases=[];
async function check(name,fn){await fn();cases.push({name,passed:true});}
function fixture(choose=async(g,p,r)=>r.options[0].value) {
  const g=new E.Game({seed:7,decks:['k1014','seijoh'],agents:[{wantsAck:true,choose},E.AI]});
  for(const p of g.players){p.deck=[];p.hand=[];p.drop=[];p.ev=[];p.sets=[];for(const a in p.area)p.area[a]=[];}
  g.beginTurn(g.players[0]);return {g,p:g.players[0],o:g.players[1]};
}
function validate(g){const s=g.cardSnapshot();I.validate(g,s);return s;}
(async()=>{
  await check('Duplicate draw and discard preserve exact physical IDs',async()=>{
    const {g,p}=fixture();p.deck=['P01-004','P01-004'];const s=g.cardSnapshot(),[bottom,top]=s.zones['0.deck'];
    g.draw(p);assert.deepEqual(validate(g).zones['0.hand'],[top]);
    await g.discard(p,'test');assert.deepEqual(validate(g).zones['0.drop'],[top]);g.draw(p);assert.deepEqual(validate(g).zones['0.hand'],[bottom]);
  });
  await check('The revealed duplicate is moved from the true deck top to bottom or hand',async()=>{
    for(const take of [false,true]){
      const {g,p}=fixture(async(g,p,r)=>r.kind==='reveal'?true:take?'P01-004':null);p.deck=['P01-004','D01-009','P01-004'];
      const s=g.cardSnapshot(),id=s.zones['0.deck'].at(-1);await g.revealTop(p,'test',()=>true);const after=validate(g);
      assert.equal(take?after.zones['0.hand'].at(-1):after.zones['0.deck'][0],id);assert.equal(Object.keys(after.cards).length,3);
    }
  });
  await check('Selected duplicate Guts move exactly; neither top character nor its incarnation changes',async()=>{
    const {g,p}=fixture(async()=>[0,2]);p.area.receive=['P01-004','P01-004','P01-004','P03-048'];
    const before=g.cardSnapshot(),ids=before.zones['0.receive'];const paid=await g.pay(p,'receive',2),after=validate(g);
    assert.deepEqual(paid,['P01-004','P01-004']);assert.deepEqual(after.zones['0.drop'],[ids[0],ids[2]]);assert.deepEqual(after.zones['0.receive'],[ids[1],ids[3]]);assert.equal(after.cards[ids[3]].incarnation,0);
  });
  await check('Covering, exposing and leaving/re-entering change role incarnation without changing physical ID',async()=>{
    const {g,p}=fixture();p.area.receive=['P01-004'];p.hand=['P01-004'];const initial=g.cardSnapshot(),old=initial.zones['0.receive'][0],next=initial.zones['0.hand'][0];
    g.place(p,'receive','P01-004');let s=validate(g);assert.equal(s.cards[old].incarnation,1);assert.equal(s.cards[next].incarnation,1);
    g.moveCard(p.area.receive,p.drop,1);s=validate(g);assert.equal(s.cards[old].incarnation,2);assert.equal(s.cards[next].incarnation,2);
    g.moveCode(p.drop,p.hand,'P01-004');g.place(p,'receive','P01-004');s=validate(g);assert.equal(s.zones['0.receive'].at(-1),next);assert.equal(s.cards[next].incarnation,3);
  });
  await check('Cross-area character movement preserves role incarnation; side cleanup moves each ID once',async()=>{
    const {g,p}=fixture();p.area.attack=['P01-004'];p.ts.sides=['P01-004','P01-004'];const s=g.cardSnapshot(),id=s.zones['0.attack'][0],sides=s.zones['0.sides'];
    g.moveCard(p.area.attack,p.area.receive,0);assert.equal(validate(g).cards[id].incarnation,0);
    g.cleanupSides(p);g.cleanupSides(p);assert.deepEqual(validate(g).zones['0.drop'],sides);assert.deepEqual(p.ts.sides,[]);
  });
  await check('Shuffle reorders IDs and codes together; the same snapshot replays the same moves',async()=>{
    const {g,p}=fixture();p.deck=['P01-004','P01-004','D01-009'];const base=g.cardSnapshot();g.shuffle(p.deck);const shuffled=validate(g);
    assert.deepEqual([...shuffled.zones['0.deck']].sort(),[...base.zones['0.deck']].sort());
    g.draw(p,2);const first=validate(g);I.restore(g,shuffled);g.draw(p,2);assert.deepEqual(validate(g),first);
  });
  await check('Sets and interval draw use the same persistent IDs',async()=>{
    const {g,p}=fixture();p.deck=['P01-004','P01-004'];const base=g.cardSnapshot();g.moveCard(p.deck,p.sets,1);g.moveCard(p.sets,p.hand,0);
    assert.deepEqual(validate(g).zones['0.hand'],[base.zones['0.deck'][1]]);
  });
  await check('Malformed snapshots and untracked code-array writes fail before another card moves',async()=>{
    const {g,p}=fixture();p.deck=['P01-004'];const before=g.cardSnapshot();const bad=copy(before);bad.cards['card-1'].incarnation=-1;
    assert.throws(()=>I.restore(g,bad),/mismatch/);assert.deepEqual(validate(g),before);
    p.deck.push('P01-004');assert.throws(()=>g.draw(p),/Untracked/);assert.deepEqual(p.hand,[]);I.restore(g,before);assert.deepEqual(validate(g),before);
  });
  await check('Persistent IDs survive two data-driven settlements and a legacy move between them',async()=>{
    const {g,p}=fixture(async(g,p,r)=>r.kind==='target'?'receive':0);p.hand=['P01-088','P01-088'];p.area.receive=['P04-026'];p.deck=['D04-003'];p.ts.receiver='P04-026';p.ts.rcv=5;
    const base=g.cardSnapshot(),events=[...base.zones['0.hand']],receiver=base.zones['0.receive'][0];
    await g.resolve(p,'P01-088','rcv');g.draw(p);await g.resolve(p,'P01-088','rcv');const s=validate(g);
    assert.deepEqual(s.zones['0.ev'],events);assert.equal(s.zones['0.receive'][0],receiver);assert.equal(s.cards[receiver].incarnation,0);assert.equal(p.ts.rcv,9);
  });
  await check('Leaving and returning cannot resurrect an old numeric modifier or active receive total',async()=>{
    const {g,p}=fixture(async(g,p,r)=>r.kind==='target'?'receive':0);p.hand=['P01-088'];p.area.receive=['P04-026'];p.ts.receiver='P04-026';p.ts.rcv=5;p.ts.receiverRef=g.cardReference(p,'receive');
    await g.resolve(p,'P01-088','rcv');assert.equal(g.parameter(p,'receive','rcv'),7);const ref=p.effects.receive.ref;
    g.moveCard(p.area.receive,p.drop,0);g.moveCard(p.drop,p.area.receive,0);
    assert.equal(g.parameter(p,'receive','rcv'),5);assert(!g.sameReference(ref,g.cardReference(p,'receive')));validate(g);
  });
  await check('Payment projection publishes physical zones before reading an active receiver reference, for either player',async()=>{
    for(const actor of [0,1]) {
      const {g}=fixture();const p=g.players[actor];if(actor)g.beginTurn(p);
      p.agent={wantsAck:true,choose:async(g,p,r)=>r.kind==='target'?'receive':r.kind==='skill'?true:r.options[0].value};
      p.hand=['P04-089','D04-003'];p.deck=['D04-003'];p.area.receive=['P04-026'];p.ts.receiver='P04-026';p.ts.rcv=5;p.ts.receiverRef=g.cardReference(p,'receive');
      await g.resolve(p,'P04-089','rcv');assert.equal(p.ts.rcv,8);assert.equal(p.drop.length,1);validate(g);
    }
  });
  await check('Independent delayed effects activate only on the next opponent turn and expire at its end',async()=>{
    const {g,p,o}=fixture(async(g,p,r)=>r.kind==='skill'?true:r.kind==='guts'?r.options.slice(0,r.need).map(o=>o.value):r.options[0].value);p.hand=['P01-002'];p.area.attack=['P01-004','P01-004','P01-004'];
    await g.enterAttack(p,'P01-002',false);const effect=copy(g.sharedRulesState.effects[0]);assert.equal(effect.duration.activeTurn,null);assert.equal(effect.source.id,g.cardReference(p,'attack').id);
    g.finishTurn(p);assert.equal(g.sharedRulesState.effects.length,1);g.moveCard(p.area.attack,p.drop,p.area.attack.length-1);
    g.beginTurn(o);assert(!g.canEnter(o,'receive','P04-027'));assert.equal(g.sharedRulesState.effects[0].duration.activeTurn,g.turnNo);
    g.finishTurn(o);assert.deepEqual(o.restrict,{});assert.deepEqual(g.sharedRulesState.effects,[]);g.beginTurn(p);assert.deepEqual(p.restrict,{});
  });
  await check('Repeated delayed discard effects stack once; next turns do not reactivate them',async()=>{
    const {g,p,o}=fixture();p.hand=['P01-087','P01-087'];p.deck=['D01-009','D01-009'];p.area.serve=['P01-033'];
    await g.resolve(p,'P01-087','tos');await g.resolve(p,'P01-087','tos');assert.equal(g.sharedRulesState.effects.length,2);assert(!o.pending.oremo);
    g.beginTurn(o);assert(g.sharedRulesState.effects.every(e=>e.duration.activeTurn===g.turnNo));g.beginTurn(p);assert.deepEqual(g.sharedRulesState.effects,[]);g.beginTurn(o);assert(!o.restrict.oremo);
  });
  await check('Every existing delayed restriction uses the same serializable timing lifecycle',async()=>{
    const {g,p,o}=fixture();p.hand=['P01-004'];const source=g.cardReference(p,'hand');
    for(const key of ['no_rcv6','two_blockers','no_add','one_blocker','rcv_minus'])g.scheduleRestriction(o,key,1,false,source);
    const saved=JSON.parse(JSON.stringify(g.turnEffects));g.turnEffects=saved;g.beginTurn(o);
    assert.equal(g.blockMax(o),1);assert.equal(o.restrict.no_add,1);assert.equal(o.restrict.rcv_minus,1);
    g.finishTurn(o);assert.deepEqual(o.restrict,{});assert.deepEqual(g.turnEffects.effects,[]);
  });
  await check('The real Loss interval clears both pending and active delayed effects before the next serve',async()=>{
    const STOP=Symbol('next serve');let serves=0;
    const g=new E.Game({seed:7,decks:['k1014','seijoh'],agents:[E.AI,E.AI]});
    g.serveTurn=async function(p){this.beginTurn(p);if(serves++) {assert.deepEqual(this.turnEffects.effects,[]);for(const q of this.players){assert.deepEqual(q.pending,{});assert.deepEqual(q.restrict,{});}throw STOP;}
      this.scheduleRestriction(p.opp,'no_add',1,false,this.cardReference(p,'hand'));this.lost(p,'test loss');};
    await assert.rejects(g.run(),e=>e===STOP);validate(g);assert.equal(serves,2);
  });
  await check('Normal turn end removes a hand-add restriction before an off-turn addition',async()=>{
    const {g,p,o}=fixture();p.deck=['P01-004'];o.deck=['P01-004'];
    g.scheduleRestriction(o,'no_add',1,false,null);g.beginTurn(o);assert.equal(g.sdraw(o),0);g.finishTurn(o);assert.equal(g.sdraw(o),1);validate(g);
  });
  await check('Consented cross-turn Undo restores pending/active effects and physical IDs; stale replies do not write',async()=>{
    const queue=[],errors=[],flush=()=>new Promise(r=>setImmediate(r));
    const snap=g=>copy({players:g.players.map(p=>{const {g,agent,...data}=p;return data;}),cardState:g.cardState,turnEffects:g.turnEffects,turn:g.turnNo});
    class Scenario extends E.Game {async run(){const p=this.players[0];this.beginTurn(p);this.scheduleRestriction(p.opp,'no_add',1,false,this.cardReference(p,'deck'));
      await this.ask(p,{kind:'identityCheckpoint',prompt:'before handoff',options:[{label:'continue',value:true}]});
      this.finishTurn(p);this.beginTurn(p.opp);await this.ask(p.opp,{kind:'identityCheckpoint',prompt:'active opponent turn',options:[{label:'continue',value:true}]});this.finishTurn(p.opp);return p;}}
    const provider={wantsAck:true,choose:(g,p,req)=>new Promise(resolve=>queue.push({resolve,state:snap(g)}))};
    const session=new UndoSession({Game:Scenario},{seed:7,decks:['k1014','seijoh'],agents:[provider,provider],onError:e=>errors.push(e)});
    session.start();await flush();const first=queue.shift();first.resolve(true);await flush();const active=queue.shift();
    assert.equal(session.game.players[1].restrict.no_add,1);const request=session.requestTakeback();assert(request);assert(session.resolveTakeback(request.id,1,true));await flush();
    const restored=queue.shift();assert.deepEqual(restored.state,first.state);active.resolve(true);await flush();assert.deepEqual(snap(session.game),restored.state);
    restored.resolve(true);await flush();const repeated=queue.shift();assert.deepEqual(repeated.state,active.state);repeated.resolve(true);await session.done;
    assert.deepEqual(session.game.turnEffects.effects,[]);assert.deepEqual(errors,[]);session.stop();
  });
  console.log(JSON.stringify({passed:cases.length,failed:0,cases},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
