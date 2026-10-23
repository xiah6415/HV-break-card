'use strict';
const assert=require('node:assert/strict'),I=require('./node-inventory'),F=require('./frequent-node-tests');
const codes=['P02-087','P04-058'];
function definition(catalog,name,role){return catalog.cards.find(c=>c.profiles[0].variants[0].printed.name===name&&!c.profiles[0].program&&c.profiles[0].variants[0].printed.parameters[role]!=='dash')||catalog.cards.find(c=>c.profiles[0].variants[0].printed.name===name&&c.profiles[0].variants[0].printed.parameters[role]!=='dash');}
function setup(catalog,card,mode='positive'){
 const k=F.game(catalog),p=card.profiles[0],code=I.short(card.card_no),phase=code==='P02-087'?'attack':'block',id=k.addCard(card.card_no,0,'hand');k.state.turn.phase=phase;k.state.ball={kind:'attack',offense:8,owner:1};
 const group=I.nodes(p).find(n=>n.kind==='simultaneous_entry_group'),entries=[];
 if(code==='P02-087'){
  for(const [name,role]of [['宮侑','toss'],['宮治','attack']])k.addCard(definition(catalog,name,role).card_no,0,role);
  if(mode==='condition_false')k.addCard('HV-D01-009',0,'toss');
  k.addCard('HV-D01-009',0,'deck');
 }else{
  for(let i=0;i<(mode==='short'?1:2);i++)k.addCard(catalog.cards.find(c=>!c.profiles[0].program&&c.profiles[0].variants[0].printed.affiliation_tags.includes('伊達工業')&&!['鎌先靖志','笹谷武仁'].includes(c.profiles[0].variants[0].printed.name)).card_no,0,'hand');
  if(mode==='condition_false'){const x=k.addCard('HV-D01-009',0,'side:0');k.card(x).printed.name='Existing side';}
 }
 for(const [i,e]of group.entries.entries()){
  if(mode==='empty'||mode==='partial'&&i===1)continue;
  const zone=e.pool.zone==='court.guts'?['serve','receive'][i]:'drop',x=k.addCard(definition(catalog,e.pool.filters.names[0],e.destination).card_no,0,zone);entries.push(x);
  if(e.pool.zone==='court.guts'){const cover=k.addCard('HV-D01-009',0,zone);}
 }
 if(mode==='restricted')k.resolveProgram({kind:'ban_action',actor:'self',action:'enter_character',scope:{role:code==='P04-058'?'side_blocker':'toss'},duration:'this_turn'},0,id);
 k.choose=r=>r.kind==='activate_payment'?mode!=='decline':r.kind==='entry_count'&&mode==='decline'?0:F.choose(r);
 return{k,id,p,code,phase,entries,group};
}
function invoke(f){return f.p.activation.skill_type==='event'?f.k.playEvent(f.id):f.k.enter(f.id,f.phase);}
function testGroup(catalog){
 const forms=I.forms(catalog).simultaneous_entry_group;
 for(const {node:n}of forms.values())for(const mode of ['positive','empty','decline','partial','restricted']){
  const card=catalog.cards.find(c=>c.card_no==='HV-P02-087'),f=setup(catalog,card,mode),{k,id,entries}=f,ctx=k._context(id,0),before=k.snapshot();k.preflight(n);
  const emit=k._emit,seen=[];k._emit=function(e){if(e.type==='character_entry'){seen.push(e.card);if(mode==='positive')assert(entries.every(x=>this.role(x)!=='guts'),'Complete group before entry observers');}return emit.call(this,e);};
  const run=()=>k._atomic(()=>{const result=k._run(n,k._context(id,0));k._drain();return result;});
  const ok=run();assert.equal(ok,!['empty','decline'].includes(mode));assert.equal(seen.length,mode==='positive'?2:mode==='partial'||mode==='restricted'?1:0);
  const after=k.snapshot();k.restore(before);seen.length=0;run();assert.deepEqual(k.snapshot(),after,'Group replay');
  for(const bad of [{complete_group_before_triggers:false},{entries:[]},{entries:[{kind:'draw'}]}])assert.throws(()=>k.preflight({...n,...bad}),/simultaneous entry parameters/);
 }
 return forms.size;
}
function testCard(catalog,card){
 for(const mode of ['positive','condition_false','empty','partial','restricted','decline',...(I.short(card.card_no)==='P04-058'?['short']:[])]){
  const f=setup(catalog,card,mode),{k,id,entries,code}=f,before=k.snapshot();invoke(f);
  const entered=k.state.events.slice(before.events.length).filter(e=>e.type==='character_entry'&&entries.includes(e.card));
  const count=['condition_false','empty','decline','short'].includes(mode)?0:mode==='partial'||mode==='restricted'&&code==='P02-087'?1:mode==='restricted'?0:2;
  assert.equal(entered.length,count,code+' '+mode);
  if(code==='P02-087')assert.equal(k.zone(0,'hand').length,1,'Always draw first');
  else assert.equal(k.zone(0,'drop').length-before.zones['0.drop'].length, ['condition_false','decline','short'].includes(mode)?0:2-count,'QA1902: fee remains payable when entry is forbidden');
  if(count===2&&code==='P04-058')assert.equal(k.state.turn.blockEntries[0],3,'Center plus both side entrants');
  assert.equal(k.state.queue.length,0);const after=k.snapshot();k.restore(before);invoke(f);assert.deepEqual(k.snapshot(),after,code+' '+mode+' Undo');
 }
}
module.exports={codes,setup,invoke,testGroup,testCard};
