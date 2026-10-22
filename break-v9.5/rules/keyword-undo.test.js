'use strict';
const assert=require('node:assert/strict'),E=require('../engine'),{UndoSession}=require('../undo-tools'),I=require('./node-inventory'),{fixture}=require('./batch-smoke');
const catalog=require('./data/cards.json'),copy=x=>JSON.parse(JSON.stringify(x)),tick=()=>new Promise(r=>setImmediate(r));
class Scenario extends E.Game{
 async run(){const card=catalog.cards.find(c=>c.card_no==='HV-P01-041'),{k}=fixture(card,card.profiles[0],'attack',{rich:true,max:true,conditioned:true,expanded:true,key:'positive'},0,catalog),s=k.snapshot();for(const p of this.players){for(const [host,z]of Object.entries({hand:'hand',deck:'deck',drop:'drop',ev:'event',sets:'sets'}))p[host]=s.zones[p.idx+'.'+z].map(id=>I.short(s.cards[id].cardNo));for(const z of Object.keys(p.area))p.area[z]=s.zones[p.idx+'.'+z].map(id=>I.short(s.cards[id].cardNo));}this.cardState=null;const p=this.players[0];this.beginTurn(p);this.rulePhase='atk';this.ball={type:'attack',off:8};await this.enterCharacter(p,'attack','P01-041');const effect=this.sharedRulesState.effects.find(e=>e.kind==='keyword'&&e.keyword==='feint');this.sharedRulesState.effects.push({...copy(effect),id:'second-feint',N:7});return this.confirmTurnEnd(p,{type:'attack',off:99});}
}
(async()=>{
 const queue=[],errors=[];const snapshot=g=>copy({players:g.players.map(p=>{const{g,agent,...data}=p;return data;}),cardState:g.cardState,sharedRulesState:g.sharedRulesState,sharedRulesPending:g.sharedRulesPending,rulePhase:g.rulePhase,turn:g.turnNo});
 const provider={wantsAck:true,choose:(g,p,req)=>new Promise(resolve=>queue.push({req,resolve,state:snapshot(g)}))};
 const session=new UndoSession({Game:Scenario},{seed:7,decks:['k1014','seijoh'],agents:[provider,provider],onError:e=>errors.push(e)});session.start();await tick();const points=[];
 const answer=r=>r.kind==='skill'?true:r.kind==='guts'?r.options.slice(0,r.need).map(o=>o.value):r.ctx?.keywordOutgoing?7:true;
 for(let i=0;i<10;i++){const t=queue.shift();assert(t);points.push(t);if(t.req.kind==='turnEnd')break;t.resolve(answer(t.req));await tick();}
 assert.equal(points.at(-1).req.kind,'turnEnd');assert.equal(points.at(-1).req.outgoing.off,7);const history=copy(session.entries);assert.equal(history.length,3);
 let stale=points.at(-1);for(let index=0;index<=history.length;index++){session.start(history.slice(0,index));await tick();const current=queue.shift();assert(current);assert.deepEqual(current.state,points[index].state,'Restore keyword fee/mode/end boundary '+index);stale.resolve(answer(stale.req));await tick();assert.deepEqual(snapshot(session.game),current.state,'Stale callback cannot change restored keywords');stale=current;}
 assert.equal(errors.length,0);session.stop();console.log('keyword Undo: four complete fee/physical selection/end-value/turn-end boundaries and stale callbacks passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
