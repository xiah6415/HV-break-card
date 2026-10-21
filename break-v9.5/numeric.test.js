'use strict';
const assert=require('node:assert/strict'),E=require('./engine'),D=require('./deck-tools'),L=require('./card-library'),R=require('./rules/runtime-data.json');
const locked=L.search('','locked'),chars=locked.filter(c=>c.kind==='C'&&c.stats.some(n=>n!==null));
function setup(mode='numeric',choose=async(g,p,r)=>r.kind==='event'?null:r.options[0].value){const g=new E.Game({mode,seed:7,decks:['k1014','seijoh'],agents:[{choose,wantsAck:true},E.AI]});for(const p of g.players){for(const z of ['hand','deck','drop','sets','ev'])p[z]=[];for(const a in p.area)p.area[a]=[];}g.beginTurn(g.players[0]);return [g,g.players[0]];}
(async()=>{
 assert.equal(Object.keys(E.DEF).length,541);assert.equal(R.catalog.cards.length,541);assert.equal(R.approved.length,164);assert.equal(R.catalog.cards.flatMap(c=>c.profiles).filter(p=>p.program).length,164);
 for(const c of locked){const cards=c.kind==='C'?{[c.code]:40}:{[c.code]:8,'P01-004':32};const payload={cards};assert.throws(()=>D.parseDeck(payload,E.DEF),/尚未開放/);assert(D.inspectDeck(payload,E.DEF,{mode:'numeric'}).ok);assert(D.parseDeck(payload,E.DEF,{mode:'numeric'}));assert.equal(R.catalog.cards.find(x=>x.card_no===c.number).profiles[0].program,null);}
 const sample={name:'數值模式新卡',cards:Object.fromEntries(chars.slice(0,10).map(c=>[c.code,4]))};E.DECKS.numeric=sample;assert.throws(()=>new E.Game({decks:['numeric','seijoh'],agents:[E.AI,E.AI]}),/尚未開放/);
 let games=0;const used=new Set();for(let seed=0;seed<150;seed++){E.DECKS.numeric={name:sample.name,cards:Object.fromEntries(Array.from({length:10},(_,i)=>[chars[(seed*10+i)%chars.length].code,4]))};const g=new E.Game({mode:'numeric',seed,decks:['numeric',seed%2?'seijoh':'numeric'],agents:[E.AI,E.AI]});await g.run();assert(g.winner);const physical=g.cardSnapshot();assert.equal(Object.keys(physical.cards).length,80);for(const p of g.players){const actual=Object.values(physical.cards).filter(c=>c.owner===p.idx).map(c=>c.code).sort(),expected=Object.entries(E.DECKS[p.deckKey].cards).flatMap(([c,n])=>Array(n).fill(c)).sort();assert.deepEqual(actual,expected);actual.forEach(c=>used.add(c));}games++;}assert(chars.every(c=>used.has(c.code)));
 for(const [param,index]of [['srv',0],['blk',1],['rcv',2],['tos',3],['atk',4]]){const [g,p]=setup();p.area.receive=['P03-004'];const ref=g.roleReference(p,'receive'),base=E.st('P03-004',param);await g.manualAction(p,{kind:'adjust',key:'receive',param,ref,delta:1});assert.equal(g.parameter(p,'receive',param),base+1);await g.manualAction(p,{kind:'adjust',key:'receive',param,ref,delta:-1});assert.equal(g.parameter(p,'receive',param),base);await assert.rejects(g.manualAction(p,{kind:'adjust',key:'receive',param,ref:{...ref,incarnation:ref.incarnation+1},delta:1}),/改變/);}
 {
 const [g,p]=setup();p.deck=['P01-004','P01-004'];const before=Object.keys(g.cardSnapshot().cards).length;await g.manualAction(p,{kind:'draw'});const ref=g.cardReference(p,'hand',0);await g.manualAction(p,{kind:'discard',ref});assert.deepEqual(p.drop,['P01-004']);assert.equal(Object.keys(g.cardSnapshot().cards).length,before);await assert.rejects(g.manualAction(p,{kind:'discard',ref}),/已空|改變/);g.ball={type:'attack',off:5};await g.manualAction(p,{kind:'ball',delta:-1});assert.equal(g.ball.off,4);
 }
 {
 const [g,p]=setup();p.opp.area.receive=['P03-004'];const ref=g.roleReference(p.opp,'receive');await g.manualAction(p,{kind:'adjust',player:1,key:'receive',param:'rcv',ref,delta:1});assert.equal(g.parameter(p.opp,'receive','rcv'),4);g.finishTurn(p);assert.equal(g.parameter(p.opp,'receive','rcv'),3);
 }
 {
 const [g,p]=setup('strict');await assert.rejects(g.manualAction(p,{kind:'draw'}),/不能/);
 }
 {
 const c=locked.find(c=>c.kind==='E'&&c.activationPhases.includes('attack'));const [g,p]=setup();p.hand=[c.code];assert(g.playable(p,'atk').some(o=>o.card===c.code));assert(!g.playable(p,'srv').some(o=>o.card===c.code)||c.activationPhases.includes('serve'));await g.resolve(p,c.code,'atk');assert.deepEqual(p.ev,[c.code]);assert.deepEqual(p.effects,{});assert.equal(p.hand.length,0);
 }
 {
 let n=0;const [g,p]=setup('numeric',async(g,p,r)=>n++===0?{__manual:{kind:'adjust',key:'serve',param:'srv',ref:g.roleReference(p,'serve'),delta:1}}:true);p.area.serve=['P03-004'];const out=await g.confirmTurnEnd(p,{type:'serve',off:2});assert.equal(out.off,3);
 }
 {
 const [g,p]=setup();p.area.block=['P01-004'];p.ts.sides=['P03-004'];p.ts.blockers=['P01-004','P03-004'];p.ts.blk=3;const ref=g.roleReference(p,'side:0');await g.manualAction(p,{kind:'adjust',key:'side:0',param:'blk',ref,delta:1});assert.equal(p.ts.blk,4);await g.manualAction(p,{kind:'adjust',key:'side:0',param:'blk',ref,delta:-1});assert.equal(p.ts.blk,3);
 }
 {
 const [g,p]=setup();p.opp.deck=['P03-004'];p.opp.hand=['P01-004'];const before=Object.keys(g.cardSnapshot().cards).length;await g.manualAction(p,{kind:'draw',player:1});assert.equal(p.opp.hand.length,2);await g.manualAction(p,{kind:'discard',player:1});assert.equal(p.opp.hand.length,1);assert.equal(p.opp.drop.length,1);assert.equal(Object.keys(g.cardSnapshot().cards).length,before);await assert.rejects(g.manualAction(p.opp,{kind:'draw'}),/不能/);
 }
 {
 const [g,p]=setup();p.area.receive=['PR-057'];const ref=g.roleReference(p,'receive');await assert.rejects(g.manualAction(p,{kind:'adjust',key:'receive',param:'srv',ref,delta:1}),/不能調整/);g.sharedRulesPending={};await assert.rejects(g.manualAction(p,{kind:'draw'}),/不能/);
 }
 delete E.DECKS.numeric;console.log(JSON.stringify({passed:true,strict:354,numeric:541,skillApprovals:164,lockedChecked:locked.length,realGames:games,lockedCharactersUsed:chars.length,manualFiveParameters:true,manualResourcesAndBall:true}));
})().catch(e=>{console.error(e);process.exitCode=1;});
