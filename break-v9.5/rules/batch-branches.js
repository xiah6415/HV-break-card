/* Optional sandbox branch fixtures and real follow-up actions. No live effects. */
'use strict';
const {visit}=require('./batch-index'),{matchesPrinted,FixtureGap}=require('./batch-fixtures');
const gap=m=>{throw new FixtureGap(m);};
const clone=x=>JSON.parse(JSON.stringify(x));
function expandFixture(k,{catalog,profile,source,player,phase,focus}){
 const nodes=[];for(const tree of [profile.program,profile.formal_cost])visit(tree,n=>nodes.push(n));
 const ctx=k._context(source,player),owner=a=>['self','controller','owner'].includes(a)?player:a==='opponent'?1-player:gap('Branch actor '+a);
 const defs=catalog.cards.flatMap(c=>c.profiles.map((p,variant)=>({card:c.card_no,p,variant}))).sort((a,b)=>Number(!!a.p.program)-Number(!!b.p.program));
 const printed=d=>d.p.variants[0].printed;
 const uniformTag=nodes.find(n=>n.kind==='uniform_affiliation'&&n.pool?.actor==='self')?.options[0];
 function pick(filters={},area=null,test=()=>true){return defs.find(d=>matchesPrinted(d.p,filters)&&(!area||printed(d).type==='character'&&printed(d).parameters[area]!=='dash')&&test(d))||gap('No branch fixture '+JSON.stringify({filters,area}));}
 function add(d,who,zone,bottom=false){const id=k.addCard(d.card,who,zone,d.variant);if(bottom){const ids=k.zone(who,zone);ids.unshift(ids.pop());}return id;}
 function moveToDeck(id){const c=k.card(id),from=k.state.zones[c.zone];from.splice(from.indexOf(id),1);c.zone=c.owner+'.deck';k.zone(c.owner,'deck').push(id);}
 const role=f=>f.role==='side_blocker'?'side':f.role==='center_blocker'||f.role==='block'?'block':['serve','receive','toss','attack'].includes(f.role)?f.role:'attack';
 // Cards are reserved at deck bottom before the measured checkpoint. Later
 // moves/hand notifications and entries use actual public sandbox operations.
 const followups=[];let entryReason;
 for(const w of nodes.filter(n=>n.kind==='watch')){
  if(!['character_entry','hand_added'].includes(w.event))continue;
  const who=owner(w.actor),area=role(w.filters||{}),filters=Object.fromEntries(Object.entries(w.filters||{}).filter(([key])=>!['role','entry_origins','exclude_operations'].includes(key)));
  const used=['block','side:0','side:1'].map(z=>k.top(who,z)).filter(Boolean).map(id=>k.effectiveName(id)),ids=[];let center=null;
  if(w.event==='character_entry'&&area==='side'){
   const c=pick({type:'character'},'block');used.push(printed(c).name);center=add(c,who,'deck',true);
  }
  for(let i=0;i<2;i++){
   const d=pick(w.event==='character_entry'?{type:'character',...filters}:{type:'character'},w.event==='character_entry'?(area==='side'?'block':area):null,d=>!d.p.program&&(!['side','block'].includes(area)||!used.includes(printed(d).name)));
   used.push(printed(d).name);ids.push(add(d,who,'deck',true));
  }
  followups.push({node_id:w.node_id,then_id:w.then.node_id,event:w.event,filters:w.filters||{},duration:w.duration,player:who,area,ids,center});
 }
 const base=pick({type:'character'},'attack');
 function replaceTop(who,area,d){add(d,who,area);}
 function target(){const n=nodes.find(n=>n.kind==='numeric'&&n.target?.kind==='selector');if(!n)gap('No branch target selector');const id=k.pool(n.target,ctx)[0];if(!id)gap('Empty branch target');return {id,selector:n.target};}
 function negate(n,forbidden=[]){
  if(n.kind==='all')return negate(n.conditions[0]);
  if(n.kind==='any'){const names=n.conditions.filter(c=>c.kind==='compare'&&c.field.endsWith('.effective_name')).map(c=>c.value);for(const c of n.conditions)negate(c,names);return;}
  if(n.kind==='uniform_affiliation'){
   const who=owner(n.pool.actor),area=['serve','receive','toss','attack'].find(a=>a!==phase&&!k.top(who,a))||['serve','receive','toss','attack'].find(a=>a!==phase);
   replaceTop(who,area,pick({type:'character'},area,d=>n.options.every(tag=>!printed(d).affiliation_tags.includes(tag))));return;
  }
  if(n.kind==='count_compare'){
   const sel=n.pool,who=owner(sel.actor),future=profile.activation.skill_type==='event'&&who===player&&sel.zone==='event'&&matchesPrinted(profile,sel.filters),offset=future?1:0;
   if(n.op==='gte'||n.op==='eq'){let ids=k.pool(sel,ctx);while((n.distinct_by?new Set(ids.map(id=>k.effectiveName(id))).size:ids.length)+offset>=n.value&&ids.length){moveToDeck(ids.at(-1));ids=k.pool(sel,ctx);}return;}
   if(n.op==='lte'){if(!['event','drop','hand'].includes(sel.zone))gap('Count negative zone '+sel.zone);while(k.pool(sel,ctx).length+offset<=n.value)add(pick(sel.filters),who,sel.zone);return;}
  }
  if(n.kind==='all_result_cards_match'&&n.result==='paid'){
   const stack=k.zone(player,phase);if(!stack.length)gap('No paid-card fixture');moveToDeck(stack[0]);add(pick({type:'character'},null,d=>!matchesPrinted(d.p,n.filters)),player,phase,true);return;
  }
  if(n.kind==='equal_fields'){
   // A real earlier-turn entry remains a character; no timestamp is fabricated.
   k.endTurn();k.beginTurn(1-player);k.endTurn();k.beginTurn(player,phase);return;
  }
  if(n.kind!=='compare')gap('Unimplemented branch predicate '+n.kind);
  let m=n.field.match(/^(self|opponent)\.(serve|receive|toss|attack)\.effective_name$/);
  if(m){const who=owner(m[1]),area=m[2];replaceTop(who,area,pick({type:'character'},area,d=>![n.value,...forbidden].includes(printed(d).name)&&!(who===player&&uniformTag&&!printed(d).affiliation_tags.includes(uniformTag))));return;}
  if(n.field==='target.effective_name'||n.field==='target.current_receive'){
   const t=target(),c=k.card(t.id),area=c.zone.split('.')[1];
   replaceTop(c.owner,area,pick(t.selector.filters,area,d=>n.field==='target.effective_name'?printed(d).name!==n.value:Number.isInteger(printed(d).parameters.receive)&&printed(d).parameters.receive>n.value));return;
  }
  m=n.field.match(/^(self|opponent)\.(hand|sets|set)\.count$/);
  if(m){const who=owner(m[1]),zone=m[2]==='hand'?'hand':'sets',leave=who===player&&zone==='hand'&&profile.activation.skill_type!=='active'?1:0,wanted=(n.op==='gte'?n.value-1:n.value+1)+leave;
   while(k.zone(who,zone).length>wanted){const id=k.zone(who,zone).find(id=>id!==source);if(!id)gap('Protected branch source');moveToDeck(id);}while(k.zone(who,zone).length<wanted)add(base,who,zone);return;
  }
  if(n.field.startsWith('source.covered_character.')){const field=n.field.split('.').at(-1);replaceTop(player,phase,pick({type:'character'},phase,d=>field==='effective_name'?printed(d).name!==n.value:!(printed(d)[field==='tags'?'affiliation_tags':'position_tags']||[]).includes(n.value)));return;}
  if(n.field==='both.set.count_sum'){while(k.zone(0,'sets').length+k.zone(1,'sets').length<=n.value)add(base,player,'sets');return;}
  if(n.field==='opponent.attack.printed_attack'){replaceTop(1-player,'attack',pick({type:'character'},'attack',d=>printed(d).parameters.attack>n.value));return;}
  if(n.field==='source.entry_origin'){moveToDeck(source);k.resolveProgram({kind:'move_self',destination:'owner.drop'},player,source);entryReason='skill';return;}
  if(n.field==='phase'){const other=profile.activation.activation_phases.find(p=>p!==n.value);if(!other)gap('No alternate activation phase');k.advancePhase(other);return;}
  if(n.field==='self.court.distinct_affiliation_assignment_count'){for(const a of ['serve','block','receive','toss','attack'].filter(a=>a!==phase))for(const id of [...k.zone(player,a)])moveToDeck(id);return;}
  if(n.field==='self.attack.guts.count'){add(base,player,'attack',true);return;}
  if(n.field==='opponent_ball.kind'){k.state.ball.kind=n.op==='in'?['serve','attack','block'].find(k=>!n.value.includes(k)):n.value==='serve'?'attack':'serve';return;}
  if(n.field==='opponent_ball.offense'){k.state.ball.offense=n.op==='lte'?n.value+1:n.value-1;return;}
  if(n.field==='retrieved.count'){const choose=k.choose;k.choose=req=>req.kind==='move_count'?0:choose(req);return;}
  if(n.field==='paid.names_are_distinct'){
   const ids=k.zone(player,phase);if(ids.length<2)gap('Not enough paid-card fixture');const p=k.profile(ids[1]),d=defs.find(d=>d.p.profile_id===p.profile_id);moveToDeck(ids[0]);add(d,player,phase,true);return;
  }
  if(n.field==='target.entry_reason'){
   const t=target(),c=k.card(t.id),area=c.zone.split('.')[1],previous=k.state.turn.phase;
   moveToDeck(t.id);k.resolveProgram({kind:'move_self',destination:'owner.hand'},player,t.id);k.state.turn.phase=area;k.enter(t.id,area);k.state.turn.phase=previous;return;
  }
  gap('Unimplemented branch fact '+n.field);
 }
 if(focus&&focus.value===false){const n=nodes.find(n=>n.node_id===focus.node_id);if(!n)gap('Unknown focus predicate');negate(n);}
 k.assertState();return {followups,branch_focus:focus||null,...(entryReason?{entryReason}:{})};
}
function driveFollowups(k,plans){
 const receipts=[];
 for(const plan of plans){
  const installed=k.state.effects.find(e=>e.kind==='watch'&&e.then.node_id===plan.then_id&&JSON.stringify(e.filters)===JSON.stringify(plan.filters));
  if(!installed)continue;
  if(plan.duration==='next_opponent_turn'&&installed.duration.activeTurn===null){k.endTurn();k.beginTurn(1-k.state.turn.player);}
  if(plan.player!==k.state.turn.player)gap('Follow-up requires an out-of-turn character host');
  function toHand(id){if(k.card(id).zone!==plan.player+'.hand')k.resolveProgram({kind:'move_self',destination:'owner.hand'},plan.player,id);}
  if(plan.area==='side'&&!k.top(plan.player,'block')){toHand(plan.center);k.advancePhase('block');k.enter(plan.center,'block');}
  for(const id of plan.ids){
   toHand(id);
   if(plan.event==='character_entry'){
    const area=plan.area==='side'?'block':plan.area;k.advancePhase(area);k.enter(id,area,{side:plan.area==='side'});
   }
   receipts.push({node_id:plan.node_id,id,player:plan.player,zone:k.card(id).zone,parameters:clone(k.card(id).printed.parameters),effective_parameters:k.card(id).printed.type==='character'?Object.fromEntries(Object.keys(k.card(id).printed.parameters).map(p=>[p,k.parameter(id,p)])):null});
  }
 }
 return receipts;
}
module.exports={expandFixture,driveFollowups};
