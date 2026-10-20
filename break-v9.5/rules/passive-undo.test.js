'use strict';
const assert=require('node:assert/strict'),E=require('../engine'),{UndoSession}=require('../undo-tools');
const copy=x=>JSON.parse(JSON.stringify(x)),flush=()=>new Promise(r=>setImmediate(r));
class Scenario extends E.Game {
  async run(){const [p,o]=this.players;for(const q of this.players){q.hand=[];q.deck=[];q.drop=[];q.ev=[];q.sets=[];for(const a in q.area)q.area[a]=[];}
    this.beginTurn(o);o.hand=['P04-088'];o.area.attack=['D04-002'];o.ts.attacker='D04-002';o.ts.atk=7;
    p.hand=['P03-057','D01-005','P01-006','BP-002','P01-013','P01-013'];p.area.receive=['D01-009','P01-013','P01-013','P01-004'];p.deck=['PR-043'];this.ball={type:'attack',off:9};
    await this.resolve(o,'P04-088','atk');this.beginTurn(p);await this.receiveTurn(p);this.winner=p;return p;
  }
}
function answer(r){if(r.kind==='target')return 'attack';if(r.kind==='event')return r.options.find(o=>o.card==='P03-057')?.value??null;if(r.kind==='receiver')return 'D01-005';if(r.kind==='setter')return 'P01-006';if(r.kind==='attacker')return 'BP-002';if(r.kind==='guts')return [3,0,1];if(r.kind==='skill')return true;if(r.kind==='rulesChoice')return (r.options.find(o=>o.label.includes('西谷'))||r.options.at(-1)).value;return r.options[0].value;}
(async()=>{
  const queue=[],errors=[];let logs=[];
  const snapshot=g=>copy({players:g.players.map(p=>{const {g,agent,...data}=p;return data;}),cards:g.cardState,turnEffects:g.turnEffects,sharedRulesState:g.sharedRulesState,sharedRulesPending:g.sharedRulesPending,sharedRulesEvents:g.sharedRulesEvents,sharedRulesDepth:g.sharedRulesDepth,rulePhase:g.rulePhase,turn:g.turnNo,ball:g.ball,src:g.src,logs});
  const provider={wantsAck:true,choose:(g,p,req)=>new Promise(resolve=>queue.push({req,resolve,state:snapshot(g)}))};
  const session=new UndoSession({Game:Scenario},{seed:7,decks:['k1014','seijoh'],agents:[provider,provider],onGame(){logs=[];},onLog:s=>logs.push(s),onError:e=>errors.push(e)});
  session.start();await flush();const checkpoints=[];
  for(let i=0;i<30;i++){const ticket=queue.shift();assert(ticket,JSON.stringify({errors:errors.map(e=>String(e)),seen:checkpoints.map(t=>[t.req.kind,t.req.prompt])}));checkpoints.push(ticket);if(ticket.req.kind==='turnEnd')break;ticket.resolve(answer(ticket.req));await flush();}
  const history=copy(session.entries);assert.equal(checkpoints.at(-1).req.kind,'turnEnd');assert.equal(session.game.players[0].ts.rcv,9);assert.equal(session.game.players[0].ts.atk,4);assert.equal(session.game.players[0].drop.length,5);assert(checkpoints.some(x=>x.req.kind==='guts'));assert(checkpoints.some(x=>x.req.prompt.includes('棄掉')));
  let obsolete=checkpoints.at(-1),restores=0;
  for(let i=0;i<=history.length;i++){
    session.start(history.slice(0,i));await flush();const restored=queue.shift();assert(restored);assert.deepEqual(restored.state,checkpoints[i].state);restores++;
    obsolete.resolve(answer(obsolete.req));await flush();assert.deepEqual(snapshot(session.game),restored.state,'obsolete Guts/payment/order reply cannot mutate the restored state');
    if(i<history.length){restored.resolve(history[i].value);await flush();const next=queue.shift();assert.deepEqual(next.state,checkpoints[i+1].state);obsolete=next;}else obsolete=restored;
  }
  assert(session.undo());await flush();const ticket=queue.shift();assert.deepEqual(ticket.state,checkpoints[session.entries.length].state);obsolete.resolve(true);await flush();assert.deepEqual(snapshot(session.game),ticket.state);
  assert.deepEqual(errors,[]);session.stop();console.log('passive Undo:',restores,'full checkpoints restored; precise Guts/hand payment, passive/watch ordering, normal Undo and stale callbacks passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
