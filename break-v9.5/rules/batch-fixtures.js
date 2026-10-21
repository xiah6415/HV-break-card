/* Sandbox-only fixture seeding from structured conditions. No execution approval. */
'use strict';
const {visit}=require('./batch-index');
class FixtureGap extends Error {constructor(message){super(message);this.code='FIXTURE_GAP';}}
const fail=message=>{throw new FixtureGap(message);};
function matchesPrinted(profile,filters={}){
 const p=profile.variants[0].printed,icons=profile.activation?.activation_phases||[];
 return Object.entries(filters).every(([key,v])=>{
  if(key==='role')return v==='character'?p.type==='character':true;
  if(key==='type')return p.type===v;
  if(key==='names')return v.includes(p.name);
  if(key==='exclude_names')return !v.includes(p.name);
  const field={tags:'affiliation_tags',tags_any:'affiliation_tags',years:'year_tags',years_any:'year_tags',positions:'position_tags',positions_any:'position_tags'}[key];
  if(field)return key.endsWith('_any')?v.some(x=>p[field].includes(x)):v.every(x=>p[field].includes(x));
  if(key==='play_icons_any')return v.some(x=>icons.includes(x));
  if(key==='play_icons_exact')return JSON.stringify([...v].sort())===JSON.stringify([...icons].sort());
  if(key==='skillless')return !profile.program===v;
  if(key==='printed_receive_gte')return Number.isInteger(p.parameters?.receive)&&p.parameters.receive>=v;
  if(key==='printed_block_gte')return Number.isInteger(p.parameters?.block)&&p.parameters.block>=v;
  fail('Unseeded printed filter '+key);
 });
}
function seedConditions(k,{catalog,profile,source,player,phase,expanded=false}){
 const nodes=[];for(const tree of [profile.program,profile.formal_cost])visit(tree,n=>nodes.push(n));
 const ctx=k._context(source,player),notes=[],protectedHand=new Set([source]);
 const ownUniform=nodes.find(n=>n.kind==='uniform_affiliation'&&n.pool?.actor==='self');
 const tag=ownUniform?.options[0],sourceLeaves=profile.activation.skill_type!=='active';
 const choices=catalog.cards.flatMap(c=>c.profiles.map((p,variant)=>({card:c.card_no,p,variant}))).sort((a,b)=>Number(!!a.p.program)-Number(!!b.p.program));
 const owner=actor=>['self','controller','owner'].includes(actor)?player:actor==='opponent'?1-player:fail('Unseeded actor '+actor);
 const base=choices.find(d=>d.p.variants[0].printed.type==='character'&&!d.p.program);
 const printed=d=>d.p.variants[0].printed;
 const targetName=expanded?nodes.find(n=>n.kind==='compare'&&n.field==='target.effective_name'&&n.op==='eq')?.value:null;
 const targetReceive=expanded?nodes.find(n=>n.kind==='compare'&&n.field==='target.current_receive'&&n.op==='lte')?.value:null;
 const paidFilter=expanded?nodes.find(n=>n.kind==='all_result_cards_match'&&n.result==='paid')?.filters:null;
 const distinctPaid=expanded&&nodes.some(n=>n.kind==='compare'&&n.field==='paid.names_are_distinct'&&n.value===true);
 const deferred=expanded?nodes.filter(n=>n.kind==='watch').map(n=>n.then.node_id+'.'):[];
 if(expanded&&nodes.some(n=>n.kind==='numeric'&&n.target==='opponent_ball'&&n.parameter==='attack_offense')){k.state.ball.kind='attack';k.state.ball.offense=8;}
 function pick(filters={},options={}){
  const d=choices.find(d=>matchesPrinted(d.p,filters)&&(!options.parameter||printed(d).type==='character'&&printed(d).parameters[options.parameter]!=='dash')&&(!options.tag||printed(d).affiliation_tags.includes(options.tag))&&!(options.exclude||[]).includes(printed(d).name)&&(!options.receiveMax||Number.isInteger(printed(d).parameters?.receive)&&printed(d).parameters.receive<=options.receiveMax)&&(!options.attackValue||Number.isInteger(printed(d).parameters?.attack)&&(options.attackValue.op==='eq'?printed(d).parameters.attack===options.attackValue.value:printed(d).parameters.attack<=options.attackValue.value)));
  return d||fail('No printed fixture match '+JSON.stringify({filters,...options}));
 }
 function add(d,who,zone,bottom=false){
  const id=k.addCard(d.card,who,zone,d.variant);
  if(bottom){const ids=k.zone(who,zone);ids.unshift(ids.pop());}
  return id;
 }
 function roleFor(filters={},parameter){
  const role=filters.role;return role==='center_blocker'||role==='side_blocker'||role==='block'?'block':['serve','receive','toss','attack'].includes(role)?role:['serve','block','receive','toss','attack'].includes(parameter)?parameter:'attack';
 }
 function pool(sel){return k.pool(sel,ctx).filter(id=>!(sourceLeaves&&id===source&&sel.zone==='hand'));}
 function ensure(sel,n=1,{distinct=false,parameter,exclude=[],receiveMax}={}){
  const who=owner(sel.actor),zone=sel.zone,filters=sel.filters||{};
  let ids=pool(sel),names=new Set(ids.map(id=>k.effectiveName(id)));
  for(let attempts=0;(distinct?names.size:ids.length)<n;attempts++){
   if(attempts>15)fail('Fixture pool capacity '+zone);
   let dest=zone==='event_or_drop'?'drop':zone,bottom=false,role=null;
   if(zone==='court'||zone==='block'){
    role=zone==='block'?'block':roleFor(filters,parameter);dest=role;
    if(k.top(who,dest)&&!(expanded&&filters.role&&filters.role!=='character')){
     dest=['serve','block','receive','toss','attack'].find(z=>!k.top(who,z));
     if(!dest)fail('No free court fixture slot');
     role=dest;
    }
   }else if(zone==='court.guts'||zone.endsWith('.guts')){
    dest=zone==='court.guts'?'receive':zone.split('.')[0];
    if(!k.top(who,dest))add(pick({type:'character'},{parameter:dest,tag:who===player?tag:null}),who,dest);
    bottom=true;
   }else if(expanded&&['serve','receive','toss','attack'].includes(zone))role=zone;
   else if(!['hand','drop','event','event_or_drop','deck','sets'].includes(zone))fail('Unseeded zone '+zone);
   const d=pick(filters,{parameter:role,tag:who===player&&role?tag:null,exclude:[...exclude,...(distinct?[...names]:[])],receiveMax});
   const id=add(d,who,dest,bottom);
   if(dest==='hand')protectedHand.add(id);
   ids=pool(sel);names=new Set(ids.map(id=>k.effectiveName(id)));
  }
  return ids;
 }
 function moveToDeck(id){const c=k.card(id),from=k.state.zones[c.zone],i=from.indexOf(id);from.splice(i,1);c.zone=c.owner+'.deck';k.zone(c.owner,'deck').push(id);}
 function setZoneCount(who,zone,n){
  if(n<0||n>20)fail('Unseeded count '+n);
  let ids=k.zone(who,zone);
  while(ids.length>n){const id=[...ids].reverse().find(id=>!protectedHand.has(id));if(!id)fail('Count conflicts with required cards');moveToDeck(id);}
  while(ids.length<n)add(base,who,zone);
 }
 function desired(op,value){if(!Number.isInteger(value))fail('Unseeded comparison value');return op==='gte'||op==='eq'?value:op==='lte'?Math.max(0,value):fail('Unseeded comparison '+op);}
 // Facts which require a named role are seeded before generic court targets.
 let entryReason='rule';
 for(const n of nodes.filter(n=>n.kind==='compare')){
  const m=n.field.match(/^(self|opponent)\.(serve|receive|toss|attack)\.effective_name$/);
  if(m&&n.op==='eq'){
   const who=owner(m[1]),area=m[2];add(pick({names:[n.value]},{parameter:area,tag:who===player?tag:null}),who,area);
  }
  if(n.field==='source.entry_reason'&&n.op==='eq')entryReason=n.value;
  if(expanded&&n.field==='opponent.attack.printed_attack')add(pick({type:'character'},{parameter:'attack',attackValue:n}),1-player,'attack');
  if(expanded&&n.field==='opponent_ball.kind'&&n.op==='eq')k.state.ball.kind=n.value;
  if(expanded&&n.field==='opponent_ball.offense')k.state.ball.offense=desired(n.op,n.value);
 }
 for(const n of nodes){
  if(n.kind==='pay_guts'){
   const areas=n.areas==='source_area'?[phase]:n.areas==='court'?['serve','block','receive','toss','attack']:n.areas;
   const count=n.count_each||n.count||Math.max(...n.allowed_counts);
   for(const area of areas){if(!k.top(player,area))add(pick({type:'character'},{parameter:area,tag}),player,area);const used=[];for(let i=0;i<count;i++){const d=pick({...{type:'character'},...(paidFilter||{})},{parameter:area,tag,exclude:distinctPaid?used:[]});used.push(printed(d).name);add(d,player,area,true);}}
  }
  if(expanded&&n.kind==='numeric'&&n.target?.kind==='selector')ensure({...n.target,filters:{...n.target.filters,...(targetName?{names:[targetName]}:{})}},1,{receiveMax:targetReceive===null?undefined:Math.max(1,targetReceive-2)});
  if(n.kind==='selector'&&!n.zone.startsWith('$')&&!deferred.some(prefix=>n.node_id?.startsWith(prefix)))ensure(n,1);
  if(expanded&&['move','retrieve'].includes(n.kind)&&Number.isInteger(n.count)&&n.count>1&&!deferred.some(prefix=>n.node_id?.startsWith(prefix)))ensure(n.pool,n.count,{distinct:!!n.group_constraints?.distinct_names});
 }
 // Seed positive boundaries, including the Event just placed before its effect.
 for(const n of nodes.filter(n=>n.kind==='count_compare')){
  const sel=n.pool,who=owner(sel.actor),futureEvent=who===player&&sel.zone==='event'&&profile.activation.skill_type==='event'&&matchesPrinted(profile,sel.filters);
  const wanted=Math.max(0,desired(n.op,n.value)-(futureEvent?1:0));
  if(n.op==='gte'||n.op==='eq')ensure(sel,wanted,{distinct:!!n.distinct_by});
  if(n.op==='lte'||n.op==='eq'){
   let ids=pool(sel);while((n.distinct_by?new Set(ids.map(id=>k.effectiveName(id))).size:ids.length)>wanted){moveToDeck(ids.at(-1));ids=pool(sel);}
  }
 }
 if(expanded&&targetName)for(const n of nodes.filter(n=>n.kind==='numeric'&&n.target?.kind==='selector'))ensure({...n.target,filters:{...n.target.filters,names:[targetName]}},1);
 if(expanded){const covered=nodes.find(n=>n.kind==='compare'&&n.field.startsWith('source.covered_character.'));if(covered){const key=covered.field.split('.').at(-1),filters={effective_name:'names',tags:'tags',positions:'positions'};add(pick({[filters[key]]:[covered.value]},{parameter:phase}),player,phase);}}
 if(ownUniform&&!k.court(player).length)add(pick({type:'character'},{parameter:'attack',tag}),player,'attack');
 // Keep source and required cost cards; adjust hand counts at the declaration checkpoint.
 for(const who of [0,1])for(const zone of ['hand','deck']){
  if(zone==='deck'){while(k.zone(who,zone).length<6)add(base,who,zone);continue;}
  if(k.zone(who,zone).length<2)setZoneCount(who,zone,2);
 }
 for(const n of nodes.filter(n=>n.kind==='compare')){
  let m=n.field.match(/^(self|opponent)\.(hand|sets|set)\.count$/);
  if(m){const who=owner(m[1]),zone=m[2]==='hand'?'hand':'sets';setZoneCount(who,zone,desired(n.op,n.value)+(zone==='hand'&&who===player&&sourceLeaves?1:0));}
  if(n.field==='both.set.count_sum'){setZoneCount(player,'sets',0);setZoneCount(1-player,'sets',desired(n.op,n.value));}
 }
 if(expanded&&nodes.some(n=>n.kind==='compare'&&n.field==='target.entry_reason'&&n.value==='skill')){
  const target=k.court(player)[0];if(!target)fail('No fixture target for entry history');
  const c=k.card(target),area=c.zone.split('.')[1],oldPhase=k.state.turn.phase;
  moveToDeck(target);k.zone(player,'deck').splice(k.zone(player,'deck').indexOf(target),1);c.zone=player+'.hand';k.zone(player,'hand').push(target);
  k.state.turn.phase=area;k.enter(target,area,{reason:'skill'});k.state.turn.phase=oldPhase;
 }
 k.assertState();notes.push({kind:'structured_conditions',own_uniform_tag:tag||null,entry_reason:entryReason});
 return {entryReason,notes};
}
module.exports={seedConditions,matchesPrinted,FixtureGap};
