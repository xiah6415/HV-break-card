/* Lightweight per-card composition checks on the persistent kernel, three cases. */
'use strict';
const assert=require('node:assert/strict'),{fixture}=require('./batch-smoke'),I=require('./node-inventory');
function testCard(catalog,card){
 const p=card.profiles[0],all=I.nodes(p),condition=all.find(n=>n.kind==='conditional')?.condition,cost=all.some(n=>n.kind==='pay_guts');
 const phase=p.activation.skill_type==='passive'?p.activation.trigger.destination_any[0]:p.activation.activation_phases[0];
 const variants=[{key:'positive',max:true},{key:condition?'condition_false':'decline',max:!!condition,...(condition?{focus:{node_id:condition.node_id,value:false}}:{})},{key:cost?'cost_short':'no_add',max:true}];
 for(const s of variants){
  const scenario={...s,rich:true,conditioned:true,expanded:true};
  const {k,id,entryReason='rule'}=fixture(card,p,phase,scenario,0,catalog);
  if(s.key==='cost_short')for(const area of ['serve','block','receive','toss','attack','side:0','side:1']){
   const ids=k.zone(0,area);for(const paid of ids.slice(0,p.activation.skill_type==='passive'&&area===phase?ids.length:-1)){ids.splice(ids.indexOf(paid),1);k.card(paid).zone='0.drop';k.zone(0,'drop').push(paid);}
  }
  if(s.key==='no_add')k.resolveProgram({kind:'ban_action',action:'add_hand',actor:'self',scope:{},duration:'this_turn'},0);
  const before=k.snapshot(),predicates=[],oldPredicate=k._predicate;
  k._predicate=function(n,c){const value=oldPredicate.call(this,n,c);if(n===condition)predicates.push(value);return value;};
  function invoke(){return p.activation.skill_type==='event'?k.playEvent(id):p.activation.skill_type==='active'?k.useSkill(id):k.enter(id,phase,{reason:entryReason});}
  let rejected=false;
  try{invoke();}catch(e){if(e.message!=='OPEN-EVENT-NO-CHANGE')throw e;rejected=true;assert.deepEqual(k.snapshot(),before);}
  const after=k.snapshot();
  if(s.key==='positive'){
   assert(!rejected,'Positive fixture must execute '+card.card_no);
   if(condition)assert(predicates.includes(true),'Positive condition not reached '+card.card_no);
   assert(after.effects.length>before.effects.length||after.events.some((e,i)=>i>=before.events.length&&e.type==='hand_added')||after.publicLog.some((e,i)=>i>=before.publicLog.length&&e.type==='deck_view'),'Positive fixture produced no skill effect '+card.card_no);
  }
  if(s.key==='condition_false')assert(predicates.includes(false)&&!predicates.includes(true),'Negative condition not reached or unexpectedly true '+card.card_no);
  if(s.key==='cost_short')assert(!after.decisions.slice(before.decisions.length).some(d=>d.request.kind==='activate_payment'),'Insufficient cost offered payment '+card.card_no);
  k.assertState();k.restore(before);predicates.length=0;
  try{invoke();}catch(e){if(e.message!=='OPEN-EVENT-NO-CHANGE')throw e;}
  assert.deepEqual(k.snapshot(),after,'Local Undo/replay '+card.card_no+' '+s.key);
 }
}
module.exports={testCard};
