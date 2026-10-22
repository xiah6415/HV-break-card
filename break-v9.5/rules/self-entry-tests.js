'use strict';
const assert=require('node:assert/strict'),I=require('./node-inventory'),F=require('./frequent-node-tests');
const plain=(k,p,z)=>k.addCard('HV-D01-009',p,z);
const codes=['P03-011','P03-044','P04-022','P04-038','D02-004'];
function setup(catalog,card,mode='positive'){
 const p=card.profiles[0],active=p.activation.skill_type==='active';
 const f=active?require('./formal-node-tests').seedCard(catalog,card):require('./entry-observer-tests').setup(catalog,card,mode==='wrong_role'?'wrong_role':mode==='short'&&I.dependencies(card).includes('pay_guts')?'short':'positive');
 const{k,id}=f;f.phase=active?'receive':f.dest;
 if(mode==='short'&&!I.dependencies(card).includes('pay_guts'))for(const x of [...k.zone(0,'hand')])if(x!==f.target)k._atomic(()=>k._move(x,0,'deck',k._context(id,0)));
 if(mode==='negative'&&active)for(const x of [...k.zone(0,'event')])k._atomic(()=>k._move(x,0,'deck',k._context(id,0)));
 if(mode==='restricted')k.resolveProgram({kind:'ban_action',actor:'self',action:'enter_character',scope:{origins:['skill']},duration:'this_turn'},0,id);
 if(mode==='full_side')for(const z of ['side:0','side:1']){const x=k.addCard('HV-D01-009',0,z);k.card(x).printed.name=z;}
 if(mode==='decline'){const choose=k.choose;k.choose=r=>r.kind==='activate_payment'?false:choose(r);}
 return f;
}
function invoke(f){return f.target?f.k.enter(f.target,f.dest):f.k.useSkill(f.id);}
function testEnterSelf(catalog){
 const forms=I.forms(catalog).enter_self;
 for(const{node}of forms.values())for(const mode of ['positive','restricted','dash','same_name','full_side','stale']){
  const k=F.game(catalog),id=plain(k,0,node.destination==='receive'?'drop':'receive'),ctx=k._context(id,0);
  k.card(id).printed.name='Self';if(node.as_side_blocker){const c=plain(k,0,'block');k.card(c).printed.name=mode==='same_name'?'Self':'Center';}
  if(mode==='same_name'&&node.destination==='attack'){const x=plain(k,0,'toss');k.card(x).printed.name='Self';}
  if(mode==='restricted')k.resolveProgram({kind:'ban_action',actor:'self',action:'enter_character',scope:{origins:['skill']},duration:'this_turn'},0,id);
  if(mode==='dash')k.card(id).printed.parameters[node.destination]='dash';
  if(mode==='full_side'&&node.as_side_blocker)for(const z of ['side:0','side:1']){const x=plain(k,0,z);k.card(x).printed.name=z;}
  if(mode==='stale')k.card(id).incarnation++;
  const before=k.snapshot(),yes=!['restricted','dash','stale'].includes(mode)&&!(mode==='same_name'&&node.destination!=='receive')&&!(mode==='full_side'&&node.as_side_blocker),run=()=>{const c=structuredClone(ctx);return k._atomic(()=>{const done=k._run(node,c);assert.equal(done,yes);if(done){assert.deepEqual(c.source,k.reference(id));assert.deepEqual(c.bind.entered,k.reference(id));}else assert.equal(c.bind.entered,null);return done;});};
  k.preflight(node);run();const after=k.snapshot();assert.equal(k.state.events.slice(before.events.length).filter(e=>e.type==='character_entry').length,yes?1:0);if(yes)assert.equal(k.card(id).zone,'0.'+(node.as_side_blocker?'side:0':node.destination));k.restore(before);run();assert.deepEqual(k.snapshot(),after,'Self entry replay '+mode);
  for(const bad of [{destination:'deck'},{as_side_blocker:!node.as_side_blocker},{bind:'other'}])assert.throws(()=>k.preflight({...node,...bad}),/self entry parameters/);
 }
 return forms.size;
}
function testSelfCard(catalog,card){
 const active=card.profiles[0].activation.skill_type==='active',node=I.nodes(card.profiles[0]).find(n=>n.kind==='enter_self');
 for(const mode of active?['positive','negative','restricted']:['positive','wrong_role','short','decline','restricted',...(node.as_side_blocker?['full_side']:[])]){
  const f=setup(catalog,card,mode),{k,id}=f,before=k.snapshot();invoke(f);const after=k.snapshot();
  const entered=after.events.slice(before.events.length).filter(e=>e.type==='character_entry'&&e.card===id);
  assert.equal(entered.length,mode==='positive'?1:0,card.card_no+' '+mode+' self entry');
  if(mode==='positive'){
   assert.equal(k.card(id).zone,'0.'+(node.as_side_blocker?'side:0':node.destination));assert.equal(k.card(id).entryReason,'skill');
   if(card.card_no==='HV-P03-011')assert.equal(k.parameter(id,'receive'),7,'QA1758: declaration drop then re-entry receives +4');
   if(card.card_no==='HV-P04-022')assert.equal(k.parameter(id,'attack'),k.card(id).printed.parameters.attack+3);
   if(card.card_no==='HV-P04-038')assert.equal(k.parameter(f.target,'block'),k.card(f.target).printed.parameters.block+2);
  }
  if(['short','wrong_role'].includes(mode))assert(!after.decisions.slice(before.decisions.length).some(d=>d.request.kind==='activate_payment'),card.card_no+' cannot pay missing resources / trigger');
  if(mode==='decline')assert.equal(k.zone(0,'drop').length,before.zones['0.drop'].length);
  // QA1113/1876 permit the cost even when entry is forbidden; the rest of
  // the effect still resolves. AI is warned only if no useful effect remains.
  if(mode==='restricted'&&!active)assert(k.zone(0,'drop').length>before.zones['0.drop'].length,'Human may pay a legal cost despite entry ban');
  k.restore(before);invoke(f);assert.deepEqual(k.snapshot(),after,'Self entry Undo '+card.card_no+' '+mode);
 }
}
module.exports={codes,setup,invoke,testEnterSelf,testSelfCard};
