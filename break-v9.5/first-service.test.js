'use strict';
const assert=require('node:assert/strict'),E=require('./engine'),{UndoSession}=require('./undo-tools');
const flush=()=>new Promise(r=>setImmediate(r)),copy=x=>JSON.parse(JSON.stringify(x));
const STOP=Symbol('opening complete');
function snapshot(g,logs){return copy({dice:g.dice,winner:g.diceWinner,choice:g.firstServiceChoice,server:g.firstServer,players:g.players.map(p=>{const {g,agent,...v}=p;return v;}),physical:g.cardSnapshot(),logs});}
class Opening extends E.Game{async serveTurn(p){this.openingServer=p.idx;throw STOP;}}
(async()=>{
 let matrices=0;
 for(const mode of ['numeric','strict'])for(const winner of [0,1])for(const choice of ['serve','receive']){
  const requests=[],logs=[];const provider={wantsAck:true,async choose(g,p,r){requests.push({actor:p.idx,kind:r.kind,role:r.role});if(r.kind==='firstService'){assert.equal(p.idx,winner);assert.equal(r.ctx.winner,winner);assert.equal(g.firstServer,undefined);assert.equal(r.canLoss,false);assert.equal(g.players[0].hand.length+g.players[1].hand.length,0);return choice;}if(r.kind==='mulligan')return [];return true;}};
  const g=new Opening({mode,seed:7,decks:['k1014','seijoh'],agents:[provider,provider],onLog:s=>logs.push(s)});const original=g.rand,seq=[.4,.4,...(winner===0?[.99,0]:[0,.99])];g.rand=()=>seq.length?seq.shift():original();await assert.rejects(g.run(),e=>e===STOP);
  const server=choice==='serve'?winner:1-winner;assert.deepEqual(g.dice,winner===0?[6,1]:[1,6]);assert.equal(g.diceWinner,winner);assert.equal(g.firstServer,server);assert.equal(g.openingServer,server);assert.equal(g.server,server);assert.equal(g.firstServiceChoice,choice);assert.deepEqual(requests.filter(r=>r.kind==='mulligan').map(r=>[r.actor,r.role]),[[server,'serve'],[1-server,'receive']]);assert.equal(requests.filter(r=>r.kind==='firstService').length,1);assert(logs.some(l=>l.includes('選擇'+(choice==='serve'?'先發球':'先接球'))));assert.equal(Object.keys(g.cardSnapshot().cards).length,80);for(const p of g.players){assert.equal(p.hand.length,6);assert.equal(p.sets.length,2);assert.equal(p.deck.length,32);}matrices++;
 }
 assert.equal(await E.AI.choose({}, {},{kind:'firstService',options:[{value:'serve'},{value:'receive'}]}),'serve');
 const invalid=new Opening({seed:7,decks:['k1014','seijoh'],agents:[{choose:async()=>true},E.AI]});await assert.rejects(invalid.run(),/請選擇/);
 // Replay the real opening, undo to the selection, then ignore the former ack reply.
 const q=[],errors=[];let logs=[];const human={wantsAck:true,choose:(g,p,req)=>new Promise(resolve=>q.push({req,resolve,state:snapshot(g,logs)}))};
 const s=new UndoSession({Game:Opening},{seed:7,mode:'numeric',decks:['k1014','seijoh'],human,ai:E.AI,onGame(){logs=[];},onLog:t=>logs.push(t),onError:e=>errors.push(String(e))});s.start();await flush();let t=q.shift();assert.equal(t.req.kind,'firstService');const start=t.state;assert(!s.undo());t.resolve('receive');await flush();const old=q.shift();assert.equal(old.req.kind,'roll');assert.equal(s.game.firstServer,1);const selected=old.state,history=copy(s.entries);assert(s.undo());await flush();t=q.shift();assert.equal(t.req.kind,'firstService');assert.deepEqual(t.state,start);old.resolve(true);await flush();assert.deepEqual(snapshot(s.game,logs),start);t.resolve('serve');await flush();t=q.shift();assert.equal(t.req.kind,'roll');assert.equal(s.game.firstServer,0);s.start(history);await flush();t=q.shift();assert.equal(t.req.kind,'roll');assert.deepEqual(t.state,selected);s.stop();t.resolve(true);await flush();assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,openingMatrices:matrices,modes:['numeric','strict'],tieRerolled:true,bothWinnerChoices:true,actualServerAndMulliganOrder:true,conserved80:true,aiPolicy:'serve',invalidRejected:true,undoReplayAndStaleReply:true}));
})().catch(e=>{console.error(e);process.exitCode=1;});
