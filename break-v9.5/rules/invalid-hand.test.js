'use strict';
/* Claude 巡檢回歸（2026-10-22）：手牌角色技能被失效時不可宣告。
   qa-play seed29（烏野 vs 青葉城西）：岩泉 P04-020 讓對手下回合 [接球][手牌] 技能失效，成田 P02-011 仍被列為可用，
   使用後核心回 invalid、牌留在手上 → 無限詢問。失效的 Event 仍可打出（QA，見 invalid-live.test.js）。 */
const assert=require('node:assert/strict'),E=require('../engine'),F=require('./frequent-node-tests'),catalog=require('./data/cards.json'),runtime=require('./runtime-data.json');
const copy=x=>JSON.parse(JSON.stringify(x));
function make(selector){
 const g=new E.Game({seed:7,mode:'strict',decks:['k1014','seijoh'],agents:[E.AI,E.AI]}),k=F.game(catalog),id=k.addCard('HV-D01-009',0,'attack');
 g.beginTurn(g.players[0]);
 if(selector){k.resolveProgram({kind:'invalidate_skill',actor:'opponent',selector,duration:'next_opponent_turn'},0,id);g.sharedRulesState={version:1,fingerprint:runtime.fingerprint,next:k.state.next,effects:copy(k.state.effects),receipts:[]};}
 g.finishTurn(g.turnP);g.beginTurn(g.players[1]);return g;
}
(async()=>{
 for(const selector of [null,{phase_tags:['receive'],source_zones:['hand']},{keyword_families:['one_touch'],union_with:{phase_tags:['receive'],source_zones:['hand']}}]){
  const g=make(selector),p=g.turnP;p.hand=['P02-011'];p.area.receive=['D01-001'];p.area.toss=['D01-002'];p.area.attack=['D01-003'];g.ball={type:'attack',off:9};g.setRulePhase('rcv');
  const offered=g.playable(p,'rcv').some(o=>o.card==='P02-011');
  assert.equal(offered,!selector,'P02-011 offered only when its hand skill is not invalidated: '+JSON.stringify(selector));
  let asks=0;p.agent={async choose(g,q,r){if(++asks>50)throw Error('STALL');if(r.kind==='event')return r.options[0].value;return E.AI.choose.call(this,g,q,r);}};
  await g.eventLoop(p,'rcv',{});assert(asks<50,'Event loop terminates');
  assert.equal(p.hand.includes('P02-011'),!!selector,selector?'Invalidated card stays in hand, nothing paid':'Valid use discards it as cost');
 }
 console.log('invalid hand skill: invalidated character hand skills are not offered; event loop terminates; valid use still pays the cost');
})().catch(e=>{console.error(e);process.exitCode=1;});
