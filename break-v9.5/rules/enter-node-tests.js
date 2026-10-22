'use strict';
const assert=require('node:assert/strict'),I=require('./node-inventory'),F=require('./frequent-node-tests'),{matchesPrinted}=require('./batch-fixtures');
function testEnter(catalog){
 const forms=I.forms(catalog).enter;
 for(const {node:n}of forms.values())for(const mode of ['positive','empty','decline','restricted','full_side','dash']){
  const k=F.game(catalog),source=k.addCard('HV-D01-009',0,'event'),ctx=k._context(source,0),side=n.as_side_blocker;
  const def=catalog.cards.find(c=>!c.profiles[0].program&&matchesPrinted(c.profiles[0],{type:'character',...n.pool.filters})&&c.profiles[0].variants[0].printed.parameters[n.destination]!=='dash')||catalog.cards.find(c=>matchesPrinted(c.profiles[0],{type:'character',...n.pool.filters})&&c.profiles[0].variants[0].printed.parameters[n.destination]!=='dash');
  assert(def,'Entry target '+JSON.stringify(n));
  const zone=n.pool.zone==='court.guts'?'receive':n.pool.zone.split('.')[0],target=k.addCard(def.card_no,0,zone);
  if(n.pool.zone.endsWith('.guts')){const cover=k.addCard('HV-D01-009',0,zone);k.card(cover).printed.name='Cover';}
  if(side){const c=k.addCard('HV-D01-009',0,'block');k.card(c).printed.name='Center';}
  if(mode==='empty')k._atomic(()=>k._move(target,0,'deck',ctx));
  if(mode==='restricted')k.resolveProgram({kind:'ban_action',actor:'self',action:'enter_character',scope:{role:n.destination},duration:'this_turn'},0);
  if(mode==='full_side'&&side)for(const z of ['side:0','side:1']){const c=k.addCard('HV-D01-009',0,z);k.card(c).printed.name=z;}
  if(mode==='dash')k.card(target).printed.parameters[n.destination]='dash';
  const choose=k.choose;k.choose=r=>mode==='decline'&&r.kind==='entry_count'?0:choose(r);
  const before=k.snapshot(),run=()=>{const c=k._context(source,0);const result=k._atomic(()=>{const done=k._run(n,c);k._drain();return done;});return {result,entered:c.bind.entered};};
  const result=run(),succeeds=!['empty','restricted','dash'].includes(mode)&&!(mode==='decline'&&n.count_mode==='upto')&&!(mode==='full_side'&&side);
  assert.equal(result.result,succeeds,JSON.stringify(n)+' '+mode);
  assert.equal(k.state.events.slice(before.events.length).filter(e=>e.type==='character_entry').length,succeeds?1:0);
  if(succeeds){assert.equal(k.top(0,side?'side:0':n.destination),target);assert.equal(result.entered.id,target);assert.equal(k.card(target).entryOrigin,n.pool.zone.endsWith('.guts')?'guts':n.pool.zone);assert.equal(k.card(target).entryReason,'skill');assert.equal(k.card(target).entrySkillName,k.effectiveName(source));}
  else assert.equal(result.entered,null);
  const after=k.snapshot();k.restore(before);run();assert.deepEqual(k.snapshot(),after,'Effect entry Undo');
 }
 return forms.size;
}
function sideFixture(catalog,card){
 const p=card.profiles[0],f=require('./batch-smoke').fixture(card,p,'block',{rich:true,conditioned:true,expanded:true,max:true,key:'positive'},0,catalog),{k,id}=f;
 const forbidden=[k.card(id).printed.name,'青根高伸'];const def=catalog.cards.find(c=>!c.profiles[0].program&&c.profiles[0].variants[0].printed.parameters.block!=='dash'&&!forbidden.includes(c.profiles[0].variants[0].printed.name));k.addCard(def.card_no,0,'block');return f;
}
function testSideCard(catalog,card){
 for(const mode of ['positive','center','decline']){
  const {k,id}=sideFixture(catalog,card),choose=k.choose;if(mode==='decline')k.choose=r=>r.kind==='activate_payment'?false:choose(r);
  const before=k.snapshot(),run=()=>k.enter(id,'block',{side:mode!=='center'});run();
  if(mode==='positive'){assert.equal(k.card(id).zone,'0.deck');const top=k.top(0,'side:0');assert.equal(k.effectiveName(top),'青根高伸');assert.equal(k.parameter(top,'block'),3);assert.equal(k.card(top).entryOrigin,'drop');}
  else {assert.equal(k.card(id).zone,mode==='center'?'0.block':'0.side:0');assert(!k.state.effects.slice(before.effects.length).some(e=>e.kind==='numeric'));}
  const after=k.snapshot();k.restore(before);run();assert.deepEqual(k.snapshot(),after,'Side replacement Undo '+mode);
 }
}
function seedCard(catalog,card){
 if(card.card_no==='HV-P02-037')return {...sideFixture(catalog,card),phase:'block',side:true};
 const p=card.profiles[0];if(p.activation.trigger?.event==='character_entry'){const f=require('./entry-observer-tests').setup(catalog,card);return {...f,phase:f.dest};}
 const phase=p.activation.skill_type==='passive'?p.activation.trigger.destination_any[0]:p.activation.activation_phases[0];return {...require('./batch-smoke').fixture(card,p,phase,{rich:true,conditioned:true,expanded:true,max:true,key:'positive'},0,catalog),phase};
}
function testEffectCard(catalog,card){
 for(const mode of ['positive','empty','restricted']){
  const {k,id,target,phase,side,entryReason='rule'}=seedCard(catalog,card),run=k._run,entries=[];
  k._run=function(n,c){if(n.kind!=='enter'){const before=this.state.effects.length,result=run.call(this,n,c);if(n.kind==='numeric'&&n.target==='$entered'&&!c.bind.entered)assert.equal(this.state.effects.length,before,'Missing entered target skips dependent numeric only');return result;}if(mode==='empty')for(const x of [...this.pool(n.pool,c)])this._move(x,0,'deck',c);if(mode==='restricted')this.effect('ban',{actor:0,action:'enter_character',scope:{role:n.destination}},c);const result=run.call(this,n,c);entries.push({result,ref:c.bind.entered});return result;};
  const before=k.snapshot(),invoke=()=>target?k.enter(target,phase):card.profiles[0].activation.skill_type==='event'?k.playEvent(id):card.profiles[0].activation.skill_type==='active'?k.useSkill(id):k.enter(id,phase,{side,reason:entryReason});invoke();
  assert(entries.length,card.card_no+' reached actual effect entry');
  if(mode==='positive')assert(entries.some(e=>e.result&&e.ref),card.card_no+' must actually enter a character');
  else {assert(entries.every(e=>!e.result&&e.ref===null),card.card_no+' no illegal fallback target');assert(k.state.effects.every(e=>e.kind!=='numeric'||e.target),'No fallback numeric target');}
  const after=k.snapshot();k.restore(before);entries.length=0;invoke();assert.deepEqual(k.snapshot(),after,'Composition entry Undo '+card.card_no+' '+mode);
 }
}
module.exports={testEnter,sideFixture,testSideCard,seedCard,testEffectCard};
if(require.main===module)console.log('enter: '+testEnter(require('./data/cards.json'))+' forms; origins, bindings, restriction/empty/optional/side slots and Undo passed');
