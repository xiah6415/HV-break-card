'use strict';
const assert=require('node:assert/strict'),F=require('./frequent-node-tests'),I=require('./node-inventory'),{matchesPrinted}=require('./batch-fixtures');
function setup(catalog,card,mode='positive'){
 const k=F.game(catalog),p=card.profiles[0],t=p.activation.trigger,dest=t.source_role;
 k.state.turn.phase=dest;k.state.ball={kind:'attack',offense:8,owner:1};
 const id=k.addCard(card.card_no,0,dest);
 const candidates=catalog.cards.filter(c=>c.profiles.length===1&&!c.profiles[0].program&&c.type==='character'&&Number.isInteger(c.profiles[0].variants[0].printed.parameters[dest]));
 const candidate=candidates.find(c=>matchesPrinted(c.profiles[0],t.filters)===(mode!=='mismatch'));
 assert(candidate,'Printed coverage entrant '+card.card_no+' '+mode);
 const target=k.addCard(candidate.card_no,0,'hand');
 const hand=catalog.cards.find(c=>!c.profiles[0].program&&c.profiles[0].variants[0].printed.affiliation_tags.includes('音駒'));
 if(mode!=='short')k.addCard(hand.card_no,0,'hand');
 for(let i=0;i<6;i++)k.addCard('HV-D01-009',0,'deck');
 if(mode==='wrong_role')k._move(id,0,'serve',k._context(id,0));
 if(mode==='decline'){const choose=k.choose;k.choose=r=>r.kind==='activate_payment'?false:choose(r);}
 return {k,id,target,dest,p};
}
function testCoveredCard(catalog,card){
 for(const mode of ['positive','mismatch','decline','short']){
  const {k,id,target,dest,p}=setup(catalog,card,mode),before=k.snapshot();
  k.enter(target,dest);const after=k.snapshot(),jobs=after.events.slice(before.events.length).filter(e=>e.type==='resolve_trigger');
  assert.equal(jobs.length,mode==='mismatch'?0:1,card.card_no+' '+mode+' trigger');
  const bonus=after.effects.slice(before.effects.length);
  const cost=I.dependencies(card).includes('payment_branch');
  const pays=mode==='positive'||mode==='short'&&card.card_no==='HV-P01-023';
  if(mode==='mismatch'||cost&&!pays)assert.equal(bonus.length,0,card.card_no+' '+mode+' no skill bonus');
  else assert(bonus.length>0,card.card_no+' '+mode+' effect');
  if(card.card_no==='HV-P01-023'&&pays){assert.equal(k.card(id).zone,'0.drop');assert.equal(k.parameter(target,'receive'),k.card(target).printed.parameters.receive+2);}
  if(['HV-P01-028','HV-P01-047'].includes(card.card_no)&&pays)assert.equal(k.parameter(target,'attack'),k.card(target).printed.parameters.attack+1);
  if(mode==='short'&&['HV-P01-028','HV-P01-047'].includes(card.card_no))assert(!after.decisions.slice(before.decisions.length).some(d=>d.request.kind==='activate_payment'));
  k.restore(before);k.enter(target,dest);assert.deepEqual(k.snapshot(),after,'Covered local replay '+card.card_no+' '+mode);
 }
 const {k,target,dest}=setup(catalog,card,'wrong_role');k.enter(target,dest);assert(!k.state.events.some(e=>e.type==='resolve_trigger'),'Only the stated pre-coverage role triggers');
}
module.exports={setup,testCoveredCard};
function chain(catalog,code,entrant,ownFirst=true){
 const card=catalog.cards.find(c=>c.card_no==='HV-'+code),f=setup(catalog,card),{k,id,dest}=f;
 k._move(f.target,0,'deck',k._context(id,0));
 // Real printed entry skills pay two (or three) Guts, including the covered card.
 const count=entrant==='P04-046'?3:2;
 for(let i=0;i<count-1;i++){const x=k.addCard('HV-D01-009',0,dest),stack=k.zone(0,dest);stack.unshift(stack.pop());}
 const target=k.addCard('HV-'+entrant,0,'hand');k.addCard('HV-D01-009',1,'attack');
 const choose=k.choose;k.choose=r=>r.kind==='trigger_order'?r.options.find(qid=>k.state.queue.find(q=>q.id===qid).source.id===(ownFirst?target:id)):choose(r);
 return {...f,target,entrant,ownFirst};
}
module.exports.chain=chain;
function install(g,k){
 const s=k.snapshot();
 for(const p of g.players){for(const[h,z]of Object.entries({hand:'hand',deck:'deck',drop:'drop',ev:'event',sets:'sets'}))p[h]=s.zones[p.idx+'.'+z].map(id=>I.short(s.cards[id].cardNo));for(const z of Object.keys(p.area))p.area[z]=s.zones[p.idx+'.'+z].map(id=>I.short(s.cards[id].cardNo));}
 g.cardState=null;g.beginTurn(g.players[0]);for(const p of g.players)p.ts.sides=[...s.zones[p.idx+'.side:0'],...s.zones[p.idx+'.side:1']].map(id=>I.short(s.cards[id].cardNo));
 g.rulePhase={serve:'srv',receive:'rcv',toss:'tos',attack:'atk',block:'blk'}[s.turn.phase];g.ball={type:s.ball.kind,off:s.ball.offense};
}
module.exports.install=install;
