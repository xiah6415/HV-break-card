'use strict';
const assert=require('node:assert/strict'),E=require('../engine'),{UndoSession}=require('../undo-tools'),T=require('./event-played-tests'),C=require('./covered-tests'),I=require('./node-inventory'),catalog=require('./data/cards.json');
const copy=x=>JSON.parse(JSON.stringify(x)),tick=()=>new Promise(r=>setImmediate(r));
async function check(code,accept){
 class Scenario extends E.Game{async run(){const card=catalog.cards.find(c=>c.card_no==='HV-'+code),f=T.setup(catalog,card);C.install(this,f.k);await this.resolve(this.players[0],I.short(f.k.card(f.event).cardNo),this.rulePhase);return this.ask(this.players[0],{kind:'eventDone',options:[{value:true,label:'Event及被動結算完成'}]});}}
 const queue=[],errors=[],snapshot=g=>copy({players:g.players.map(p=>{const{g,agent,...d}=p;return d;}),cardState:g.cardState,sharedRulesState:g.sharedRulesState,sharedRulesPending:g.sharedRulesPending,sharedRulesEvents:g.sharedRulesEvents,phase:g.rulePhase,turn:g.turnNo});
 const agent={choose:(g,p,req)=>new Promise(resolve=>queue.push({req,resolve,state:snapshot(g)}))},session=new UndoSession({Game:Scenario},{seed:7,decks:['k1014','seijoh'],agents:[agent,agent],onError:e=>errors.push(e)}),answer=r=>r.kind==='skill'?accept:r.kind==='guts'?r.options.slice(0,r.need).map(o=>o.value):r.options[0].value;
 session.start();await tick();const points=[];
 for(let i=0;i<30;i++){const t=queue.shift();assert(t,JSON.stringify(errors));points.push(t);if(t.req.kind==='eventDone')break;t.resolve(answer(t.req));await tick();}
 assert.equal(points.at(-1).req.kind,'eventDone');const history=copy(session.entries);let stale=points.at(-1);
 for(let i=0;i<=history.length;i++){session.start(history.slice(0,i));await tick();const current=queue.shift();assert(current);assert.deepEqual(current.state,points[i].state,'Event Undo '+code+' '+i);stale.resolve(answer(stale.req));await tick();assert.deepEqual(snapshot(session.game),current.state,'Stale Event answer cannot mutate restored state');stale=current;}
 assert.deepEqual(errors,[]);session.stop();return points.length;
}
(async()=>{let n=0;for(const code of ['P02-007','P03-039'])for(const accept of [true,false])n+=await check(code,accept);console.log('event-played Undo: '+n+' Event effect / optional fee / two-card selection boundaries, accept/decline and stale replies passed');})().catch(e=>{console.error(e);process.exitCode=1;});
