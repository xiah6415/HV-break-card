'use strict';
const assert=require('node:assert/strict');
const E=require('../engine'),{UndoSession}=require('../undo-tools');
const flush=()=>new Promise(r=>setImmediate(r));
const copy=x=>JSON.parse(JSON.stringify(x));
class Scenario extends E.Game {
  async run() {
    const p=this.players[0];this.beginTurn(p);
    p.hand=['P01-088','P04-089','P01-013','D04-003','D04-003'];p.deck=['D04-003','D04-003'];
    p.area.receive=['P04-026'];p.area.attack=['P01-004'];p.ts.receiver='P04-026';p.ts.rcv=5;
    await this.resolve(p,'P01-088','rcv');await this.resolve(p,'P04-089','rcv');await this.resolve(p,'P01-013','rcv');
    await this.confirmTurnEnd(p,{type:'attack',off:4});this.finishTurn(p);return p;
  }
}
(async()=>{
  const queue=[],errors=[];let logs=[];
  const snapshot=g=>copy({players:g.players.map(p=>{const {g,agent,...data}=p;return data;}),logs,turn:g.turnNo,src:g.src});
  const session=new UndoSession({Game:Scenario},{seed:7,decks:['k1014','seijoh'],ai:E.AI,
    human:{wantsAck:true,choose:(g,p,req)=>new Promise(resolve=>queue.push({req,resolve,state:snapshot(g),index:session.entries.length}))},
    onGame(){logs=[];},onLog(s){logs.push(s);},onError(e){errors.push(e);}});
  session.start();await flush();const states=new Map();let reversals=0;
  for(let i=0;i<20;i++) {
    let ticket=queue.shift();assert(ticket);states.set(ticket.index,ticket.state);
    const target=session.status().target;
    if(target>=0) {
      const old=ticket;assert(session.undo());await flush();ticket=queue.shift();assert.deepEqual(ticket.state,states.get(target));reversals++;
      old.resolve(old.req.options[0].value);await flush();assert.deepEqual(snapshot(session.game),ticket.state,'obsolete choice never mutates current state');
      ticket.resolve(answer(ticket.req));await flush();ticket=queue.shift();assert.deepEqual(ticket.state,old.state,'full state, log, locks, duplicates and choice signatures replay identically');
    }
    if(ticket.req.kind==='turnEnd'){ticket.resolve(true);await session.done;break;}
    ticket.resolve(answer(ticket.req));await flush();
  }
  assert.equal(session.game.players[0].ts.rcv,9);assert.equal(session.game.players[0].deck.length,1);assert.equal(session.game.players[0].drop.length,2);
  assert.deepEqual(errors,[]);assert(reversals>=6);session.stop();console.log('shared settlement Undo: passed',reversals,'full state/log restores and obsolete callbacks');
})().catch(e=>{console.error(e);process.exitCode=1;});
function answer(r) {
  if(r.kind==='target')return r.prompt.startsWith('縁下')?'attack':'receive';
  if(r.kind==='skill')return true;
  if(r.kind==='rulesChoice')return r.options.some(o=>o.value===0)?0:r.options.at(-1).value;
  return true;
}
