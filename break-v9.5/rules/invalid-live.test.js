'use strict';
const assert=require('node:assert/strict'),E=require('../engine'),B=require('./legacy'),I=require('./node-inventory'),F=require('./frequent-node-tests'),T=require('./invalid-node-tests'),catalog=require('./data/cards.json'),runtime=require('./runtime-data.json');
const copy=x=>JSON.parse(JSON.stringify(x));
function make(selector,actor='opponent'){const n={kind:'invalidate_skill',actor,selector,duration:actor==='self'?'this_turn':'next_opponent_turn'},g=new E.Game({seed:7,mode:'strict',decks:['k1014','seijoh'],agents:[E.AI,E.AI]}),k=F.game(catalog),id=k.addCard('HV-D01-009',0,'attack');g.beginTurn(g.players[0]);k.resolveProgram(n,0,id);g.sharedRulesState={version:1,fingerprint:runtime.fingerprint,next:k.state.next,effects:copy(k.state.effects),receipts:[]};if(actor==='opponent'){g.beginTurn(g.players[1]);k.endTurn();k.beginTurn(1);}return {g,k,n};}
(async()=>{
 for(const {node:n}of I.forms(catalog).invalidate_skill.values()){
  const {g,k}=make(n.selector,n.actor),player=n.actor==='self'?0:1;
  for(const s of [n.selector,n.selector.union_with].filter(Boolean)){const a=T.action(s,player),saved=copy(g.sharedRulesState);assert.equal(B.permission(g,a).allowed,k.permission(a).allowed);assert(!B.permission(g,a).allowed);assert.deepEqual(g.sharedRulesState,saved);}
  g.finishTurn(g.turnP);assert(B.permission(g,T.action(n.selector,player)).allowed);
 }
 for(const code of ['BP-013','P01-078']){
  const {g}=make({type:'event',play_icons_any:['attack']}),p=g.turnP;let asks=0;p.hand=[code];p.area.attack=['D01-001'];g.setRulePhase('atk');p.agent={choose:async()=>{asks++;throw Error('Disabled Event requested a choice');}};
  assert(g.playable(p,'atk').some(o=>o.card===code),'Disabled skill still permits playing the Event');await g.resolve(p,code,'atk');assert.deepEqual(p.ev,[code]);assert.equal(p.hand.length,0);assert.equal(asks,0);assert(!Object.keys(p.effects).length);assert.equal(g.sharedRulesState.effects.filter(e=>e.kind==='invalid').length,1);
 }
 const named=make({names:['木兎光太郎'],roles:['character']},'self'),p=named.g.turnP;p.hand=['PR-013'];p.agent={choose:async(g,p,r)=>r.options.find(o=>o.value.replace(/\s/g,'')==='木兎光太郎').value};await named.g.enterCharacter(p,'attack','PR-013');assert.equal(named.g.cardName(p,'attack').replace(/\s/g,''),'木兎光太郎');assert(!B.skillAllowed(named.g,p,'PR-013','attack'));assert.equal(named.g.cardName(p,'attack').replace(/\s/g,''),'木兎光太郎','A resolved pre-entry name is not removed');
 for(const target of ['PR-022','P01-006']){
  const {g}=make({roles:['receive','toss']}),p=g.turnP;p.hand=target==='PR-022'?['PR-022','P01-006']:['D01-009','P01-006'];p.deck=['D01-009'];p.area.receive=['D01-001','D01-001'];p.area.toss=['D01-001','D01-001'];g.ball={type:'attack',off:1};let skills=0,checked=false;
  p.agent={wantsAck:true,async choose(g,p,r){if(r.kind==='skill'){skills++;return true;}if(r.kind==='event')return null;if(r.kind==='receiver')return target==='PR-022'?'PR-022':'D01-009';if(r.kind==='setter'){if(target==='PR-022'){checked=true;assert.equal(p.ts.apass||0,0);throw Error('VERIFIED');}return 'P01-006';}if(r.kind==='attacker'){checked=true;assert.equal(p.ts.hin||0,0);throw Error('VERIFIED');}return r.options[0].value;}};
  await assert.rejects(g.receiveTurn(p),/VERIFIED/);assert(checked);assert.equal(skills,0,'Disabled legacy character cannot pay or draw');
 }
 const f=make({roles:['receive']});const q=f.g.turnP;q.hand=['P03-051'];q.area.receive=['D01-001','D01-001'];let asked=0;q.agent={choose:async()=>{asked++;return true;}};const drop=q.drop.length;await f.g.enterCharacter(q,'receive','P03-051');assert.equal(asked,0);assert.equal(q.drop.length,drop);
 console.log('invalid live: 11 selectors, expiry, common/legacy Event placement, legacy receive/toss without costs, shared passive gating and pre-entry name retention passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
