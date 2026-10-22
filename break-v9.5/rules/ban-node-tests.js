'use strict';
const assert=require('node:assert/strict'),I=require('./node-inventory'),F=require('./frequent-node-tests');
function action(n,p){const s=n.scope;return {action:n.action,player:p,origin:s.origins?.[0]||'rule',phase:s.phases?.[0]||'receive',role:s.role==='block'?'center_blocker':s.role||'receive',entryOrigin:s.entry_origins?.[0]||'hand',entryCount:(s.max_count||0)+1,entryCounts:{hand:(s.max_count||0)+1},name:s.names?.[0]||'百沢雄大',icons:s.play_icons_any||['receive'],printed:{position_tags:s.positions||['WS'],parameters:{receive:s.printed_receive_gte||6}}};}
function testBan(catalog){
 const forms=I.forms(catalog).ban_action;
 for(const {node:n}of forms.values()){
  const k=F.game(catalog),id=k.addCard('HV-D01-009',0,'attack'),target=n.actor==='self'?0:1;k.state.turn.phase='draw';k.resolveProgram(n,0,id);const a=action(n,target),saved=k.snapshot();
  if(n.duration==='next_opponent_turn')assert(k.permission(a).allowed,'A future ban is not active yet');
  if(n.duration==='next_opponent_turn'){k.endTurn();k.beginTurn(1,'draw');}
  k.state.turn.phase=n.scope.phases?.[0]||(n.duration==='this_draw_phase'?'draw':'receive');
  assert.equal(k.permission(a).allowed,false,JSON.stringify(n));assert(k.permission({...a,player:1-target}).allowed,'Other player remains allowed');
  for(const [key,value]of Object.entries(n.scope)){
   const b=structuredClone(a);
   if(key==='role')b.role='serve';else if(key==='entry_origins')b.entryOrigin='guts';else if(key==='origins')b.origin=value.includes('rule')?'skill':'rule';else if(key==='names')b.name='Different name';else if(key==='positions')b.printed.position_tags=['Li'];else if(key==='printed_receive_gte')b.printed.parameters.receive=value-1;else if(key==='play_icons_any')b.icons=['serve'];else if(key==='phases')b.phase='attack';else if(key==='max_count'){b.entryCount=value;b.entryCounts.hand=value;}else assert.fail(key);
   if(key==='origins'&&value.length===2)continue;
   assert(k.permission(b).allowed,'Every scope term is necessary: '+key+' '+JSON.stringify(n));
  }
  if(n.scope.printed_receive_gte){const b=structuredClone(a);b.printed.parameters.receive='dash';assert(k.permission(b).allowed);}
  if(n.scope.max_count&&n.scope.entry_origins){assert(k.permission({...a,entryCount:8,entryCounts:{hand:2,guts:6}}).allowed,'Guts entries do not consume the hand quota');}
  const before=k.snapshot();k.permission(a);assert.deepEqual(k.snapshot(),before,'Permission is read-only');
  if(n.duration==='this_draw_phase'){k.advancePhase('receive');assert(k.permission(a).allowed);assert(!k.state.effects.some(e=>e.kind==='ban'));}
  else{k.endTurn();assert(k.permission(a).allowed);}
  k.restore(before);k.loss(k.state.turn.player);k.finishLoss();assert.equal(k.state.effects.length,0);k.restore(saved);assert.deepEqual(k.snapshot(),saved,'Ban snapshot replay');
 }
 return forms.size;
}
module.exports={testBan,action};
function testBanCard(catalog,card){
 const p=card.profiles[0],nodes=I.nodes(p),condition=nodes.find(n=>n.kind==='conditional')?.condition,hasCost=nodes.some(n=>n.kind==='payment_branch'),phase=p.activation.skill_type==='passive'?p.activation.trigger.destination_any[0]:p.activation.activation_phases[0];
 for(const mode of ['positive','negative',hasCost?'short':'source_left']){
  const focus=mode==='negative'&&condition&&condition.field!=='source.entry_skill_name'?{node_id:condition.node_id,value:false}:undefined;
  const {k,id}=require('./batch-smoke').fixture(card,p,phase,{rich:true,conditioned:true,expanded:true,max:true,key:'positive',focus},0,catalog);
  const entryName=nodes.find(n=>n.kind==='compare'&&n.field==='source.entry_skill_name'),entrySource=entryName&&mode!=='negative'?k.addCard(catalog.cards.find(c=>c.profiles[0].variants[0].printed.name===entryName.value).card_no,0,'event'):null;
  if(mode==='negative'&&!condition){const choose=k.choose;k.choose=r=>r.kind==='activate_payment'?false:choose(r);}
  if(mode==='short'){
   for(const n of nodes.filter(n=>n.kind==='pay_guts'))for(const a of n.areas==='source_area'?[phase]:n.areas==='court'?['serve','block','receive','toss','attack']:n.areas)for(const x of [...k.zone(0,a)].slice(0,a===phase?k.zone(0,a).length:-1))k._atomic(()=>k._move(x,0,'deck',k._context(id,0)));
   for(const n of nodes.filter(n=>n.kind==='move'&&n.classification_role==='payment'))for(const x of k.pool(n.pool,k._context(id,0)).filter(x=>x!==id))k._atomic(()=>k._move(x,0,'deck',k._context(id,0)));
  }
  const before=k.snapshot(),invoke=()=>{try{if(p.activation.skill_type==='event')k.playEvent(id);else if(entrySource)k._atomic(()=>{k._enter(id,0,phase,k._context(entrySource,0),'skill');k._drain();});else k.enter(id,phase);if(mode==='source_left')k._atomic(()=>k._move(id,0,'drop',k._context(id,0)));}catch(e){if(mode==='negative'&&e.message==='OPEN-EVENT-NO-CHANGE'){assert.deepEqual(k.snapshot(),before);return;}throw e;}};invoke();
  const after=k.snapshot(),bans=after.effects.slice(before.effects.length).filter(e=>e.kind==='ban');
  if(['positive','source_left'].includes(mode)){
   assert.equal(bans.length,1,card.card_no+' actual ban');const n=nodes.find(n=>n.kind==='ban_action');assert.deepEqual(bans[0].scope,n.scope);if(n.duration==='next_opponent_turn'){k.endTurn();k.beginTurn(1,'draw');}assert(!k.permission(action(n,n.actor==='self'?0:1)).allowed,card.card_no+' real action blocked');
  }else assert.equal(bans.length,0,card.card_no+' condition/cost did not grant a ban');
  k.restore(before);invoke();assert.deepEqual(k.snapshot(),after,'Ban card Undo '+card.card_no+' '+mode);
 }
}
module.exports.testBanCard=testBanCard;
