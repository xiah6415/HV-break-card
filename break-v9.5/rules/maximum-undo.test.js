'use strict';
const assert=require('node:assert/strict'),E=require('../engine'),{UndoSession}=require('../undo-tools'),T=require('./maximum-tests'),C=require('./covered-tests'),I=require('./node-inventory'),catalog=require('./data/cards.json');
const copy=x=>JSON.parse(JSON.stringify(x)),tick=()=>new Promise(r=>setImmediate(r));
async function check(code,mode,accept){
 class Scenario extends E.Game{async run(){
  const card=catalog.cards.find(c=>c.card_no==='HV-'+code),f=T.setup(catalog,card,mode,4);C.install(this,f.k);this.rulePhase=f.phase==='attack'?'atk':'rcv';for(const b of f.initialBoost)this.boostParameter(this.players[0],b.key,b.param,b.value);
  if(mode==='invalid')this.sharedRulesState={version:1,fingerprint:require('./runtime-data.json').fingerprint,next:f.k.state.next,effects:copy(f.k.state.effects.filter(e=>e.kind!=='numeric')),receipts:[]};
  const p=this.players[0];p.ts.setter=code;p.ts.setterRef=this.roleReference(p,'toss');p.ts.toss=this.parameter(p,'toss','tos');
  for(let i=0;i<4;i++){await this.resolve(p,'P03-096',this.rulePhase);await this.ask(p,{kind:i===3?'coveredDone':'capCheckpoint',options:[{value:true,label:'Event '+(i+1)+' 結算完成'}]});}return true;}}

 const queue=[],errors=[],snapshot=g=>copy({players:g.players.map(p=>{const{g,agent,...data}=p;return data;}),cardState:g.cardState,sharedRulesState:g.sharedRulesState,sharedRulesPending:g.sharedRulesPending,sharedRulesEvents:g.sharedRulesEvents,phase:g.rulePhase,turn:g.turnNo,rng:g.rngState});
 const agent={choose:(g,p,req)=>new Promise(resolve=>queue.push({req,resolve,state:snapshot(g)}))},session=new UndoSession({Game:Scenario},{seed:7,decks:['k1014','seijoh'],agents:[agent,agent],onError:e=>errors.push(e)});
 const answer=r=>mode==='decline'&&r.options.some(o=>o.label==='不登場'||o.value===false)?r.options.find(o=>o.label==='不登場'||o.value===false).value:r.kind==='skill'?accept:r.kind==='guts'?r.options.slice(0,r.need).map(o=>o.value):r.options[0].value;
 session.start();await tick();const points=[];
 for(let i=0;i<30;i++){const t=queue.shift();assert(t,JSON.stringify(errors));points.push(t);if(t.req.kind==='coveredDone')break;t.resolve(answer(t.req));await tick();}
 assert.equal(points.at(-1).req.kind,'coveredDone');const history=copy(session.entries);let stale=points.at(-1);
 for(let i=0;i<=history.length;i++){session.start(history.slice(0,i));await tick();const current=queue.shift();assert(current);assert.deepEqual(current.state,points[i].state,'Simultaneous Undo '+code+' '+i);stale.resolve(answer(stale.req));await tick();assert.deepEqual(snapshot(session.game),current.state,'Stale coverage reply cannot mutate the restored state');stale=current;}
 assert.deepEqual(errors,[]);session.stop();return points.length;
}
(async()=>{let n=0;for(const code of T.codes)for(const mode of ['positive','wrong_phase','external','invalid'])n+=await check(code,mode,true);console.log('source skill maximum Undo: '+n+' full four-Event/cap/cache boundaries and stale reply isolation passed');})().catch(e=>{console.error(e);process.exitCode=1;});
