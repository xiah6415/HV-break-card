'use strict';
const assert=require('node:assert/strict'),I=require('./node-inventory'),F=require('./frequent-node-tests');
function testKeyword(catalog){
 const forms=I.forms(catalog).keyword;
 for(const {node:n}of forms.values()){
  const k=F.game(catalog),kind=n.keyword,area=['one_touch','doshat'].includes(kind)?'block':kind==='a_pass'||kind==='back_attack'?'receive':kind==='two_attack'||kind==='multi_attack'?'toss':'attack';
  k.state.turn.phase=kind==='back_attack'||kind==='multi_attack'?'attack':area;k.state.ball={owner:1,kind:'attack',offense:8};
  const source=k.addCard('HV-D01-009',0,area),ctx=k._context(source,0);k.card(source).printed.name='Source';
  const add=(p,z,name='Other')=>{const id=k.addCard('HV-D01-009',p,z);k.card(id).printed.name=name;return id;};
  if(kind==='multi_attack'){
   k.card(source).printed.affiliation_tags=[n.parameters.affiliation];const target=add(0,'attack');k.card(target).printed.affiliation_tags=[n.parameters.affiliation];
   for(const name of ['A','A','B','Source']){const id=add(0,'receive',name);k.card(id).printed.affiliation_tags=[n.parameters.affiliation];k.zone(0,'receive').unshift(k.zone(0,'receive').pop());}
   const top=add(0,'receive','Receiver');k.card(top).printed.affiliation_tags=[n.parameters.affiliation];
   const before=k.snapshot();k.choose=r=>r.count!=null?r.options.slice(0,r.count):r.options.at(-1);k.resolveProgram(n,0,source);
   assert.equal(k.zone(0,'drop').length,3);assert.equal(k.parameter(target,'attack'),k.card(target).printed.parameters.attack+2,'Distinct paid names, not copies');assert(!k.zone(0,'drop').some(id=>k.effectiveName(id)==='Source'));
   const after=k.snapshot();k.restore(before);k.resolveProgram(n,0,source);assert.deepEqual(k.snapshot(),after);k.restore(before);k.choose=()=>0;assert.equal(k.resolveProgram(n,0,source),false);assert.equal(k.zone(0,'drop').length,0);continue;
  }
  const before=k.snapshot();k.resolveProgram(n,0,source);const after=k.snapshot();k.restore(before);k.resolveProgram(n,0,source);assert.deepEqual(k.snapshot(),after,'Keyword Undo '+kind);
  if(kind==='one_touch'){assert.equal(k.state.ball.offense,8-n.N);assert.equal(k.state.turn.phase,'draw');}
  if(kind==='two_attack'){assert.equal(k.state.turn.phase,'end');assert.deepEqual(k.outgoing('attack',99),{kind:'attack',offense:n.N});}
  if(kind==='back_attack'){assert.equal(k.top(0,'attack'),source);assert.equal(k.parameter(source,'attack'),n.N);assert(k.state.events.some(e=>e.type==='character_entry'&&e.entry_keyword_family==='back_attack'));}
  if(kind==='doshat'){assert.deepEqual(k.outgoing('block',0),{kind:'block',offense:n.N});k.loss(0);k.finishLoss();assert(!k.state.effects.length);}
  if(kind==='feint'){assert.equal(k.outgoing('attack',99).offense,n.N);k.endTurn();k.beginTurn(1);for(const origin of ['rule','skill'])assert.equal(k.permission({action:'enter_character',player:1,origin,role:'center_blocker'}).allowed,false);assert(k.permission({action:'enter_character',player:1,origin:'rule',role:'receive'}).allowed);k.endTurn();assert(!k.state.effects.length);}
  if(kind==='blockout'){k.endTurn();k.beginTurn(1,'block');const id=add(1,'hand');k.card(id).printed.parameters.block=n.N;const ready=k.snapshot();k.enter(id,'block');assert.equal(k.state.forcedLoss.player,1);k.restore(ready);k.card(id).printed.parameters.block=n.N+1;k.enter(id,'block');assert.equal(k.state.forcedLoss,undefined,'Threshold uses printed block, above N stays legal');}
  if(kind==='a_pass'){k._atomic(()=>k._move(source,0,'drop',ctx));k.advancePhase('toss');const id=add(0,'hand','Setter');const value=k.card(id).printed.parameters.toss;k.enter(id,'toss');assert.equal(k.parameter(id,'toss'),value+n.N);}
 }
 // The current player's phase jump resolves before the opponent's queued Loss.
 {const k=F.game(catalog),source=k.addCard('HV-D01-009',0,'attack');k.resolveProgram({kind:'keyword',keyword:'blockout',N:2,parameters:{}},0,source);k.endTurn();k.beginTurn(1,'block');k.state.ball={kind:'attack',offense:8,owner:0};const id=k.addCard('HV-D01-009',1,'hand');k.card(id).printed.parameters.block=1;k.registerWatch({kind:'watch',event:'character_entry',actor:'self',filters:{role:'block'},duration:'this_turn',then:{kind:'keyword',keyword:'one_touch',N:2,parameters:{}}},1,id);k.enter(id,'block');assert.equal(k.state.turn.phase,'draw');assert.equal(k.state.forcedLoss,undefined);}
 // Back attack overwrites earlier modifiers, then later entry triggers apply.
 {const k=F.game(catalog),id=k.addCard('HV-D01-009',0,'receive');k.state.turn.phase='attack';const ctx=k._context(id,0);k.effect('numeric',{target:k.reference(id),parameter:'attack',operation:'add',value:9},ctx);k.resolveProgram({kind:'keyword',keyword:'back_attack',N:4,parameters:{}},0,id);assert.equal(k.parameter(id,'attack'),4);}
 return forms.size;
}
module.exports={testKeyword};
if(require.main===module)console.log('keyword: '+testKeyword(require('./data/cards.json'))+' forms / all eight families and Undo passed');
