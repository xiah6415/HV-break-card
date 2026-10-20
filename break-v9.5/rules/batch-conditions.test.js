'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {fixture,runBatch}=require('./batch-smoke'),{buildHistoricalIndex:buildIndex}=require('./batch-test-index');
const {matchesPrinted}=require('./batch-fixtures');
const catalog=require('./data/cards.json'),before=JSON.stringify(catalog);
assert.throws(()=>matchesPrinted(catalog.cards[0].profiles[0],{unknown_fixture_filter:[]}),e=>e.code==='FIXTURE_GAP');
// Independent expected results transcribed from the frozen Japanese text, not
// calculated by the fixture generator or by walking the executable program.
// [numeric deltas, draws, recoveries, Guts paid, watch/protect/ban kind]
const expected={
 'D03-002':[['attack',2],0,0,0], 'P01-065':[['receive',6],0,0,0],
 'P02-006':[['receive',3],1,0,0], 'P02-012':[['receive',3],0,0,3],
 'P02-042':[['block',5],0,0,0], 'P02-057':[['receive',7],0,0,3],
 'P02-099':[[],0,2,0], 'P03-023':[['attack',3],0,0,0],
 'P03-026':[['block',2],0,0,0], 'P03-041':[['attack',2],0,0,0,'protect'],
 'P03-056':[[],0,1,0], 'P03-061':[['attack',3],1,0,0],
 'P03-071':[['receive',2],0,1,3], 'P03-075':[['attack',3],0,0,3],
 'P03-082':[['receive',1],1,0,0,'watch'], 'P04-006':[['attack',3],0,0,2],
 'P04-023':[['block',3],1,0,0], 'P04-030':[['attack',4],0,0,2],
 'P04-031':[[],0,1,0], 'P04-065':[['attack',4],0,0,0],
 'P04-074':[['attack',2],1,0,0], 'P04-077':[['attack',3],1,0,0],
 'P04-078':[[],1,0,0,'ban'], 'P04-084':[[['receive',1],['attack',2]],2,0,0],
 'P04-097':[[],0,0,0,'watch'], 'P04-101':[[['receive',1],['attack',1]],1,0,0],
 'PR-025':[['attack',2],0,0,3], 'PR-044':[['attack',3],1,0,0],
 'PR-078':[[],0,1,0],
};
const cases=[];
function setup(no,phase,player=0,max=true){
 const card=catalog.cards.find(c=>c.card_no==='HV-'+no),p=card.profiles[0];
 phase ||= p.activation.activation_phases[0]||p.activation.trigger.destination_any[0];
 const f=fixture(card,p,phase,{conditioned:true,max},player);
 return {...f,p,phase,player,act:()=>p.activation.skill_type==='event'?f.k.playEvent(f.id):p.activation.skill_type==='active'?f.k.useSkill(f.id):f.k.enter(f.id,phase,{reason:f.entryReason})};
}
const numeric=k=>k.state.effects.filter(e=>e.kind==='numeric');
function check(label,fn){fn();cases.push(label);}
function moveToDeck(k,id){const c=k.card(id),ids=k.state.zones[c.zone];ids.splice(ids.indexOf(id),1);c.zone=c.owner+'.deck';k.zone(c.owner,'deck').push(id);k.assertState();}
for(const [no,[pairs,draws,recoveries,guts,persistent]]of Object.entries(expected)){
 const p=catalog.cards.find(c=>c.card_no==='HV-'+no).profiles[0];
 const phases=p.activation.skill_type==='passive'?p.activation.trigger.destination_any:p.activation.activation_phases;
 for(const phase of phases)for(const player of [0,1])check(no+':'+phase+':player'+player,()=>{
  const {k,id,act}=setup(no,phase,player),before=k.snapshot();act();
  const delta=numeric(k).map(e=>[e.parameter,e.value]),wanted=pairs.length&&!Array.isArray(pairs[0])?[pairs]:pairs;
  assert.deepEqual(delta,wanted,no+' numeric results');
  for(const e of numeric(k)){assert(k.current(e.target));const sum=numeric(k).filter(x=>x.target.id===e.target.id&&x.parameter===e.parameter).reduce((v,x)=>v+x.value,0);assert.equal(k.parameter(e.target.id,e.parameter),before.cards[e.target.id].printed.parameters[e.parameter]+sum);}
  const additions=k.state.events.slice(before.events.length).filter(e=>e.type==='hand_added');
  assert.equal(additions.filter(e=>e.operation==='draw').length,draws,no+' draw count');
  assert.equal(additions.filter(e=>e.operation==='add_hand').length,recoveries,no+' recovery count');
  const paid=Object.values(k.state.cards).filter(c=>before.cards[c.id].zone===player+'.'+phase&&c.zone===player+'.drop');assert.equal(paid.length,guts,no+' exact Guts');
  if(persistent)assert.equal(k.state.effects.filter(e=>e.kind===persistent).length,1);
  if(no==='P04-084'||no==='P04-101')assert.deepEqual(numeric(k)[0].target,numeric(k)[1].target,'later bonus stays on the selected physical target');
  if(no==='P02-099'){assert.equal(new Set(additions.map(e=>e.card)).size,2);assert.equal(k.card(additions[0].card).printed.name,'大将優');assert(k.card(additions[1].card).printed.affiliation_tags.includes('戸美'));assert.equal(before.cards[additions[1].card].zone,player+'.receive');}
  if(no==='PR-078'){const recovered=additions[0].card;assert(k.card(recovered).printed.year_tags.includes(1));assert.equal(before.cards[recovered].zone,player+'.receive');assert.notEqual(before.zones[player+'.receive'].at(-1),recovered,'recover Guts, not court top');}
  if(no==='P03-056'||no==='P04-031')assert.equal(k.card(id).zone,player+'.drop','exact source paid as formal declaration cost');
  if(no==='D03-002'){const bottom=k.zone(player,'deck')[0];assert.equal(before.cards[bottom].zone,player+'.hand');}
  if(no==='P04-074'){const moved=Object.values(k.state.cards).find(c=>before.cards[c.id].zone===player+'.hand'&&c.zone===player+'.event');assert.equal(moved.printed.type,'character');assert(moved.printed.position_tags.includes('ボール拾い'));assert.equal(k.state.events.filter(e=>e.type==='event_play').length,0);}
  if(no==='PR-025'){assert.equal(k.zone(1-player,'drop').length,1);assert(k.state.decisions.some(d=>d.request.player===1-player));}
  k.assertState();
 });
}
// Shared negative boundaries: the primary condition must stop costs and benefit.
for(const no of ['D03-002','P03-075','P04-030','P04-065','PR-025'])check(no+' wrong named setter',()=>{const f=setup(no);f.k.addCard('HV-P01-001',0,'toss');f.act();assert.equal(numeric(f.k).length,0);assert.equal(f.k.zone(0,'drop').length,0);});
for(const no of ['P01-065','P02-006','P02-042','P04-031','P04-078'])check(no+' below Event threshold',()=>{
 const f=setup(no),owner=no==='P04-078'?0:1;moveToDeck(f.k,f.k.zone(owner,'event').at(-1));f.act();assert.equal(numeric(f.k).length,0);assert.equal(f.k.state.effects.filter(e=>e.kind==='ban').length,0);assert.equal(f.k.state.events.filter(e=>e.type==='hand_added').length,0);
});
for(const no of ['P02-012','P03-071'])check(no+' set sum exceeds one',()=>{const f=setup(no),drop=f.k.zone(0,'drop').length;f.k.addCard('HV-P01-001',0,'sets');f.act();assert.equal(numeric(f.k).length,0);assert.equal(f.k.zone(0,'drop').length,drop);});
check('P02-057 opponent hand over threshold',()=>{const f=setup('P02-057');f.k.addCard('HV-P01-001',1);f.act();assert.equal(numeric(f.k).length,0);assert.equal(f.k.zone(0,'drop').length,0);});
check('P03-041 normal hand entry does not count as skill entry',()=>{const f=setup('P03-041');f.k.enter(f.id,'attack');assert.equal(f.k.state.effects.length,0);});
for(const no of ['P03-023','P03-082','P04-097','P04-101'])check(no+' one off-team court character breaks uniform condition',()=>{
 const f=setup(no),tag=f.notes[0].own_uniform_tag;
 const wrong=catalog.cards.find(c=>{const p=c.profiles[0].variants[0].printed;return p.type==='character'&&p.parameters.serve!=='dash'&&!p.affiliation_tags.includes(tag);});
 f.k.addCard(wrong.card_no,0,'serve');if(f.p.activation.skill_type==='event')assert.throws(f.act,/OPEN-EVENT-NO-CHANGE/);else f.act();assert.equal(f.k.state.effects.length,0);
});
check('P04-030 incomplete composite cost does not discard the hand payment',()=>{const f=setup('P04-030');for(const id of [...f.k.zone(0,'attack')])moveToDeck(f.k,id);const hand=f.k.zone(0,'hand').filter(id=>id!==f.id);f.act();assert.equal(numeric(f.k).length,0);assert.deepEqual(f.k.zone(0,'hand'),hand);assert.equal(f.k.zone(0,'drop').length,0);});
check('P03-041 actual protection blocks a later decrease',()=>{const f=setup('P03-041');f.act();const current=f.k.parameter(f.id,'attack');f.k.resolveProgram({kind:'numeric',operation:'add',parameter:'attack',value:-2,target:'source',target_scope:{mode:'single',binding:'reference',membership:'snapshot_on_resolution'},duration:'this_turn'},0,f.id);assert.equal(f.k.parameter(f.id,'attack'),current);});
check('P03-082 watch applies to the actual later Hyakuzawa entry',()=>{const f=setup('P03-082');f.act();f.k.advancePhase('attack');const card=catalog.cards.find(c=>{const p=c.profiles[0];return !p.program&&p.variants[0].printed.name==='百沢雄大'&&p.variants[0].printed.affiliation_tags.includes('疑似ユース');});const id=f.k.addCard(card.card_no,0);f.k.enter(id,'attack');assert.equal(f.k.parameter(id,'attack'),f.k.card(id).printed.parameters.attack+1);});
for(const nakashima of [true,false])check('P04-097 later receiver '+(nakashima?'minus3':'minus2'),()=>{
 const f=setup('P04-097');if(!nakashima){const c=catalog.cards.find(c=>{const p=c.profiles[0].variants[0].printed;return p.type==='character'&&p.affiliation_tags.includes('和久谷南')&&p.name!=='中島猛'&&p.parameters.attack!=='dash';});f.k.addCard(c.card_no,0,'attack');}
 f.act();f.k.endTurn();f.k.beginTurn(1,'receive');const recv=catalog.cards.find(c=>{const p=c.profiles[0];return !p.program&&p.variants[0].printed.parameters.receive>=5;});const id=f.k.addCard(recv.card_no,1);f.k.enter(id,'receive');assert.equal(f.k.parameter(id,'receive'),f.k.card(id).printed.parameters.receive-(nakashima?3:2));
});
check('P04-078 real next-turn permission rejects printed receive4+',()=>{const f=setup('P04-078');f.act();f.k.endTurn();f.k.beginTurn(1,'receive');const recv=catalog.cards.find(c=>{const p=c.profiles[0];return !p.program&&p.variants[0].printed.parameters.receive>=4;});const id=f.k.addCard(recv.card_no,1);assert.throws(()=>f.k.enter(id,'receive'),/Entry restriction/);assert.equal(f.k.card(id).zone,'1.hand');});
const r=runBatch({index:buildIndex(),conditioned:true});
assert.equal(r.totals.profiles,125);assert.equal(r.totals.cases,1764);assert.equal(r.totals.errors,0);assert.equal(r.totals.fixture_gaps,0);assert.equal(r.totals.initial_profiles_with_performed_skill,96);assert.equal(r.totals.profiles_with_performed_skill,125);
assert.deepEqual(r.profiles.filter(p=>!p.initial_skill_performed).map(p=>p.card_no).sort(),Object.keys(expected).map(no=>'HV-'+no).sort());
assert.equal(JSON.stringify(catalog),before);
console.log(JSON.stringify({passed:cases.length,failed:0,cases,totals:r.totals},null,2));
