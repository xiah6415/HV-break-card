'use strict';
const assert=require('node:assert/strict'),F=require('./frequent-node-tests'),I=require('./node-inventory'),{fixture}=require('./batch-smoke');
function testModes(catalog){
 const forms=I.forms(catalog).choose_modes;
 for(const {node:n}of forms.values()){
  assert.equal(n.count,1);assert.equal(n.required,true);const k=F.game(catalog),source=k.addCard('HV-D01-009',0,'attack'),ctx=k._context(source,0);
  const mode={kind:'choose_modes',count:1,required:true,options:[{kind:'numeric',target_scope:{mode:'single',binding:'reference',membership:'snapshot_on_resolution'},target:{kind:'selector',actor:'self',zone:'court',filters:{names:['Absent']}},parameter:'receive',operation:'add',value:1},{kind:'draw',actor:'self',count:1,count_mode:'exact',bind:'drawn'}]};
  k.preflight(mode);let asks=0;k.choose=r=>{asks++;assert.equal(r.kind,'mode');assert.deepEqual(r.options,[1]);assert.equal(r.effectModes,true);assert(r.modeLabels[1].includes('抽1張'));return 1;};
  assert.equal(k.resolveProgram(mode,0,source),false);assert.equal(asks,0);const card=k.addCard('HV-D01-009',0,'deck'),saved=k.snapshot();assert(k._modeAvailable(mode.options[1],ctx));assert.deepEqual(k.snapshot(),saved,'Availability must be pure');assert(k.resolveProgram(mode,0,source));assert.deepEqual(k.zone(0,'hand'),[card]);assert.equal(asks,1);
  k.restore(saved);k.choose=()=>0;assert.throws(()=>k.resolveProgram(mode,0,source),/Invalid mode/);assert.deepEqual(k.snapshot(),saved,'Invalid mode answers roll back');
  for(const mutate of [n=>n.count=2,n=>n.required=false,n=>n.options=[],n=>n.options=null]){const bad=structuredClone(n);mutate(bad);assert.throws(()=>k.preflight(bad),/mode parameters/);}
 }
 return forms.size;
}
function testModeCard(catalog,card){
 const p=card.profiles[0],phases=p.activation.skill_type==='passive'?p.activation.trigger.destination_any:p.activation.activation_phases;
 for(const variant of [0,1,2]){
  const phase=phases[variant===1?phases.length-1:0],{k,id}=fixture(card,p,phase,{rich:true,conditioned:true,expanded:true,max:true,key:'positive'},0,catalog),choose=k.choose;
  let modes=0;k.choose=r=>{if(r.effectModes){modes++;return variant===0?r.options[0]:r.options.at(-1);}if(variant===2&&r.kind==='activate_payment')return false;return choose(r);};
  if(variant===2){for(const x of [...k.zone(0,'deck')])k._move(x,0,'drop',k._context(id,0));}
  const before=k.snapshot(),invoke=()=>p.activation.skill_type==='event'?k.playEvent(id):p.activation.skill_type==='active'?k.useSkill(id):k.enter(id,phase);
  try{invoke();}catch(e){if(e.message!=='OPEN-EVENT-NO-CHANGE')throw e;assert.deepEqual(k.snapshot(),before);}
  if(variant<2)assert(modes>0,card.card_no+' must offer a real mode');
  const after=k.snapshot();k.restore(before);try{invoke();}catch(e){if(e.message!=='OPEN-EVENT-NO-CHANGE')throw e;}assert.deepEqual(k.snapshot(),after,card.card_no+' mode replay');k.assertState();
 }
}
module.exports={testModes,testModeCard};
