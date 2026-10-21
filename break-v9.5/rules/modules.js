/* Completed effect modules: discover dependent scripts, test them, release together. */
'use strict';
const assert=require('node:assert/strict');
const {Kernel}=require('./core');
const rules=require('./data/shared-rules.json').rules.map(r=>r.id);
const short=n=>n.startsWith('HV-')?n.slice(3):n.startsWith('HVBP-')?n.slice(2):n;

// This module composes the existing timing, selector, physical-card movement and
// hand-permission implementations. No card numbers or school names in dispatch.
const schoolRetrieve={
 id:'retrieve.school-character',
 accepts(card,p){
  const a=p.activation,n=p.program?.steps?.[0],f=n?.pool?.filters;
  return card.profiles.length===1&&!card.skill_text_variant_conflict&&!p.flags?.length&&
   !p.formal_cost&&!p.limit&&a?.skill_type==='event'&&
   JSON.stringify(a.source_zones)==='["hand"]'&&
   JSON.stringify(a.activation_phases)==='["draw","receive"]'&&
   p.program.kind==='sequence'&&p.program.steps.length===1&&n.kind==='retrieve'&&
   n.pool.kind==='selector'&&n.pool.actor==='self'&&n.pool.zone==='drop'&&
   f?.type==='character'&&Array.isArray(f.tags)&&f.tags.length===1&&
   Object.keys(f).every(k=>['type','tags'].includes(k))&&
   n.destination==='self.hand'&&n.count===1&&n.count_mode==='exact'&&!n.group_constraints;
 },
 test(catalog,card,p){
  const tag=p.program.steps[0].pool.filters.tags[0];
  const find=predicate=>{const c=catalog.cards.find(c=>predicate(c.profiles[0].variants[0].printed));assert(c,'Missing module test card');return c.card_no;};
  const eligible=find(v=>v.type==='character'&&v.affiliation_tags.includes(tag));
  const other=find(v=>v.type==='character'&&!v.affiliation_tags.includes(tag));
  function setup(phase='draw'){
   const k=new Kernel({catalog,ruleIds:rules,fingerprint:'module-tests',mode:'sandbox',choose:r=>{
    assert.equal(r.kind,'move_cards');return r.options.slice(0,r.count);
   }});
   k.state.turn.phase=phase;
   const source=k.addCard(card.card_no,0,'hand');
   const wrong=k.addCard(other,0,'drop'),wrongType=k.addCard(card.card_no,0,'drop');
   const opponent=k.addCard(eligible,1,'drop');
   return {k,source,wrong,wrongType,opponent};
  }
  // 1. Printed-school character only; both printed windows, exact physical copy,
  // local Undo restores everything and redoing produces the same result.
  for(const phase of p.activation.activation_phases){
   const {k,source,wrong,wrongType,opponent}=setup(phase);
   const target=k.addCard(eligible,0,'drop'),extra=k.addCard(eligible,0,'drop');
   const before=k.snapshot();assert.equal(k.playEvent(source).performed,true);
   assert.deepEqual(k.zone(0,'hand'),[target]);
   assert.deepEqual(k.zone(0,'drop'),[wrong,wrongType,extra]);
   assert.deepEqual(k.zone(1,'drop'),[opponent]);assert.deepEqual(k.zone(0,'event'),[source]);
   const after=k.snapshot();k.restore(before);assert.deepEqual(k.snapshot(),before);
   k.playEvent(source);assert.deepEqual(k.snapshot(),after);
  }
  // 2. No matching character: reject the no-change Event atomically.
  {
   const {k,source}=setup();const before=k.snapshot();
   assert.throws(()=>k.playEvent(source),/OPEN-EVENT-NO-CHANGE/);
   assert.deepEqual(k.snapshot(),before);
  }
  // 3. A hand-addition restriction wins over retrieval, without moving anything.
  {
   const {k,source}=setup('receive');k.addCard(eligible,0,'drop');
   k.resolveProgram({kind:'ban_action',action:'add_hand',actor:'self',scope:{},duration:'this_turn'},0);
   const before=k.snapshot();assert.throws(()=>k.playEvent(source),/OPEN-EVENT-NO-CHANGE/);
   assert.deepEqual(k.snapshot(),before);
  }
 }
};
const completed=[schoolRetrieve];
function testModules(catalog){
 const cards={},modules=[];
 for(const module of completed){
  const dependents=catalog.cards.filter(c=>module.accepts(c,c.profiles[0]));
  for(const card of dependents){
   const p=card.profiles[0];module.test(catalog,card,p);
   assert(!cards[short(card.card_no)],'Duplicate module release');
   cards[short(card.card_no)]={profileId:p.profile_id,module:module.id};
  }
  modules.push({id:module.id,cards:dependents.length,cases:dependents.length*3});
 }
 return {cards,modules};
}
module.exports={completed,testModules};
if(require.main===module){
 const fs=require('node:fs');const input=fs.readFileSync(0,'utf8');
 process.stdout.write(JSON.stringify(testModules(input?JSON.parse(input):require('./data/cards.json')))+'\n');
}
