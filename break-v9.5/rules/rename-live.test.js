'use strict';
const assert=require('node:assert/strict'),E=require('../engine'),F=require('./frequent-node-tests'),{Kernel}=require('./core'),runtime=require('./runtime-data.json'),B=require('./legacy'),H=require('../host-choice');
const norm=s=>s.normalize('NFKC').replace(/\s/g,''),pair='P01-072';
function game(agent=E.AI){const g=new E.Game({mode:'strict',seed:7,decks:['k1014','seijoh'],agents:[agent,agent]});for(const p of g.players){p.hand=[];p.deck=[];p.drop=[];p.ev=[];p.sets=[];for(const z of Object.keys(p.area))p.area[z]=[];}g.cardState=null;g.beginTurn(g.players[0]);return g;}
(async()=>{
 // Normal rule entry and Event retrieval entry, name conflict and scoped expiry.
 for(const origin of ['hand','drop']){
  const asks=[],g=game({async choose(g,p,r){asks.push(r);return r.options[0].value;}}),p=g.players[0];p[origin].push(pair);p.area.toss.push('D01-001');g.cardState=null;g.rulePhase='atk';
  await g.enterCharacter(p,'attack',pair,origin==='drop');assert.equal(norm(g.cardName(p,'attack')),'孤爪研磨');assert.equal(asks[0].options.length,1,'Same-name setter excludes Hinata before offering names');
  g.finishTurn(p);assert.equal(g.cardName(p,'attack'),E.nm(pair));
 }
 // Two physical copies may block as distinct chosen names (QA1202).
 {
  const seen=[],g=game({async choose(g,p,r){if(r.kind==='block')return {cards:[pair,pair],center:pair};if(r.kind==='name'){seen.push(r);return r.options[0].value;}return true;}}),p=g.players[0];p.hand=[pair,pair];g.cardState=null;g.rulePhase='blk';g.ball={type:'attack',off:0};
  assert(g.evalBlock(p,[pair,pair]).legal);assert(!g.evalBlock(p,[pair,pair,pair]).legal,'No third physical copy');
  g.eventLoop=async()=>{assert.notEqual(g.cardName(p,'block'),g.cardName(p,'side:0'));assert.equal(p.hand.length,0);};g.confirmTurnEnd=async(p,b)=>b;
  await g.blockTurn(p,[]);assert.equal(seen.length,2);assert.equal(seen[1].options.length,1);assert(p.drop.includes(pair));
 }
 // A flexible first card must leave a valid name for a fixed later blocker.
 {
  const k=new Kernel({...runtime,mode:'live',choose:r=>r.options[0]});k.state.turn.phase='block';const a=k.addCard('HV-'+pair,0,'hand'),b=k.addCard('HV-D01-001',0,'hand'),old=k.addCard('HV-D01-009',0,'block');
  const before=k.snapshot();k.enterBlock([a,b],a);assert.equal(k.effectiveName(a),'孤爪研磨');assert.equal(k.effectiveName(b),'日向翔陽');assert.equal(k.role(old),'guts');const after=k.snapshot();k.restore(before);k.enterBlock([a,b],a);assert.deepEqual(k.snapshot(),after);
 }
 // Printed-name hand/Guts filters do not inherit the chosen court name.
 {
  const k=F.game(runtime.catalog),a=k.addCard('HV-'+pair,0,'hand');k.state.turn.phase='attack';k.choose=r=>r.options[0];k.enter(a,'attack');assert(k.matches(a,{names:['日向翔陽']},k._context(a,0)));k._atomic(()=>k._move(a,0,'drop',k._context(a,0)));assert(!k.matches(a,{names:['日向翔陽']},k._context(a,0)));
 }
 console.log('rename live: hand/drop entry, setter conflict, two-copy blockers, complete group names, role expiry, printed-name filters and core Undo passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
