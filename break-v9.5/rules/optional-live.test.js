'use strict';
const assert=require('node:assert/strict'),E=require('../engine'),B=require('./legacy'),F=require('./frequent-node-tests'),catalog=require('./data/cards.json');
(async()=>{
 for(const choice of ['accept','decline','empty']){
  const asks=[],agent={async choose(g,p,r){asks.push({actor:p.idx,kind:r.kind,prompt:r.prompt});assert.equal(p.idx,1,'Opponent owns both optional and hand-card choices');if(r.kind==='skill')return choice==='accept';return r.options[0].value;}};
  const g=new E.Game({seed:7,mode:'strict',decks:['k1014','seijoh'],agents:[agent,agent]}),[p,q]=g.players;
  for(const x of g.players){x.hand=[];x.ev=[];x.drop=[];x.deck=['D01-009','D01-009','D01-009'];for(const z of Object.keys(x.area))x.area[z]=[];}p.area.serve=['D01-009'];p.hand=['P02-004','BP-013'];if(choice!=='empty')q.hand=['BP-013'];g.cardState=null;g.beginTurn(p);g.setRulePhase('srv');
  await g.enterCharacter(p,'serve','P02-004');assert(p.hand.includes('BP-013'),'Own Event cannot be selected');assert.equal(asks.some(r=>r.kind==='skill'),choice!=='empty');assert.equal(q.ev.length,choice==='accept'?1:0);assert.equal(q.deck.length,3,'Placing Event does not play its skill');assert.equal(g.sharedRulesState.effects.filter(e=>e.kind==='watch').length,choice==='accept'?0:1);
  g.beginTurn(q);const own=p.hand.length;g.draw(q);await B.flushHostEvents(g);assert.equal(p.hand.length,own+(choice==='accept'?0:1),'Next-turn rule draw triggers own draw only when Event was not placed');
  g.beginTurn(p);g.beginTurn(q);const expired=p.hand.length;g.draw(q);await B.flushHostEvents(g);assert.equal(p.hand.length,expired,'Generated watch expires after its specified turn');
 }
 for(const variant of ['accept','decline','short']){
  let asked=0;const agent={async choose(g,p,r){asked++;assert.equal(p.idx,0);if(r.kind==='skill'){assert(r.prompt.includes('2張'));return variant==='accept';}return r.options[0].value;}};
  const g=new E.Game({seed:7,mode:'strict',decks:['k1014','seijoh'],agents:[agent,agent]}),p=g.players[0];p.hand=['P02-064',...Array(variant==='short'?1:2).fill('D01-009')];p.drop=[];p.ev=[];for(const z of Object.keys(p.area))p.area[z]=[];g.cardState=null;g.beginTurn(p);g.setRulePhase('atk');await g.enterCharacter(p,'attack','P02-064');assert.equal(p.drop.length,variant==='accept'?2:0);assert.equal(asked>0,variant!=='short');for(const param of ['srv','blk','rcv','tos','atk'])if(E.st('P02-064',param)!=null)assert.equal(g.parameter(p,'attack',param),variant==='accept'?E.st('P02-064',param):0);
 }
 // Shared baseline optional branch still labels the actual blocker quota.
 const card=catalog.cards.find(c=>c.card_no==='HV-P01-003'),p0=card.profiles[0],f=require('./batch-smoke').fixture(card,p0,'attack',{rich:true,conditioned:true,expanded:true,max:true,key:'positive'},0,catalog);let found=false;const choose=f.k.choose;f.k.choose=r=>{if(r.kind==='optional'){assert(r.effectDescription.includes('最多登場2名攔網'));found=true;}return choose(r);};f.k.enter(f.id,'attack');assert(found);
 console.log('optional live: opponent choices, actual Event placement without play, empty-hand fallback, next-turn draw/expiry, complete two-card discard and zero fallback passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
