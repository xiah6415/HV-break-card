'use strict';
const assert=require('node:assert/strict'),E=require('../engine'),{UndoSession}=require('../undo-tools'),T=require('./covered-tests'),I=require('./node-inventory'),catalog=require('./data/cards.json');
const copy=x=>JSON.parse(JSON.stringify(x)),tick=()=>new Promise(r=>setImmediate(r));
async function check(code,entrant,ownFirst,accept){
 class Scenario extends E.Game{async run(){const card=catalog.cards.find(c=>c.card_no==='HV-'+code),f=entrant?T.chain(catalog,code,entrant,ownFirst):T.setup(catalog,card);T.install(this,f.k);await this.enterCharacter(this.players[0],f.dest,I.short(f.k.card(f.target).cardNo));return this.ask(this.players[0],{kind:'coveredDone',options:[{value:true,label:'覆蓋觸發完成'}]});}}
 const queue=[],errors=[],snapshot=g=>copy({players:g.players.map(p=>{const{g,agent,...data}=p;return data;}),cardState:g.cardState,sharedRulesState:g.sharedRulesState,sharedRulesPending:g.sharedRulesPending,sharedRulesEvents:g.sharedRulesEvents,phase:g.rulePhase,turn:g.turnNo});
 const agent={choose:(g,p,req)=>new Promise(resolve=>queue.push({req,resolve,state:snapshot(g)}))},session=new UndoSession({Game:Scenario},{seed:7,decks:['k1014','seijoh'],agents:[agent,agent],onError:e=>errors.push(e)});
 const name=entrant?catalog.cards.find(c=>c.card_no==='HV-'+(ownFirst?entrant:code)).display_name:null;
 const answer=r=>r.kind==='skill'?accept:r.kind==='guts'?r.options.slice(0,r.need).map(o=>o.value):name&&r.prompt?.includes('同時觸發')?r.options.find(o=>o.label.includes(name)).value:r.options[0].value;
 session.start();await tick();const points=[];
 for(let i=0;i<30;i++){const t=queue.shift();assert(t,JSON.stringify(errors));points.push(t);if(t.req.kind==='coveredDone')break;t.resolve(answer(t.req));await tick();}
 assert.equal(points.at(-1).req.kind,'coveredDone');const history=copy(session.entries);let stale=points.at(-1);
 for(let i=0;i<=history.length;i++){session.start(history.slice(0,i));await tick();const current=queue.shift();assert(current);assert.deepEqual(current.state,points[i].state,'Covered Undo '+code+' '+i);stale.resolve(answer(stale.req));await tick();assert.deepEqual(snapshot(session.game),current.state,'Stale coverage reply cannot mutate the restored state');stale=current;}
 assert.deepEqual(errors,[]);session.stop();return points.length;
}
(async()=>{let n=0;for(const code of ['P01-023','P01-028','P01-047','P04-021','P04-048'])for(const accept of [true,false])n+=await check(code,null,false,accept);for(const[c,e]of [['P01-023','P02-061'],['P01-028','P01-025'],['P04-048','P04-046']])for(const first of [true,false])n+=await check(c,e,first,true);console.log('covered Undo: '+n+' full trigger/payment/selection boundaries, both orders, accept/decline and stale reply isolation passed');})().catch(e=>{console.error(e);process.exitCode=1;});
