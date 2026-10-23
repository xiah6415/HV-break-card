'use strict';
const assert=require('node:assert/strict'),I=require('./node-inventory'),F=require('./frequent-node-tests');
const codes=['P02-089'];
function definition(catalog,name){return catalog.cards.find(c=>c.profiles[0].variants[0].printed.name===name);}
function testSlots(catalog){
 const forms=I.forms(catalog).retrieve_slots;
 for(const{node}of forms.values())for(const controller of [0,1])for(const count of [0,1,2,3]){
  const k=F.game(catalog),id=k.addCard('HV-D01-009',controller,'event'),ids=[];for(const slot of node.slots.slice(0,count))ids.push(k.addCard(definition(catalog,slot.pool.filters.names[0]).card_no,controller,'drop'));const ctx=k._context(id,controller),before=k.snapshot();k.preflight(node);assert.equal(k._atomic(()=>k._run(node,ctx)),count>0);assert.deepEqual(ctx.bind.retrieved,ids);assert.deepEqual(k.zone(controller,'hand'),ids);assert.equal(k.state.events.slice(before.events.length).filter(e=>e.type==='hand_added').length,Math.min(count,node.slots.length));const after=k.snapshot();k.restore(before);k._atomic(()=>k._run(node,k._context(id,controller)));assert.deepEqual(k.snapshot(),after);
  for(const bad of [{distinct_instances:false},{destination:'self.drop'},{slots:[]}])assert.throws(()=>k.preflight({...node,...bad}),/retrieve slots parameters/);
 }
 // Even an overlapping same-zone pool cannot reuse a physical instance.
 const k=F.game(catalog),id=k.addCard('HV-D01-009',0,'event'),x=k.addCard('HV-D01-009',0,'hand'),slot={kind:'retrieve',pool:{kind:'selector',actor:'self',zone:'hand',filters:{}},destination:'self.hand',count:1,count_mode:'upto',bind:'retrieved'},ctx=k._context(id,0);k._atomic(()=>k._run({kind:'retrieve_slots',slots:[slot,slot],destination:'self.hand',distinct_instances:true,bind:'retrieved'},ctx));assert.deepEqual(ctx.bind.retrieved,[x]);assert.equal(k.zone(0,'hand').length,1);return forms.size;
}
function setup(catalog,card,mode='positive'){
 const k=F.game(catalog),id=k.addCard(card.card_no,0,'hand'),group=I.nodes(card.profiles[0]).find(n=>n.kind==='retrieve_slots'),ids=[];k.state.turn.phase='draw';k.state.ball={kind:'attack',offense:8,owner:1};
 const count=mode==='empty'?0:mode==='one'?1:mode==='partial'?2:3;
 for(const slot of group.slots.slice(0,count))for(let i=0;i<(mode==='copies'?2:1);i++)ids.push(k.addCard(definition(catalog,slot.pool.filters.names[0]).card_no,0,'drop'));
 const extra=mode==='extra'?k.addCard('HV-D01-009',0,'hand'):null;
 if(mode==='no_add')k.resolveProgram({kind:'ban_action',actor:'self',action:'add_hand',scope:{origins:['skill']},duration:'this_turn'},0,id);
 if(mode==='invalid')k.resolveProgram({kind:'invalidate_skill',actor:'self',selector:{type:'event',play_icons_any:['draw']},duration:'this_turn'},0,id);
 let skipped=false;k.choose=r=>{if(r.kind==='move_count'&&mode==='skip_first'&&!skipped){skipped=true;return 0;}if(r.kind==='move_cards'&&extra&&r.options.includes(extra))return [extra];return F.choose(r);};
 return{k,id,p:card.profiles[0],phase:'draw',group,ids,extra,reset:()=>{skipped=false;}};
}
function invoke(f){f.reset();return f.k.playEvent(f.id);}
function testCard(catalog,card){for(const mode of ['positive','one','partial','copies','skip_first','extra','empty','no_add','invalid']){
 const f=setup(catalog,card,mode),{k,id,ids,extra}=f,before=k.snapshot();if(['empty','no_add'].includes(mode)){assert.throws(()=>invoke(f),/OPEN-EVENT-NO-CHANGE/);assert.deepEqual(k.snapshot(),before);continue;}
 invoke(f);const count=mode==='invalid'?0:mode==='skip_first'?f.group.slots.length-1:mode==='one'?1:Math.min(mode==='partial'?2:3,f.group.slots.length),discards=I.nodes(card.profiles[0]).some(n=>n.kind==='move'&&n.destination==='owner.drop')&&count===3?1:0,added=k.state.events.slice(before.events.length).filter(e=>e.type==='hand_added'&&e.operation==='add_hand');assert.equal(added.length,count,mode+' actual added');assert.equal(new Set(added.map(e=>e.card)).size,count);assert.equal(k.zone(0,'hand').length,count-discards+(extra?1:0));if(extra)assert.equal(k.card(extra).zone,discards?'0.drop':'0.hand','May discard an existing hand card instead of a retrieved card');assert.equal(k.card(id).zone,'0.event');const after=k.snapshot();k.restore(before);invoke(f);assert.deepEqual(k.snapshot(),after,'Slot card replay '+mode);
 }}
module.exports={codes,setup,invoke,testSlots,testCard};
