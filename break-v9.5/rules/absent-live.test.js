'use strict';
const assert=require('node:assert/strict'),E=require('../engine'),B=require('./legacy'),C=require('./covered-tests'),T=require('./absent-tests'),I=require('./node-inventory'),catalog=require('./data/cards.json'),runtime=require('./runtime-data.json');
async function make(mode='positive',cards=['P01-001','P01-009']){
 const f=T.setup(catalog,catalog.cards.find(c=>c.card_no==='HV-P02-027'),mode),{k}=f;for(const code of cards)k.addCard('HV-'+code,1,'hand');const mill=catalog.cards.find(c=>!c.profiles[0].program&&c.profiles[0].variants[0].printed.affiliation_tags.includes('梟谷'));k.addCard(mill.card_no,1,'deck');
 const agent={async choose(g,p,r){if(r.kind==='skill')return mode!=='decline';if(r.kind==='block')return {cards,center:cards[0]};if(r.kind==='guts')return r.options.slice(0,r.need).map(o=>o.value);return r.options[0].value;}},g=new E.Game({seed:7,mode:'strict',decks:['k1014','seijoh'],agents:[agent,agent]});C.install(g,k);if(k.state.effects.length)g.sharedRulesState={version:1,fingerprint:runtime.fingerprint,next:k.state.next,effects:structuredClone(k.state.effects),receipts:[]};T.invoke(f);await g.enterCharacter(g.players[0],'attack','P02-027');
 for(const p of g.players)for(const[h,z]of Object.entries({hand:'hand',deck:'deck',drop:'drop',ev:'event',sets:'sets'}))assert.deepEqual(p[h],k.zone(p.idx,z).map(x=>I.short(k.card(x).cardNo)));
 g.finishTurn(g.players[0]);g.beginTurn(g.players[1]);k.endTurn();k.beginTurn(1,'block');g.ball={type:'attack',off:3};k.state.ball={kind:'attack',offense:3,owner:0};g.rulePhase='blk';return{g,k,p:g.players[1]};
}
(async()=>{
 let count=0;
 for(const mode of ['positive','condition_false','decline','invalid']){
  const {g,k,p}=await make(mode),yes=mode==='positive';assert.equal(g.parameterAbsent(p,'block','blk'),yes);assert.equal(g.evalBlock(p,['P01-001','P01-009'],3,'P01-001').total,yes?3:6);
  g.eventLoop=async()=>{assert.equal(g.parameter(p,'block','blk'),yes?null:3);assert.equal(g.parameter(p,'side:0','blk'),3);assert.equal(p.ts.blk,yes?3:6);g.boostParameter(p,'block','blk',2);assert.equal(g.parameter(p,'block','blk'),yes?null:5);};assert.equal((await g.blockTurn(p,[])).type,'block');assert.equal(B.parameterAbsent(g,p,'block','blk'),false,'Expires when this opponent turn finishes');count++;
 }
 // QA1291: actual center One Touch works even with its block parameter absent.
 {const {g,p}=await make('positive',['P01-051']);g.ball.off=4;g.receiveTurn=async()=>({type:'oneTouch',off:g.ball.off});const result=await g.blockTurn(p,[]);assert.equal(result.type,'oneTouch');assert.equal(result.off,1);count++;}
 // The chosen center affects preview; its printed value is omitted, not a side value.
 {const {g,p}=await make('positive',['D01-009','P01-001']);const a=g.evalBlock(p,['D01-009','P01-001'],0,'D01-009'),b=g.evalBlock(p,['D01-009','P01-001'],0,'P01-001');assert.equal(a.total,E.st('P01-001','blk'));assert.equal(b.total,E.st('D01-009','blk'));count++;}
 console.log('parameter absence live: '+count+' actual block/One Touch cases; future center, UI preview center selection, side totals, blocked boost, condition/invalidation/decline and expiry passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
