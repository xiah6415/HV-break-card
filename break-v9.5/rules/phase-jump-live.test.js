'use strict';
const assert=require('node:assert/strict'),E=require('../engine'),T=require('./phase-jump-tests'),C=require('./covered-tests'),catalog=require('./data/cards.json');
(async()=>{let n=0;
 for(const code of ['P01-037','P03-030'])for(const mode of ['positive','threshold','decline','short',...(code==='P03-030'?['school']:[])]){
  const card=catalog.cards.find(c=>c.card_no==='HV-'+code),{k,id}=T.setup(catalog,card,mode),jump=mode==='positive'||['short','decline'].includes(mode)&&code==='P03-030',stop=new Error('DRAW_COMPLETE'),seen=[];
  const agent={wantsAck:true,async choose(g,p,r){seen.push(r.kind);if(r.kind==='receiver')throw stop;if(r.kind==='skill')return mode!=='decline';if(r.kind==='guts')return r.options.slice(0,r.need).map(o=>o.value);if(r.kind==='event')return null;return r.options[0].value;}},g=new E.Game({seed:7,mode:'strict',decks:['k1014','seijoh'],agents:[agent,agent]});C.install(g,k);const p=g.players[0],turn=g.turnNo,ball=JSON.stringify(g.ball),deck=p.deck.length;
  if(jump){await assert.rejects(g.blockTurn(p,[g.evalBlock(p,[code],8)]),e=>e===stop);assert.equal(seen.filter(x=>x==='ack').length,1);assert.equal(p.deck.length,deck-1);assert.equal(p.hand.length,1);assert.equal(g.turnNo,turn);assert.equal(JSON.stringify(g.ball),ball);assert.equal(g.rulePhase,'rcv');assert.equal(p.ts.sides.length,0);assert.equal(g.sharedRulesState.effects.filter(e=>e.kind==='watch').length,1);}
  else{await assert.rejects(g.blockTurn(p,[g.evalBlock(p,[code],8)]),e=>String(e.why||e.message).includes('攔網'));assert(!seen.includes('ack'));assert.equal(p.deck.length,deck);}
  n++;
 }
 console.log('phase-jump live: '+n+' actual blockTurn paths; draw exactly once, no failed-block Loss on jump, same turn/ball, side cleanup and negative cases passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
