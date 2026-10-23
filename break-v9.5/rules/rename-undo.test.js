'use strict';
const assert=require('node:assert/strict'),E=require('../engine'),{UndoSession}=require('../undo-tools');
const copy=x=>JSON.parse(JSON.stringify(x)),tick=()=>new Promise(r=>setImmediate(r));
async function check(code){
const card=require('./data/cards.json').cards.find(c=>c.card_no==='HV-'+code),names=card.profiles[0].program.steps[0].choose_name,normalize=s=>s.normalize('NFKC').replace(/\s/g,'');
class Scenario extends E.Game{
 async run(){for(const p of this.players){p.hand=[];p.deck=[];p.drop=[];p.ev=[];p.sets=[];for(const z of Object.keys(p.area))p.area[z]=[];}const p=this.players[0];p.hand=[code,'D01-009'];this.cardState=null;this.beginTurn(p);this.rulePhase='atk';await this.enterCharacter(p,'attack',code);return this.ask(p,{kind:'turnEnd',options:[{label:'確認',value:true}]});}
}
 const queue=[],errors=[],snapshot=g=>copy({players:g.players.map(p=>{const{g,agent,...d}=p;return d;}),cardState:g.cardState,sharedRulesState:g.sharedRulesState,turn:g.turnNo});
 const agent={choose:(g,p,req)=>new Promise(resolve=>queue.push({req,resolve,state:snapshot(g)}))},session=new UndoSession({Game:Scenario},{seed:7,decks:['k1014','seijoh'],agents:[agent,agent],onError:e=>errors.push(e)});
 session.start();await tick();const name=queue.shift();assert.equal(name.req.kind,'name');name.resolve(name.req.options[1].value);await tick();const end=queue.shift();assert.equal(end.req.kind,'turnEnd');assert.equal(normalize(session.game.cardName(session.game.players[0],'attack')),normalize(names[1]));const history=copy(session.entries);
 session.start([]);await tick();const again=queue.shift();assert.deepEqual(again.state,name.state,'Undo returns to pre-entry physical cards and name choice');end.resolve(true);await tick();assert.deepEqual(snapshot(session.game),again.state,'Late completion does not mutate a restored name');
 again.resolve(again.req.options[0].value);await tick();assert.equal(normalize(session.game.cardName(session.game.players[0],'attack')),normalize(names[0]));queue.shift();
 session.start(history);await tick();const replay=queue.shift();assert.deepEqual(replay.state,end.state,'Replay restores selected name and role identity');assert.equal(errors.length,0);session.stop();console.log('rename Undo '+code+': before-name and named-role boundaries, alternate name, full state replay and stale callback passed');
}
(async()=>{for(const code of ['P01-072','P02-077','P02-078','P03-077'])await check(code);})().catch(e=>{console.error(e);process.exitCode=1;});
