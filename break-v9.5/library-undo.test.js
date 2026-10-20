'use strict';
const assert=require('node:assert/strict'),E=require('./engine'),{UndoSession}=require('./undo-tools');
const copy=x=>JSON.parse(JSON.stringify(x)),flush=()=>new Promise(r=>setImmediate(r));
E.DECKS.libraryUndo={name:'New-card Undo',cards:{'P03-004':16,'PR-005':20,'P01-013':4}};
class Scenario extends E.Game{async run(){const [p,o]=this.players;this.beginTurn(p);this.moveCode(p.deck,p.area.receive,'P03-004');this.moveCode(p.deck,p.hand,'P01-013');p.ts.receiver='P03-004';p.ts.rcv=3;await this.resolve(p,'P01-013','rcv');await this.confirmTurnEnd(p,{type:'attack',off:4});this.finishTurn(p);this.beginTurn(o);await this.ask(o,{kind:'checkpoint',prompt:'next player',options:[{label:'ok',value:true}]});return o;}}
(async()=>{
 const queue=[],errors=[];let logs=[];
 const snapshot=g=>copy({players:g.players.map(p=>{const {g,agent,...x}=p;return x;}),cards:g.cardSnapshot(),turn:g.turnNo,turnEffects:g.turnEffects,sharedRulesState:g.sharedRulesState,sharedRulesPending:g.sharedRulesPending,sharedRulesEvents:g.sharedRulesEvents,sharedRulesDepth:g.sharedRulesDepth,rulePhase:g.rulePhase,ball:g.ball,src:g.src,logs});
 const provider={wantsAck:true,choose:(g,p,req)=>new Promise(resolve=>queue.push({req,resolve,state:snapshot(g)}))};
 const session=new UndoSession({Game:Scenario},{seed:17,decks:['libraryUndo','seijoh'],agents:[provider,provider],onGame(){logs=[];},onLog:s=>logs.push(s),onError:e=>errors.push(String(e))});
 const answer=r=>r.kind==='target'?'receive':r.options[0].value;
 session.start();await flush();const checkpoints=[];
 for(let i=0;i<10;i++){const t=queue.shift();assert(t,errors.join(','));checkpoints.push(t);if(t.req.kind==='checkpoint')break;t.resolve(answer(t.req));await flush();}
 assert.equal(checkpoints.at(-1).req.kind,'checkpoint');assert.equal(session.game.players[0].ts.rcv,5);const history=copy(session.entries);let obsolete=checkpoints.at(-1),restores=0;
 for(let i=0;i<=history.length;i++){session.start(history.slice(0,i));await flush();const t=queue.shift();assert(t,errors.join(','));assert.deepEqual(t.state,checkpoints[i].state);obsolete.resolve(answer(obsolete.req));await flush();assert.deepEqual(snapshot(session.game),t.state);obsolete=t;restores++;}
 let request=session.requestTakeback(0);assert(request);assert(session.resolveTakeback(request.id,1,false));assert.deepEqual(snapshot(session.game),checkpoints.at(-1).state);
 request=session.requestTakeback(0);assert(request);assert(session.resolveTakeback(request.id,1,true));await flush();const restored=queue.shift();assert.deepEqual(restored.state,checkpoints[request.target].state);obsolete.resolve(true);await flush();assert.deepEqual(snapshot(session.game),restored.state);assert.deepEqual(errors,[]);session.stop();delete E.DECKS.libraryUndo;
 console.log(JSON.stringify({passed:true,fullRestores:restores,physicalCards:80,crossTurnConsent:true,staleCallbacksIgnored:true}));
})().catch(e=>{console.error(e);process.exitCode=1;});
