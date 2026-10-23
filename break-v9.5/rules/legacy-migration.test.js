'use strict';
const assert=require('node:assert/strict'),F=require('./frequent-node-tests'),catalog=require('./data/cards.json'),runtime=require('./runtime-data.json'),E=require('../engine'),bridge=require('./legacy');
const codes=Object.keys(require('./legacy-skills.json').cards);
const add=(k,no,z='hand')=>k.addCard('HV-'+no,0,z);
function game(phase){const k=F.game(catalog);k.state.turn.phase=phase;k.state.ball={kind:'attack',owner:1,offense:2};return k;}
function replay(k,run){const before=k.snapshot();run();const after=k.snapshot();k.restore(before);run();assert.deepEqual(k.snapshot(),after);}
for(const code of codes){assert.equal(runtime.authority.cards[code].kind,'shared');assert(bridge.handles(code));}
assert.equal(runtime.authority.counts.legacy,0);
// Paid Kageyama creates a turn effect even when the revealed card is not taken.
// It continues after the setter leaves and applies separately to each Hinata.
for(const mode of ['match','nonmatch','short','decline']){
 const k=game('toss'),id=add(k,'P01-006'),gut=mode==='short'?1:2;
 for(let i=0;i<gut;i++)add(k,'D01-009','toss');const top=add(k,mode==='match'?'P01-004':'D01-009','deck');
 const choose=k.choose;k.choose=r=>r.kind==='activate_payment'?mode!=='decline':choose(r);
 replay(k,()=>k.enter(id,'toss'));
 const paid=!['short','decline'].includes(mode);assert.equal(k.state.effects.filter(e=>e.kind==='watch').length,paid?1:0);
 assert.equal(k.card(top).zone,paid&&mode==='match'?'0.hand':'0.deck');
 if(paid){k._atomic(()=>k._move(id,0,'drop',k._context(id,0)));for(const x of [...k.zone(0,'toss')])k._atomic(()=>k._move(x,0,'drop',k._context(id,0)));k.advancePhase('attack');
  for(let i=0;i<2;i++){const h=add(k,'P01-004');k.enter(h,'attack');assert.equal(k.parameter(h,'attack'),k.card(h).printed.parameters.attack+2);}k.endTurn();assert(!k.state.effects.some(e=>e.kind==='watch'));}
}
// The newly placed Open Attack is counted; the third copy still draws/discards
// but cannot summon. Successful entry alone receives the dependent +1.
for(const previous of [0,1,2]){
 const k=game('attack'),id=add(k,'P01-078'),hin=add(k,'P01-004','drop');for(let i=0;i<previous;i++)add(k,'P01-078','event');for(let i=0;i<2;i++)add(k,'D01-009','deck');
 replay(k,()=>k.playEvent(id));assert.equal(k.zone(0,'hand').length,1);assert.equal(k.card(hin).zone,previous<2?'0.attack':'0.drop');if(previous<2)assert.equal(k.parameter(hin,'attack'),4);
}
// Both named recovery slots may be declined when eligible cards exist.
{const k=game('draw'),id=add(k,'PR-029'),a=add(k,'P01-004','drop'),b=add(k,'P01-006','drop');k.choose=r=>r.kind==='move_count'?0:F.choose(r);replay(k,()=>k.playEvent(id));assert.deepEqual(k.zone(0,'drop'),[a,b]);assert.equal(k.zone(0,'event')[0],id);assert.equal(k.zone(0,'hand').length,0);}
// S is a printed position, not a hard-coded list of three setter names.
for(const pay of [true,false]){
 const k=game('toss'),id=add(k,'P03-086'),s=catalog.cards.find(c=>c.profiles[0].variants[0].printed.position_tags.includes('S')&&c.profiles[0].variants[0].printed.name==='孤爪研磨'),setter=k.addCard(s.card_no,0,'toss'),attack=add(k,'P01-078','event'),multi=add(k,'P03-096','event');
 k.effect('numeric',{target:k.reference(setter),parameter:'toss',operation:'add',value:4},k._context(setter,0));const choose=k.choose;k.choose=r=>r.kind==='activate_payment'?pay:choose(r);
 replay(k,()=>k.playEvent(id));assert.equal(k.parameter(setter,'toss'),2);assert.equal(k.card(id).zone,pay?'0.deck':'0.event');assert.equal(k.card(attack).zone,pay?'0.hand':'0.event');assert.equal(k.card(multi).zone,'0.event','Only attack-only Events are eligible');
}
// Attack +1 and the paid arbitrary parameter both bind to the original target.
// Six Guts may be combined across areas; same-name copies share the turn lock.
{
 const k=game('receive'),id=add(k,'P03-087');for(let i=0;i<3;i++)add(k,'D01-009','receive');const target=add(k,'P01-006','receive');for(let i=0;i<3;i++)add(k,'D01-009','serve');add(k,'D01-005','serve');for(let i=0;i<4;i++)add(k,'D01-009','deck');
 const choose=k.choose;k.choose=r=>r.kind==='target'&&r.options.includes(target)?[target]:r.kind==='parameter'?'receive':choose(r);
 replay(k,()=>k.playEvent(id));assert.equal(k.parameter(target,'attack'),3);assert.equal(k.parameter(target,'receive'),3);assert.equal(k.zone(0,'drop').length,6);assert.equal(k.zone(0,'hand').length,1);
 const second=add(k,'P03-087'),before=k.zone(0,'deck').length;assert(k.playEvent(second).invalid);assert.equal(k.zone(0,'deck').length,before,'Same-name lock prevents a second skill but still permits Event placement');
}
// A Pass applies to the next setter, independently from the optional paid draw.
for(const [kind,off,paid]of [['serve',2,true],['attack',2,false],['block',2,false],['attack',3,false]]){
 const k=game('receive'),id=add(k,'PR-022');if(paid)add(k,'D01-009','receive');add(k,'D01-009','deck');k.state.ball={kind,owner:1,offense:off};replay(k,()=>k.enter(id,'receive'));
 const active=kind!=='block'&&off<=2;assert.equal(k.zone(0,'hand').length,paid?1:0);k.advancePhase('toss');const setter=add(k,'D01-009');k.enter(setter,'toss');assert.equal(k.parameter(setter,'toss'),k.card(setter).printed.parameters.toss+(active?1:0));
}
(async()=>{
 {let paymentSeen=false;const agent={wantsAck:true,async choose(g,p,r){if(r.kind==='skill'){assert(r.prompt.includes('牌庫底')&&!r.prompt.includes('棄牌區'),'Payment prompt must name the actual destination');paymentSeen=true;return true;}return r.kind==='target'?'toss':r.options[0].value;}};const g=new E.Game({decks:['k1014','seijoh'],agents:[agent,agent]});for(const p of g.players){for(const z of ['hand','deck','drop','ev','sets'])p[z]=[];for(const z of Object.keys(p.area))p.area[z]=[];}const p=g.players[0];p.hand=['P03-086'];p.area.toss=['P01-006'];g.cardState=null;g.beginTurn(p);await g.resolve(p,'P03-086','tos');assert(paymentSeen);assert.deepEqual(p.deck,['P03-086']);assert.equal(g.parameter(p,'toss','tos'),2);}
 const g=new E.Game({decks:['k1014','seijoh'],agents:[E.AI,E.AI]});for(const code of codes)await assert.rejects(g.resolveLegacy(g.players[0],code,'atk'),/舊控制器已停用/);console.log('legacy migration: seven shared grants, actual paid/unpaid effects, repeated entry watchers, Event count/position/icon semantics, cross-area payment, same-name locks, A Pass and retired-controller refusal passed');})().catch(e=>{console.error(e);process.exitCode=1;});
