'use strict';
const assert=require('node:assert/strict');
const E=require('../engine'),{UndoSession}=require('../undo-tools');
const copy=x=>JSON.parse(JSON.stringify(x)),flush=()=>new Promise(r=>setImmediate(r));
class Scenario extends E.Game {
  async run(){const source=this.players[1],p=this.players[0];for(const q of this.players){q.hand=[];q.deck=[];q.drop=[];q.ev=[];q.sets=[];for(const a in q.area)q.area[a]=[];}
    this.beginTurn(source);source.hand=['P01-087','P01-087'];source.deck=['D04-003','D04-003'];source.area.serve=['P01-033'];source.area.toss=['D04-003'];
    p.hand=['PR-029','D01-009','P01-004'];p.drop=['P01-002','P01-006'];
    await this.resolve(source,'P01-087','tos');await this.resolve(source,'P01-087','tos');this.beginTurn(p);
    await this.resolve(p,'PR-029','drw');await this.confirmTurnEnd(p,{type:'attack',off:3});return p;
  }
}
(async()=>{
  const queue=[],errors=[];let logs=[];
  const snapshot=g=>copy({players:g.players.map(p=>{const {g,agent,...data}=p;return data;}),cardState:g.cardState,turnEffects:g.turnEffects,sharedRulesState:g.sharedRulesState,sharedRulesPending:g.sharedRulesPending,sharedRulesEvents:g.sharedRulesEvents,sharedRulesDepth:g.sharedRulesDepth,rulePhase:g.rulePhase,turn:g.turnNo,src:g.src,logs});
  const provider={wantsAck:true,choose:(g,p,req)=>new Promise(resolve=>queue.push({req,resolve,index:session.entries.length,state:snapshot(g)}))};
  const session=new UndoSession({Game:Scenario},{seed:7,decks:['k1014','seijoh'],agents:[provider,provider],onGame(){logs=[];},onLog:s=>logs.push(s),onError:e=>errors.push(e)});
  session.start();await flush();const checkpoints=[];
  for(let i=0;i<30;i++){const ticket=queue.shift();assert(ticket);checkpoints.push(ticket);if(ticket.req.kind==='turnEnd')break;ticket.resolve(answer(ticket.req));await flush();}
  const history=copy(session.entries);assert.equal(checkpoints.at(-1).req.kind,'turnEnd');assert.equal(history.length,11);assert.equal(session.game.players[0].hand.length,0);
  let obsolete=checkpoints.at(-1),restores=0;
  for(let index=0;index<=history.length;index++){
    session.start(history.slice(0,index));await flush();const restored=queue.shift();assert(restored);assert.deepEqual(restored.state,checkpoints[index].state);restores++;
    obsolete.resolve(obsolete.req.options[0].value);await flush();assert.deepEqual(snapshot(session.game),restored.state,'obsolete controller/affected-player callback cannot change restored watchers or cards');
    if(index<history.length){restored.resolve(history[index].value);await flush();const next=queue.shift();assert.deepEqual(next.state,checkpoints[index+1].state);obsolete=next;}else obsolete=restored;
  }
  const target=session.status().target;assert(session.undo());await flush();const undo=queue.shift();assert.deepEqual(undo.state,checkpoints[target].state);obsolete.resolve(true);await flush();assert.deepEqual(snapshot(session.game),undo.state);
  assert.deepEqual(errors,[]);session.stop();console.log('watch Undo:',restores,'complete card/watch/queue/replay/legacy-batch checkpoint restores; normal Undo and stale replies passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
function answer(r){if(r.kind==='target')return 'toss';return r.kind==='retrieve'?r.options[0].value:r.options.at(-1).value;}
