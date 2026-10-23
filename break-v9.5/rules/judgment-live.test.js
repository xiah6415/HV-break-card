'use strict';
const assert=require('node:assert/strict'),E=require('../engine'),B=require('./legacy'),C=require('./covered-tests'),T=require('./judgment-tests'),I=require('./node-inventory'),catalog=require('./data/cards.json'),runtime=require('./runtime-data.json');
async function make(mode='positive',cards=['P01-001','P01-009'],events=[]){
 const f=T.setup(catalog,catalog.cards.find(c=>c.card_no==='HV-P02-039'),mode),{k}=f;
 for(const code of [...cards,...events])k.addCard('HV-'+code,1,'hand');const mill=catalog.cards.find(c=>!c.profiles[0].program&&c.profiles[0].variants[0].printed.affiliation_tags.includes('梟谷'));k.addCard(mill.card_no,1,'deck');
 const agent={async choose(g,p,r){if(r.kind==='skill')return true;if(r.kind==='event'&&p.hand.includes('P03-096'))return E.AI.choose(g,p,r);if(['parameter','target'].includes(r.kind))return E.AI.choose(g,p,r);if(r.kind==='block')return {cards,center:cards[0]};if(r.kind==='guts')return r.options.slice(0,r.need).map(o=>o.value);return r.options[0].value;}},g=new E.Game({seed:7,mode:'strict',decks:['k1014','seijoh'],agents:[agent,agent]});C.install(g,k);if(k.state.effects.length)g.sharedRulesState={version:1,fingerprint:runtime.fingerprint,next:k.state.next,effects:structuredClone(k.state.effects),receipts:[]};T.invoke(f);await g.enterCharacter(g.players[0],'attack','P02-039');
 g.finishTurn(g.players[0]);g.beginTurn(g.players[1]);k.endTurn();k.beginTurn(1,'block');g.ball={type:'attack',off:4};k.state.ball={kind:'attack',offense:4,owner:0};g.rulePhase='blk';return{g,k,p:g.players[1]};
}
(async()=>{
 let cases=0;
 for(const mode of ['positive','condition_false','invalid'])for(const defense of [6,7]){
  const one=catalog.cards.find(c=>!c.profiles[0].program&&c.profiles[0].variants[0].printed.parameters.block===1&&!['日向翔陽','月島蛍'].includes(c.profiles[0].variants[0].printed.name));
  const cards=['P01-001','P01-009',...(defense===7?[I.short(one.card_no)]:[])],{g,k,p}=await make(mode,cards);assert.equal(B.judgmentFails(g,p,'block',defense),mode==='positive'&&defense<=6);assert.equal(B.judgmentFails(g,p,'block',defense),k.judgmentFails(1,'block',defense));assert.equal(g.evalBlock(p,cards,4).ok,mode!=='positive'||defense===7,'AI does not recommend a known failed block');
  if(mode==='positive'&&defense===6)await assert.rejects(g.blockTurn(p,[]),e=>e.why?.includes('必定失敗'));else assert.equal((await g.blockTurn(p,[])).type,'block');cases++;
 }
 // QA1310: evaluate after the block Event window, allowing either direction.
 for(const delta of [1,-1]){const {g,p}=await make();if(delta<0)g.ball.off=0;g.eventLoop=async()=>g.boostParameter(p,'block','blk',delta);if(delta>0)assert.equal((await g.blockTurn(p,[])).type,'block');else await assert.rejects(g.blockTurn(p,[]),e=>e.why?.includes('必定失敗'));cases++;}
 // An Event can rescue a block already above the incoming attack but below
 // the forced-failure threshold; AI must still play it and advertise its cost.
 {const {g,p}=await make('positive',['P01-001','P01-009'],['P03-096']);const cb=g.evalBlock(p,['P01-001','P01-009'],4);assert(cb.ok&&cb.natsu);assert.equal((await g.blockTurn(p,[])).type,'block');assert(p.ev.includes('P03-096'));cases++;}
 // QA1311: actual One Touch mills its fee, jumps to draw, and bypasses judgment.
 {const {g,p}=await make('positive',['P01-051']);const def=catalog.cards.find(c=>!c.profiles[0].program&&c.profiles[0].variants[0].printed.affiliation_tags.includes('梟谷'));g.receiveTurn=async()=>({type:'oneTouch',off:g.ball.off});const result=await g.blockTurn(p,[]);assert.equal(result.type,'oneTouch');assert.equal(result.off,1);assert(p.drop.includes(I.short(def.card_no)));cases++;}
 console.log('forced judgment live: '+cases+' actual blockTurn cases; AI rejection, post-Event values, all 6/7 gates and real One Touch bypass passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
