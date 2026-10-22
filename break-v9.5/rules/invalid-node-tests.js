'use strict';
const assert=require('node:assert/strict'),I=require('./node-inventory'),F=require('./frequent-node-tests');
function action(s,player){return {action:s.keyword_families?'use_keyword':'use_skill',player,origin:'skill',keywordFamily:s.keyword_families?.[0],type:s.type||'character',name:s.names?.[0]||'Other',role:s.roles?.[0]==='character'?'attack':s.roles?.[0]==='block'?'center_blocker':s.roles?.[0]||'attack',phaseTags:s.phase_tags||[],sourceZone:s.source_zones?.[0]||'court',icons:s.play_icons_any||[]};}
function testInvalid(catalog){
 const forms=I.forms(catalog).invalidate_skill;
 for(const {node:n}of forms.values()){
  const k=F.game(catalog),id=k.addCard('HV-D01-009',0,'attack'),player=n.actor==='self'?0:1;k.resolveProgram(n,0,id);
  const first=action(n.selector,player);if(n.duration==='next_opponent_turn'){assert(k.permission(first).allowed);k.endTurn();k.beginTurn(1);}
  for(const selector of [n.selector,n.selector.union_with].filter(Boolean)){
   const a=action(selector,player);for(const family of selector.keyword_families||[])assert(!k.permission({...a,keywordFamily:family}).allowed);assert(!k.permission(a).allowed,JSON.stringify(n));assert(k.permission({...a,player:1-player}).allowed);
   for(const key of Object.keys(selector).filter(k=>k!=='union_with')){const b=structuredClone(a);if(key==='roles')b.role=selector.roles.includes('character')?'guts':'serve';else if(key==='names')b.name='Different name';else if(key==='phase_tags')b.phaseTags=[];else if(key==='source_zones')b.sourceZone='drop';else if(key==='type')b.type='character';else if(key==='play_icons_any')b.icons=['serve'];else if(key==='keyword_families')b.keywordFamily='a_pass';else assert.fail(key);assert(k.permission(b).allowed,'Every selector field is required: '+key);}
  }
  const before=k.snapshot();k.permission(first);assert.deepEqual(k.snapshot(),before);k.endTurn();assert(k.permission(first).allowed);k.restore(before);k.loss(k.state.turn.player);k.finishLoss();assert.equal(k.state.effects.length,0);k.restore(before);assert.deepEqual(k.snapshot(),before);
 }
 for(const family of ['one_touch','doshat'])for(const N of [1,3,5]){
  const k=F.game(catalog),id=k.addCard('HV-D01-009',0,'block');k.state.turn.phase='block';k.state.ball={owner:1,kind:'attack',offense:9};k.resolveProgram({kind:'invalidate_skill',actor:'self',selector:{keyword_families:[family]},duration:'this_turn'},0,id);const before=k.snapshot();assert.equal(k.resolveProgram({kind:'keyword',keyword:family,N,parameters:{}},0,id),false);assert.equal(k.state.ball.offense,9);assert.equal(k.state.turn.phase,'block');assert.equal(k.state.effects.length,before.effects.length);
  for(let i=0;i<2;i++){k.addCard('HV-D01-001',0,'block');const z=k.zone(0,'block');z.unshift(z.pop());}k.addCard('HV-D01-001',0,'deck');let asked=0;const choose=k.choose;k.choose=r=>{asked++;return choose(r);};
  const paid={kind:'payment_branch',payment:{kind:'pay_guts',areas:'source_area',count:1,count_mode:'exact',bind:'paid'},then:{kind:'sequence',steps:[{kind:'keyword',keyword:family,N,parameters:{}}]}};
  assert.equal(k.resolveProgram(paid,0,id),false);assert.equal(asked,0,'No payment for a wholly disabled keyword branch');assert.equal(k.zone(0,'block').length,3);
  const mixed=structuredClone(paid);mixed.then.steps.unshift({kind:'draw',actor:'self',count:1,count_mode:'exact',bind:'drawn'});assert(k.resolveProgram(mixed,0,id));assert.equal(k.zone(0,'hand').length,1);assert.equal(k.zone(0,'block').length,2);assert.equal(k.state.turn.phase,'block');assert.equal(k.state.ball.offense,9);
 }
 const k=F.game(catalog),id=k.addCard('HV-D01-009',0,'attack'),ctx=k._context(id,0);k.effect('rename',{target:k.reference(id),name:'木兎光太郎'},ctx);k.effect('numeric',{target:k.reference(id),parameter:'attack',operation:'add',value:3},ctx);const value=k.parameter(id,'attack');k.resolveProgram({kind:'invalidate_skill',actor:'self',duration:'this_turn',selector:{names:['木兎光太郎'],roles:['character']}},0,id);assert.equal(k.effectiveName(id),'木兎光太郎');assert.equal(k.parameter(id,'attack'),value);assert(!k.permission({...action({names:['木兎光太郎'],roles:['character']},0)}).allowed);
 return forms.size;
}
module.exports={testInvalid,action};
function testInvalidCard(catalog,card){
 const p=card.profiles[0],nodes=I.nodes(p),condition=nodes.find(n=>n.kind==='conditional')?.condition,n=nodes.find(n=>n.kind==='invalidate_skill'),phase=p.activation.skill_type==='passive'?p.activation.trigger.destination_any[0]:p.activation.activation_phases[0];
 for(const mode of ['positive','source_left',...(condition?['negative']:[])]){
  const focus=mode==='negative'&&condition.field!=='source.entry_skill_name'?{node_id:condition.node_id,value:false}:undefined,{k,id}=require('./batch-smoke').fixture(card,p,phase,{rich:true,conditioned:true,expanded:true,max:true,key:'positive',focus},0,catalog);
  const name=nodes.find(n=>n.kind==='compare'&&n.field==='source.entry_skill_name')?.value,source=name&&mode!=='negative'?k.addCard(catalog.cards.find(c=>c.profiles[0].variants[0].printed.name===name).card_no,0,'event'):null;
  const before=k.snapshot(),invoke=()=>{if(p.activation.skill_type==='event')k.playEvent(id);else if(source)k._atomic(()=>{k._enter(id,0,phase,k._context(source,0),'skill');k._drain();});else k.enter(id,phase);if(mode==='source_left')k._atomic(()=>k._move(id,0,'drop',k._context(id,0)));};invoke();
  const after=k.snapshot(),invalid=after.effects.slice(before.effects.length).filter(e=>e.kind==='invalid');
  const guard=nodes.find(x=>x.kind==='conditional'&&x.condition===condition),gated=guard&&n.node_id.startsWith(guard.then.node_id+'.');
  if(mode==='negative'&&gated)assert.equal(invalid.length,0,card.card_no+' no invalidation without its condition');
  else{assert.equal(invalid.length,1,card.card_no+' actual invalidation');assert.deepEqual(invalid[0].selector,n.selector);if(n.duration==='next_opponent_turn'){k.endTurn();k.beginTurn(1);}for(const s of [n.selector,n.selector.union_with].filter(Boolean))assert(!k.permission(action(s,n.actor==='self'?0:1)).allowed);}
  k.restore(before);invoke();assert.deepEqual(k.snapshot(),after,'Invalidation card Undo '+card.card_no+' '+mode);
 }
}
module.exports.testInvalidCard=testInvalidCard;
