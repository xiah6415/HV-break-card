'use strict';
const assert=require('node:assert/strict'),E=require('../engine'),{UndoSession}=require('../undo-tools');
const copy=x=>JSON.parse(JSON.stringify(x)),flush=()=>new Promise(r=>setImmediate(r));
function answer(r){if(r.kind==='guts')return r.options.slice(0,r.need).map(o=>o.value);if(r.kind==='skill')return true;if(r.kind==='event')return null;if(r.kind==='receiver')return 'D01-005';if(r.kind==='setter')return 'P01-006';if(r.kind==='attacker')return 'BP-002';return r.options.at(-1).value;}
(async()=>{let total=0;
for(const kind of ['high_receive','skill_hand','block_limit']){
  class Scenario extends E.Game {
    async run(){const [p,o]=this.players;for(const q of this.players){q.hand=[];q.deck=[];q.drop=[];q.ev=[];q.sets=[];for(const a in q.area)q.area[a]=[];}
      this.beginTurn(p);p.area.toss=['P01-006'];p.ts.setter='P01-006';p.ts.toss=2;p.area.attack=['P01-013','P01-013','P01-004'];p.hand=kind==='high_receive'?['P01-002']:kind==='skill_hand'?['P01-035','D04-003']:['P01-003','P01-013'];
      o.hand=['P04-027','D01-005','P01-006','BP-002'];o.area.receive=['P01-013','P01-013','P01-004'];o.deck=['P01-004','P01-013'];
      await this.enterAttack(p,kind==='high_receive'?'P01-002':kind==='skill_hand'?'P01-035':'P01-003',false);const outgoing={type:'attack',off:p.ts.toss+p.ts.atk};await this.confirmTurnEnd(p,outgoing);this.finishTurn(p);this.beginTurn(o);this.ball=outgoing;
      await this.ask(o,{kind:'restrictionCheckpoint',prompt:'限制生效確認',options:[{label:'繼續',value:true}]});await this.receiveTurn(o);await this.ask(o,{kind:'restrictionCheckpoint',prompt:'限制已到期',options:[{label:'繼續',value:true}]});return o;
    }
  }
  const queue=[],errors=[];let logs=[];
  const snapshot=g=>copy({players:g.players.map(p=>{const {g,agent,...data}=p;return data;}),cards:g.cardState,turnEffects:g.turnEffects,sharedRulesState:g.sharedRulesState,sharedRulesPending:g.sharedRulesPending,sharedRulesEvents:g.sharedRulesEvents,sharedRulesDepth:g.sharedRulesDepth,rulePhase:g.rulePhase,turn:g.turnNo,ball:g.ball,src:g.src,logs,permissions:g.players.map(p=>({receive6:g.canEnter(p,'receive','P04-027'),add:g.skillHandAllowed(p),blockMax:g.blockMax(p)}))});
  const provider={wantsAck:true,choose:(g,p,req)=>new Promise(resolve=>queue.push({req,resolve,state:snapshot(g)}))};
  const session=new UndoSession({Game:Scenario},{seed:7,decks:['k1014','seijoh'],agents:[provider,provider],onGame(){logs=[];},onLog:s=>logs.push(s),onError:e=>errors.push(e)});
  session.start();await flush();const checkpoints=[];
  for(let i=0;i<35;i++){const ticket=queue.shift();assert(ticket,JSON.stringify(errors.map(String)));checkpoints.push(ticket);if(ticket.req.prompt==='限制已到期')break;ticket.resolve(answer(ticket.req));await flush();}
  const history=copy(session.entries);assert.equal(checkpoints.at(-1).req.prompt,'限制已到期');assert.deepEqual(session.game.sharedRulesState.effects,[]);assert.equal(session.game.players[1].ts.rcv,7);assert.equal(session.game.players[1].ts.atk,4);
  let obsolete=checkpoints.at(-1),restores=0;
  for(let i=0;i<=history.length;i++){
    session.start(history.slice(0,i));await flush();const restored=queue.shift();assert(restored);assert.deepEqual(restored.state,checkpoints[i].state);restores++;
    obsolete.resolve(answer(obsolete.req));await flush();assert.deepEqual(snapshot(session.game),restored.state,'stale reply cannot change restored bans, permissions or cards');
    if(i<history.length){restored.resolve(history[i].value);await flush();const next=queue.shift();assert.deepEqual(next.state,checkpoints[i+1].state);obsolete=next;}else obsolete=restored;
  }
  const activeIndex=checkpoints.findIndex(t=>t.req.prompt==='限制生效確認');session.start(history.slice(0,activeIndex));await flush();const active=queue.shift();assert.deepEqual(active.state,checkpoints[activeIndex].state);const before=snapshot(session.game);
  let request=session.requestTakeback(0);assert(request);assert(session.resolveTakeback(request.id,1,false));assert.deepEqual(snapshot(session.game),before,'declined takeback leaves active restrictions unchanged');
  request=session.requestTakeback(0);assert(request);const target=request.target;assert(session.resolveTakeback(request.id,1,true));await flush();const restored=queue.shift();assert.deepEqual(restored.state,checkpoints[target].state);assert(session.game.sharedRulesState.effects.every(e=>e.duration.activeTurn===null));active.resolve(true);await flush();assert.deepEqual(snapshot(session.game),restored.state);
  assert.deepEqual(errors,[]);session.stop();total+=restores;console.log(kind,restores,'full restores; cross-turn refusal/consent and obsolete replies passed');
}
console.log('restriction Undo total',total);
})().catch(e=>{console.error(e);process.exitCode=1;});
