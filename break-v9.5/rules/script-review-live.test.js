'use strict';
const assert=require('node:assert/strict'),E=require('../engine'),I=require('./node-inventory'),{fixture}=require('./batch-smoke'),H=require('../host-choice'),catalog=require('./data/cards.json');
const roles=['serve','block','receive','toss','attack'];
async function run(code,{ballKind='attack',opponentHand,emptyOpponentDeck=false}={}){
 const c=catalog.cards.find(c=>I.short(c.card_no)===code),p=c.profiles[0],phase=p.activation.skill_type==='passive'?p.activation.trigger.destination_any[0]:p.activation.activation_phases[0];
 const {k,id}=fixture(c,p,phase,{rich:true,max:true,conditioned:true,expanded:true,key:'positive'},0,catalog);
 if(opponentHand!=null)while(k.zone(1,'hand').length>opponentHand){const x=k.zone(1,'hand').pop();k.card(x).zone='1.sets';k.zone(1,'sets').push(x);}
 if(emptyOpponentDeck)while(k.zone(1,'deck').length){const x=k.zone(1,'deck').pop();k.card(x).zone='1.sets';k.zone(1,'sets').push(x);}
 const before=k.snapshot(),requests=[],agent={async choose(g,p,r){requests.push({player:p.idx,...r});if(r.kind==='skill')return E.AI.choose(g,p,r);if(r.kind==='guts'||r.kind==='gutsCourt')return r.options.slice(0,r.need).map(o=>o.value);return r.options.at(-1).value;}};
 const g=new E.Game({mode:'strict',seed:7,decks:['k1014','seijoh'],agents:[agent,agent]});
 for(const q of g.players){for(const [host,z]of Object.entries({hand:'hand',deck:'deck',drop:'drop',ev:'event',sets:'sets'}))q[host]=before.zones[q.idx+'.'+z].map(x=>I.short(before.cards[x].cardNo));for(const z of roles)q.area[z]=before.zones[q.idx+'.'+z].map(x=>I.short(before.cards[x].cardNo));}
 g.cardState=null;g.beginTurn(g.players[0]);g.ball={type:ballKind,off:7};g.rulePhase={serve:'srv',block:'blk',draw:'drw',receive:'rcv',toss:'tos',attack:'atk'}[phase];
 if(p.activation.skill_type==='passive')await g.enterCharacter(g.players[0],phase,code);else await g.resolve(g.players[0],code,g.rulePhase);
 return {g,requests,before};
}
(async()=>{
 for(const code of ['P01-091','P03-067'])for(const kind of ['serve','block']){
  const {g,requests,before}=await run(code,{ballKind:kind});assert.deepEqual(g.players[0].area.block,before.zones['0.block'].map(id=>I.short(before.cards[id].cardNo)));assert.equal(g.ball.off,7);const warning=requests.find(r=>r.ctx?.ineffectiveReason);assert(warning);assert.match(warning.prompt,/無效/);assert.equal(await E.AI.choose(g,g.players[0],warning),false);
 }
 for(const [code,n]of [['P04-018',4],['PR-025',3]]){const {g,requests}=await run(code,{opponentHand:n});assert(requests.some(r=>r.player===1&&r.kind==='rulesChoice'));assert.equal(g.players[1].hand.length,n-1);}
 {const {g,requests,before}=await run('P02-080',{emptyOpponentDeck:true});assert(requests.some(r=>r.player===0&&r.options.some(o=>o.card&&before.zones['1.event'].some(id=>I.short(before.cards[id].cardNo)===o.card))));assert.equal(g.players[1].deck.length,1);}
 const req={protocol:'break.host.v1',matchId:'test',requestId:'warn',epoch:1,revision:1,decisionIndex:0,actor:0,origin:'kernel',kind:'activate_payment',prompt:'非攻擊，付了也無效',input:{type:'single'},options:[{id:'yes',value:true,label:'支付'},{id:'no',value:false,label:'不支付'}],context:{ineffectiveReason:'來球不是攻擊'},source:null,timing:'receive',canLoss:false,canManual:false};assert.equal(H.aiAnswer(req).value,false);
 console.log('script review live: non-attack warning / both AIs decline / opponent private choice / public Event owner-bottom passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
