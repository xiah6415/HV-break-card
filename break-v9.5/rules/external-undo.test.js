'use strict';
const assert=require('node:assert/strict'),E=require('../engine'),{UndoSession}=require('../undo-tools'),T=require('./external-tests'),C=require('./covered-tests'),I=require('./node-inventory'),catalog=require('./data/cards.json');
const copy=x=>JSON.parse(JSON.stringify(x)),tick=()=>new Promise(r=>setImmediate(r));
async function check(code,mode,accept){
 class Scenario extends E.Game{async run(){const card=catalog.cards.find(c=>c.card_no==='HV-'+code),f=T.setup(catalog,card,mode);C.install(this,f.k);this.rulePhase={serve:'srv',draw:'drw',attack:'atk',block:'blk'}[f.phase];Object.assign(this.rngState,f.k.state.rng);if(f.p.activation.skill_type==='event')await this.resolve(this.players[0],code,this.rulePhase);else await this.enterCharacter(this.players[0],f.phase,code);return this.ask(this.players[0],{kind:'coveredDone',options:[{value:true,label:'動作效果完成'}]});}}
 const queue=[],errors=[],snapshot=g=>copy({players:g.players.map(p=>{const{g,agent,...data}=p;return data;}),cardState:g.cardState,sharedRulesState:g.sharedRulesState,sharedRulesPending:g.sharedRulesPending,sharedRulesEvents:g.sharedRulesEvents,phase:g.rulePhase,turn:g.turnNo,rng:g.rngState});
 const agent={choose:(g,p,req)=>new Promise(resolve=>queue.push({req,resolve,state:snapshot(g)}))},session=new UndoSession({Game:Scenario},{seed:7,decks:['k1014','seijoh'],agents:[agent,agent],onError:e=>errors.push(e)});
 const answer=r=>r.kind==='skill'?accept:r.kind==='guts'?r.options.slice(0,r.need).map(o=>o.value):r.options[0].value;
 session.start();await tick();const points=[];
 for(let i=0;i<30;i++){const t=queue.shift();assert(t,JSON.stringify(errors));points.push(t);if(t.req.kind==='coveredDone')break;t.resolve(answer(t.req));await tick();}
 assert.equal(points.at(-1).req.kind,'coveredDone');const history=copy(session.entries);let stale=points.at(-1);
 for(let i=0;i<=history.length;i++){session.start(history.slice(0,i));await tick();const current=queue.shift();assert(current);assert.deepEqual(current.state,points[i].state,'External RNG Undo '+code+' '+i);stale.resolve(answer(stale.req));await tick();assert.deepEqual(snapshot(session.game),current.state,'Stale coverage reply cannot mutate the restored state');stale=current;}
 assert.deepEqual(errors,[]);session.stop();return points.length;
}
(async()=>{let n=0;for(const code of T.codes)n+=await check(code,'positive',true);n+=await check('P02-048','tails',true);n+=await check('P02-048','positive',false);n+=await check('PR-037','positive',false);n+=await check('PR-050','positive',false);console.log('external Undo: '+n+' complete RNG/action/result/payment/draw boundaries, decline and stale reply isolation passed');})().catch(e=>{console.error(e);process.exitCode=1;});
