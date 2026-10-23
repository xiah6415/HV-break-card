'use strict';
const assert=require('node:assert/strict'),I=require('./node-inventory'),F=require('./frequent-node-tests');
const codes=['P02-027'];
function setup(catalog,card,mode='positive'){
 const k=F.game(catalog),id=k.addCard(card.card_no,0,'hand'),names=new Set(),cards=[];for(const c of catalog.cards){const p=c.profiles[0].variants[0].printed;if(p.type==='character'&&p.affiliation_tags.includes('稲荷崎')&&!names.has(p.name)){names.add(p.name);cards.push(c);}}
 for(const c of cards.slice(0,mode==='condition_false'?5:6))k.addCard(c.card_no,0,'drop');
 if(mode==='condition_false'){k.addCard(cards[0].card_no,0,'drop');k.addCard('HV-P02-087',0,'drop');}
 k.state.turn.phase='attack';k.state.ball={kind:'attack',offense:8,owner:1};if(mode==='invalid')k.resolveProgram({kind:'invalidate_skill',actor:'self',selector:{roles:['attack']},duration:'this_turn'},0,id);
 k.choose=r=>r.kind==='activate_payment'?mode!=='decline':F.choose(r);return{k,id,p:card.profiles[0],phase:'attack',absent:true};
}
function invoke(f){return f.k.enter(f.id,'attack');}
function testAbsent(catalog){
 const forms=I.forms(catalog).parameter_absent;
 for(const{node}of forms.values())for(const controller of [0,1]){
  const k=F.game(catalog),id=k.addCard('HV-D01-009',controller,'event'),opponent=1-controller,old=k.addCard('HV-P01-001',opponent,'block');k.state.turn.player=controller;const before=k.snapshot();k.preflight(node);k.resolveProgram(node,controller,id);assert.equal(k.parameter(old,'block'),3,'Effect not active on creator turn');const registered=k.snapshot();k.endTurn();k.beginTurn(opponent,'block');
  assert.equal(k.parameter(old,'block'),'dash');const center=k.addCard('HV-P01-009',opponent,'hand');k.enter(center,'block');assert.equal(k.parameter(center,'block'),'dash','A new center is affected');assert.equal(k.parameter(old,'block'),3,'Covered Guts no longer have center role');
  const side=k.addCard('HV-P01-014',opponent,'hand');k.enter(side,'block',{side:true});assert.equal(k.parameter(side,'block'),3);const ctx=k._context(center,opponent);assert(!k._predicate({kind:'compare',field:'source.current_block',op:'gte',value:0},ctx));assert(!k.matches(center,{current_block_eq:3},ctx));assert.equal(k._fact('opponent.block_defense',k._context(id,controller)),3,'Absent is omitted from block aggregate');
  const numeric={kind:'numeric',target:'source',target_scope:{mode:'single',binding:'reference',membership:'snapshot_on_resolution'},parameter:'block',operation:'add',value:2,duration:'this_turn'};k.resolveProgram(numeric,opponent,center);assert.equal(k.parameter(center,'block'),'dash');
  k.endTurn();k.beginTurn(controller,'attack');assert.equal(k.parameter(center,'block'),3,'Absent expires without changing printed or stored values');k.restore(before);k.resolveProgram(node,controller,id);assert.deepEqual(k.snapshot(),registered);
  assert.throws(()=>k.preflight({...node,parameter:'receive'}),/parameter absence parameters/);
 }
 return forms.size;
}
function testCard(catalog,card){for(const mode of ['positive','condition_false','decline','invalid']){const f=setup(catalog,card,mode),{k,id}=f,before=k.snapshot();invoke(f);const yes=mode==='positive';assert.equal(k.state.effects.filter(e=>e.kind==='absent').length,yes?1:0);assert.equal(k.parameter(id,'attack'),k.card(id).printed.parameters.attack+(yes?2:0));assert.equal(k.state.decisions.filter(d=>d.request.kind==='external_action').length,yes?1:0);const after=k.snapshot();k.restore(before);invoke(f);assert.deepEqual(k.snapshot(),after,'Absent card Undo '+mode);}}
module.exports={codes,setup,invoke,testAbsent,testCard};
