/* Host adapter for released scripts, watches and actual entry receipts.
   Court observers share the core trigger queue with self-entry skills. */
(function(root) {
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const {Kernel,distinctNameOptions,validateBan,validateInvalid,validateProtection}=node?require('./core'):root.BreakRulesCore;
const {attempt,settle}=node?require('./decisions'):root.BreakRulesDecisions;
const identity=node?require('./identity'):root.BreakCardIdentity;
const data=node?require('./runtime-data.json'):root.BreakRulesData;
const library=node?require('../card-library'):root.BreakCardLibrary;
if(JSON.stringify(data.authority)!==JSON.stringify(library.data.authority))throw Error('Library/runtime authority mismatch');
const copy=x=>JSON.parse(JSON.stringify(x));
const phase={srv:'serve',drw:'draw',rcv:'receive',tos:'toss',atk:'attack',blk:'block',end:'end'};
const params={srv:'serve',blk:'block',rcv:'receive',tos:'toss',atk:'attack'};
const labels={serve:'發球',block:'攔網',receive:'接球',toss:'舉球',attack:'攻擊'};
const norm=s=>s.normalize('NFKC').replace(/\s/g,'');
const byShort=Object.fromEntries(data.catalog.cards.map(c=>[c.card_no.replace(/^HV-?/,''),c]));
const approved=new Set(data.approved);
function handles(c) { const grant=library.permission(c),profile=byShort[c]?.profiles[0];return grant?.kind==='shared'&&grant.profileId===profile?.profile_id&&profile.runtime_approved===true&&!!profile.program&&approved.has(grant.profileId); }
const displayNames=Object.fromEntries(data.catalog.cards.flatMap(c=>c.profiles.map(p=>[p.variants[0].printed.name,p.variants[0].printed.display_name])));
function displayName(name) {return displayNames[name]||name;}
function entryNames(code) {
 const p=byShort[code]?.profiles[0],names=[];
 if(handles(code)&&p.activation?.skill_type==='permanent_entry_name'){
  const visit=n=>{if(!n||typeof n!=='object')return;if(n.kind==='rename_before_entry')names.push(...n.choose_name.map(displayName));Object.values(n).forEach(v=>{if(v&&typeof v==='object')Array.isArray(v)?v.forEach(visit):visit(v);});};visit(p.program);
 }
 return names;
}
function stored(g) {
  const s=g.sharedRulesState;
  if(s&&(s.version!==1||s.fingerprint!==data.fingerprint))throw new Error('Shared watcher data version mismatch');
  return s||{version:1,fingerprint:data.fingerprint,next:1,effects:[],receipts:[]};
}
const watchSignatures=new Set();
function signature(e) { return JSON.stringify([e.event,typeof e.duration==='string'?e.duration:e.duration.kind,e.filters||{},e.then,e.remaining_uses??e.remaining??null]); }
(function walk(n){if(!n||typeof n!=='object')return;if(n.kind==='watch')watchSignatures.add(signature(n));for(const v of Object.values(n))if(v&&typeof v==='object')walk(v);})(data.catalog);
function persistent(e) { return ['watch','protect','ban','invalid','keyword'].includes(e.kind); }
function admitEffect(e) {
  if(e.kind==='keyword'&&['doshat','feint','blockout','a_pass','feint_block_ban'].includes(e.keyword)&&Number.isInteger(e.N)&&e.N>=0&&[0,1].includes(e.actor)&&['this_turn','next_opponent_turn'].includes(e.duration.kind))return;
  if(e.kind==='ban'&&[0,1].includes(e.actor)){try{validateBan({action:e.action,actor:'self',scope:e.scope,duration:e.duration.kind});return;}catch(_){}}
  if(e.kind==='invalid'&&[0,1].includes(e.actor)){try{validateInvalid({actor:'self',duration:e.duration.kind,selector:e.selector});return;}catch(_){}}
  const admittedFamily=['hand_added','character_entry','loss','block_success','source_moved'].includes(e.event)&&['this_turn','next_opponent_turn'].includes(e.duration.kind);
  if(e.kind==='watch'&&admittedFamily&&watchSignatures.has(signature(e)))return;
  if(e.kind==='protect'&&Array.isArray(e.targets)&&e.targets.every(r=>typeof r.id==='string'&&Number.isInteger(r.incarnation))&&[null,0,1].includes(e.ballOwner)){
    const continuous=!!e.selector;try{validateProtection({parameter:e.parameter,duration:e.duration.kind,target:continuous?e.selector:e.ballOwner!==null?'self_ball':'source',target_scope:{mode:continuous?'all':'single',binding:continuous?'all_matches':'reference',membership:continuous?'continuous_matching':'snapshot_on_resolution'}});if(continuous||e.ballOwner!==null||e.targets.length)return;}catch(_){}
  }
  throw new Error('Unintegrated persistent watcher mechanism');
}
function assertReady(g) {
  if(g.sharedRulesPending)throw new Error('A shared settlement is already awaiting a choice');
  for(const e of stored(g).effects)admitEffect(e);
}
function beginTurn(g,p) {
  if(!g.sharedRulesState)return;
  for(const e of stored(g).effects)if(e.duration.kind==='next_opponent_turn'&&e.duration.activeTurn===null&&e.duration.player===p.idx)e.duration.activeTurn=g.turnNo;
}
function finishTurn(g) {
  if(!g.sharedRulesState)return;
  const s=stored(g);s.effects=s.effects.filter(e=>e.duration.kind==='next_opponent_turn'&&e.duration.activeTurn===null);s.receipts=[];
}
function loss(g) { if(g.sharedRulesState){stored(g).effects=[];g.sharedRulesState.receipts=[];}g.sharedRulesPending=null;g.sharedRulesEvents=[]; }
function permission(g,action) {
  const effects=stored(g).effects;for(const e of effects)admitEffect(e);
  if(!effects.some(e=>['ban','invalid','keyword'].includes(e.kind)&&active(e,g)))return {allowed:true};
  const k=new Kernel({catalog:data.catalog,ruleIds:data.ruleIds,fingerprint:data.fingerprint,mode:'live'});
  k.state.turn={id:Math.max(1,g.turnNo),player:g.turnP?.idx??action.player,phase:phase[g.rulePhase]||'draw',step:'free'};
  k.state.effects=effects.filter(e=>['ban','invalid','keyword'].includes(e.kind));return k.permission(action);
}
function endDrawPhase(g) {if(g.sharedRulesState)stored(g).effects=stored(g).effects.filter(e=>e.duration.kind!=='this_draw_phase');}
function blockOrigins(g,p) {const counts={};if(g.turnP===p&&!p.ts.finished)for(const receipt of p.ts.blockEntryReceipts||[]){const z=p.ts.blockEntryOrigins?.[receipt]||'hand';counts[z]=(counts[z]||0)+1;}return counts;}
function skillAllowed(g,p,code,key=null) {const profile=byShort[code]?.profiles[0];if(!profile)return false;return permission(g,{action:'use_skill',player:p.idx,origin:'skill',type:profile.variants[0].printed.type,name:norm(key?g.cardName(p,key):displayName(profile.variants[0].printed.name)),role:key==='block'?'center_blocker':key?.startsWith('side:')?'side_blocker':key||'guts',sourceZone:key||(profile.variants[0].printed.type==='event'?'event':'hand'),phaseTags:profile.activation?.activation_phases||[],icons:profile.printed_play_icons||profile.activation?.activation_phases||[]}).allowed;}
function eventAllowed(g,p,code,timing) {const printed=library.card(code);return !!printed&&permission(g,{action:'play_event',player:p.idx,origin:'rule',phase:phase[timing]||phase[g.rulePhase]||'draw',icons:printed.activationPhases}).allowed;}
function blockGroupAllowed(g,p,count) {const counts=blockOrigins(g,p);return permission(g,{action:'enter_character',player:p.idx,origin:'rule',role:'center_blocker',entryOrigin:'hand',entryCount:blockEntered(g,p)+count,entryCounts:{...counts,hand:(counts.hand||0)+count},name:'',printed:{position_tags:[],parameters:{receive:'dash'}}}).allowed;}
function blockEntered(g,p) {return g.turnP===p&&!p.ts.finished?(p.ts.blockEntryReceipts?.length||0):0;}
function entryAllowed(g,p,code,area,{origin='rule',entryOrigin='hand',entryCount=null,name=null}={}) {
  if(entryCount===null)entryCount=area==='block'||area.startsWith('side:')?blockEntered(g,p)+1:1;
  const printed=byShort[code]?.profiles[0].variants[0].printed;
  return !!printed&&permission(g,{action:'enter_character',player:p.idx,origin,entryOrigin,entryCount,entryCounts:{...blockOrigins(g,p),[entryOrigin]:(blockOrigins(g,p)[entryOrigin]||0)+Math.max(1,entryCount-blockEntered(g,p))},role:area==='block'?'center_blocker':area.startsWith('side:')?'side_blocker':area,printed,name:name?norm(name):printed.name}).allowed;
}
function transaction(g,p,c,timing,notification=null) {
  if(g.sharedRulesPending)throw new Error('A shared settlement is already awaiting a choice');
  if(!notification&&(!handles(c)||!p.hand.includes(c)||g.turnP!==p))throw new Error('Not an admitted settlement');
  if(!notification&&byShort[c].profiles[0].variants[0].printed.type!=='event'&&byShort[c].profiles[0].limit&&p.ts.used?.[c])throw new Error('Same-name skill already used this turn');
  const saved=copy(stored(g));
  const k=new Kernel({catalog:data.catalog,ruleIds:data.ruleIds,fingerprint:data.fingerprint,mode:'live',practiceDrawBeforeReceive:true});
  const physical=identity.snapshot(g);
  k.state.turn={id:Math.max(1,g.turnNo),player:g.turnP?.idx??p.idx,phase:phase[timing],step:'free',blockEntries:g.players.map(q=>blockEntered(g,q)),blockEntriesByOrigin:g.players.map(q=>blockOrigins(g,q))};
  k.state.next=Math.max(k.state.next,saved.next);
  if(g.ball)k.state.ball={owner:1-k.state.turn.player,kind:g.ball.type,offense:g.ball.off};
  const short={},slots={},basePlayers=g.players.map(q=>copy({hand:q.hand,deck:q.deck,drop:q.drop,ev:q.ev,sets:q.sets,area:q.area,ts:q.ts,effects:q.effects,newCount:q.newCount}));
  for(const q of g.players) {
    for(const [zone,cards] of Object.entries({hand:q.hand,deck:q.deck,drop:q.drop,event:q.ev,sets:q.sets,...q.area,...Object.fromEntries((q.ts.sides||[]).map((x,i)=>['side:'+i,[x]]))})) {
      for(const [index,code] of cards.entries()) {
        const def=byShort[code];if(!def)throw new Error('Printed identity missing: '+code);
        const temporary=k.addCard(def.card_no,q.idx,zone);
        const hostZone=zone==='event'?'ev':zone.startsWith('side:')?'sides':zone;
        const id=physical.zones[q.idx+'.'+hostZone][zone.startsWith('side:')?+zone.slice(5):index];
        const card=k.state.cards[temporary];delete k.state.cards[temporary];
        card.id=id;card.incarnation=physical.cards[id].incarnation;k.state.cards[id]=card;
        for(const key of ['entryOrigin','entryReason','entryTurn','entrySkillName','coveredCharacter'])if(physical.cards[id][key]!==undefined)card[key]=copy(physical.cards[id][key]);
        k.zone(q.idx,zone)[index]=id;short[id]=code;
      }
    }
    for(const t of g.courtTargets(q)) {
      const id=k.top(q.idx,t.key),ctx={controller:q.idx,source:null};slots[id]={player:q.idx,key:t.key};
      const name=norm(g.cardName(q,t.key));
      if(name!==k.card(id).printed.name)k.effect('rename',{target:k.reference(id),name},ctx);
      for(const [old,param] of Object.entries(params)) {
        const value=g.parameter(q,t.key,old),printed=k.card(id).printed.parameters[param];
        if(value!=null&&value!==printed)k.effect('numeric',{target:k.reference(id),parameter:param,operation:'add',value:value-printed},ctx);
      }
    }
    if(q.restrict.no_add)k.effect('ban',{actor:q.idx,action:'add_hand',scope:{origins:['skill']}},{controller:q.idx,source:null});
    for(const code of Object.keys(q.ts.used||{})) {
      const profile=byShort[code]?.profiles[0];
      if(profile?.limit)k.state.locks.push({player:q.idx,turn:k.state.turn.id,name:profile.variants[0].printed.name});
    }
  }
  // Keep only admitted persistent families. Imported legacy numeric effects stay
  // in the host; persisting them here too would apply every bonus twice.
  for(const e of saved.effects) {
    admitEffect(e);
    if(e.kind==='watch')k.preflight(e.then);k.state.effects.push(copy(e));
  }
  if(p.ts.keywordOutgoing)k.state.keywordOutgoing=copy(p.ts.keywordOutgoing);
  const source=notification?null:k.zone(p.idx,'hand').find(id=>short[id]===c),base=k.snapshot();
  const command=notification?{kind:'host_events',...notification}:{kind:'skill',player:p.idx,source,timing};
  const invoke=notification?kernel=>notification.outgoing?kernel.outgoing(notification.outgoing.kind,notification.outgoing.offense):kernel.notifyHostEvents(notification.events):kernel=>kernel.card(source).printed.type==='event'?kernel.playEvent(source):kernel.useSkill(source);
  function choices(req) {
    if(req.kind==='revealResult')return [[]];
    if(req.kind==='reveal'||req.kind==='mode'||req.kind==='name')return [...req.options];
    if(req.kind==='guts')return [req.options.slice(0,req.count)];
    if(['target','payment_cards','move_cards','entry'].includes(req.kind)) {
      const combinations=[];
      function collect(start,pick){if(pick.length===req.count){combinations.push(pick);return;}for(let i=start;i<=req.options.length-(req.count-pick.length);i++)collect(i+1,[...pick,req.options[i]]);}
      collect(0,[]);return combinations;
    }
    if(req.kind==='guts_destination')return [...req.options];
    if(['entry_count','draw_count','mill_count','move_count','payment_count','parameter','activate_payment','optional','trigger_order'].includes(req.kind))return [...req.options].reverse();
    throw new Error('Decision is outside migration scope: '+req.kind);
  }
  // A legal event needs at least one resolving effect. Explore the same rules,
  // also removing a zero-draw choice when it would leave the entire event inert.
  function possible(answers, budget={left:256}) {
    if(--budget.left<0)throw new Error('Admission search limit reached');
    let step;
    try {step=attempt(k,base,invoke,answers);}
    catch(e) {if(e.code==='ILLEGAL_ACTION'||e.code==='REQUIRES_REVIEW'&&e.message==='OPEN-EVENT-NO-CHANGE')return false;throw e;}
    // 失效的 Event 仍可打出放到 Event 區；手牌角色技能失效時無法宣告（否則主機重複詢問、無任何變化）
    if(!step.boundary)return step.result.performed||step.result.invalid&&byShort[c].profiles[0].variants[0].printed.type==='event';
    const req=step.boundary.request;
    return choices(req).some(answer=>possible([...answers,{request:req,answer}],budget));
  }
  const savedIds=new Set(saved.effects.map(e=>e.id));
  const durable=state=>state.effects.filter((e,i)=>persistent(e)&&(savedIds.has(e.id)||i>=base.effects.length));
  let eventCursor=0,effectCursor=base.effects.length,publicLogCursor=base.publicLog.length,announced=false,ballOff=base.ball?.offense;
  function publish(state,complete,journal) {
    for(const e of durable(state))admitEffect(e);
    const next=copy(physical);
    for(const key of Object.keys(next.zones)) {
      const [player,zone]=key.split('.');
      next.zones[key]=zone==='sides'?[...state.zones[player+'.side:0'],...state.zones[player+'.side:1']]:[...state.zones[player+'.'+(zone==='ev'?'event':zone)]];
      for(const id of next.zones[key]){next.cards[id].zone=key;next.cards[id].incarnation=state.cards[id].incarnation;for(const field of ['entryOrigin','entryReason','entryTurn','entrySkillName','coveredCharacter'])if(state.cards[id][field]!==undefined)next.cards[id][field]=copy(state.cards[id][field]);if(state.events.some(e=>e.type==='character_entry'&&e.character?.id===id&&e.character.incarnation===state.cards[id].incarnation))next.cards[id].entryIncarnation=state.cards[id].incarnation;}
    }
    next.revision=physical.revision+state.events.filter(e=>e.type==='move').length;
    identity.restore(g,next);
    if(state.ball)g.ball.off=state.ball.offense;
    // Projection always starts from the same host checkpoint, never from an earlier preview.
    for(const q of g.players) {
      const b=basePlayers[q.idx],codes=z=>state.zones[q.idx+'.'+z].map(id=>short[id]);
      for(const [host,z] of Object.entries({hand:'hand',deck:'deck',drop:'drop',ev:'event',sets:'sets'}))q[host]=codes(z);
      q.effects=copy(b.effects);q.ts=copy(b.ts);q.newCount=copy(b.newCount);
      // Effect entries count even if a later effect moves the blocker away.
      for(const e of state.events.filter(e=>e.type==='character_entry'&&e.player===q.idx&&['center_blocker','side_blocker'].includes(e.role)&&!notification?.events?.some(n=>n.type==='character_entry'&&n.character.id===e.character.id&&n.character.incarnation===e.character.incarnation))){
        const receipt=`effect:${g.turnNo}:${q.idx}:${e.character.id}:${e.character.incarnation}`;q.ts.blockEntryReceipts ||= [];if(!q.ts.blockEntryReceipts.includes(receipt))q.ts.blockEntryReceipts.push(receipt);q.ts.blockEntryOrigins ||= {};q.ts.blockEntryOrigins[receipt]=e.origin;
      }
      // Side blockers are physical zones too. Restoring the old turn snapshot
      // must not resurrect a side blocker removed by a generated effect.
      const sideIds=[...state.zones[q.idx+'.side:0'],...state.zones[q.idx+'.side:1']];
      q.ts.sides=sideIds.map(id=>short[id]);
      for(const key of Object.keys(q.effects))if(key.startsWith('side:'))delete q.effects[key];
      sideIds.forEach((id,i)=>{const old=slots[id]?.key;if(old&&b.effects[old])q.effects['side:'+i]=copy(b.effects[old]);});
      for(const id of Object.keys(state.cards)) {
        if(state.cards[id].owner!==q.idx)continue;
        const original=slots[id];
        if(original?.key.startsWith('side:')&&!sideIds.includes(id))continue;
        const zone=state.cards[id].zone.split('.')[1];if(!['serve','block','receive','toss','attack','side:0','side:1'].includes(zone)||state.zones[state.cards[id].zone].at(-1)!==id)continue;
        const key=zone.startsWith('side:')?'side:'+sideIds.indexOf(id):zone,slot={...original,key};
        for(const [old,param] of Object.entries(params)) {
          const value=s=>s.effects.filter(e=>e.kind==='numeric'&&e.target.id===id&&e.target.incarnation===s.cards[id].incarnation&&e.parameter===param&&(e.duration.kind==='next_opponent_turn'?e.duration.activeTurn===s.turn.id:e.duration.turn===s.turn.id)).reduce((n,e)=>e.operation==='set'?e.value:n+e.value,s.cards[id].printed.parameters[param]);
          const delta=value(state)-(original&&slot.key===original.key&&base.cards[id].incarnation===state.cards[id].incarnation?value(base):state.cards[id].printed.parameters[param]);
          if(!delta)continue;
          if(q.effects[slot.key]?.card!==short[id] || q.effects[slot.key].ref && (q.effects[slot.key].ref.id!==id||q.effects[slot.key].ref.incarnation!==state.cards[id].incarnation))q.effects[slot.key]={card:short[id],ref:{id,incarnation:state.cards[id].incarnation},mods:{}};
          const fx=q.effects[slot.key];fx.mods ||= {};fx.mods[old]=(fx.mods[old]||0)+delta;
          const active=g.activeParameter(q,slot.key,old);if(active&&q.ts[active]!=null)q.ts[active]+=delta;
        }
      }
      for(const e of state.effects.slice(base.effects.length))if(e.kind==='rename'&&e.target&&state.cards[e.target.id]?.owner===q.idx){
        const id=e.target.id,card=state.cards[id],zone=card.zone.split('.')[1];
        if(card.incarnation!==e.target.incarnation||!['serve','block','receive','toss','attack','side:0','side:1'].includes(zone)||state.zones[card.zone].at(-1)!==id)continue;
        const key=zone.startsWith('side:')?'side:'+sideIds.indexOf(id):zone;
        const fx=g.effect(q,key);fx.name=displayName(e.name);
      }
      // An event can replace a role after its judgment value was cached.
      for(const [area,identityKey,cache,param]of [['receive','receiver','rcv','rcv'],['toss','setter','toss','tos'],['attack','attacker','atk','atk']]){
        if(b.ts[cache]==null)continue;const id=state.zones[q.idx+'.'+area].at(-1),oldId=base.zones[q.idx+'.'+area].at(-1);
        if(!id||id===oldId&&state.cards[id].incarnation===base.cards[oldId].incarnation)continue;
        let value=g.parameter(q,area,param);
        if(area==='receive'&&!k._protected({id,incarnation:state.cards[id].incarnation},'receive',{controller:q.idx}))value-=q.restrict.rcv_minus||0;
        if(area==='toss')value+=q.ts.apass||0;
        if(area==='attack'&&g.cardName(q,area)==='日向 翔陽')value+=q.ts.hin||0;
        q.ts[identityKey]=short[id];q.ts[identityKey+'Ref']={id,incarnation:state.cards[id].incarnation};q.ts[cache]=value;
      }
      if(b.ts.blockers&&['block','side:0','side:1'].some(z=>JSON.stringify(state.zones[q.idx+'.'+z])!==JSON.stringify(base.zones[q.idx+'.'+z]))){
        const blockers=g.courtTargets(q).filter(t=>t.key==='block'||t.key.startsWith('side:'));q.ts.blk=blockers.reduce((n,t)=>n+g.parameter(q,t.key,'blk'),0);q.ts.blockers=blockers.map(t=>t.card);
      }
      for(const e of state.events)if(e.type==='move'&&e.from===q.idx+'.deck'&&e.to===q.idx+'.hand')q.newCount[short[e.id]]=(q.newCount[short[e.id]]||0)+1;
      if(complete)for(const lock of state.locks)if(lock.player===q.idx) {
        q.ts.used ||= {};
        for(const [code,def] of Object.entries(byShort))if(def.profiles[0].variants[0].printed.name===lock.name)q.ts.used[code]=1;
      }
    }
    if(complete && !notification && byShort[c].profiles[0].variants[0].printed.type==='event' && byShort[c].profiles[0].limit && basePlayers[p.idx].ts.used?.[c])g.log('同名技能本回合已失效：僅放入 Event 區，不執行效果。');
    if(complete) {
      if(state.turn.phase!==base.turn.phase){g.setRulePhase(Object.keys(phase).find(key=>phase[key]===state.turn.phase)||state.turn.phase);p.ts.keywordJump=state.turn.phase;}
      if(state.keywordOutgoing)p.ts.keywordOutgoing=copy(state.keywordOutgoing);
      g.sharedRulesState={version:1,fingerprint:data.fingerprint,next:state.next,effects:copy(durable(state)),receipts:notification?[...saved.receipts,...notification.events.map(e=>e.receipt)]:saved.receipts};
      g.sharedRulesPending=null;
      if(notification)g.sharedRulesEvents=[];
    } else {
      // The queue may already have popped its current job. Persist the replay
      // baseline and answers too; a raw queue is not an async continuation.
      g.sharedRulesPending=copy({version:1,fingerprint:data.fingerprint,command,...journal,queue:state.queue,effects:state.effects,next:state.next});
    }
    if(!announced&&!notification){g.log(`${p.name} 使用 ${g.src}`);announced=true;}
    for(const e of state.events.slice(eventCursor))if(e.type==='move') {
      const owner=g.players[state.cards[e.id].owner],code=short[e.id];
      if(e.reason==='deck_selection'&&e.to.endsWith('.hand'))g.log(`${owner.name} 公開 ${byShort[code].display_name} 並加入手牌`);
      else if(e.from.endsWith('.deck')&&e.to.endsWith('.hand'))g.log(owner.idx===g.reveal?`${owner.name}（技能）抽到：${byShort[code].display_name}`:`${owner.name}（技能）抽 1 張`,'draw');
      else if(notification&&e.to.endsWith('.event'))g.log(`${owner.name} 將 ${byShort[code].display_name} 放到 Event 區（技能放置）`);
      else if(e.to.endsWith('.hand'))g.log(`${owner.name} 將 ${byShort[code].display_name} 加入手牌`);
      else if(e.to.endsWith('.drop'))g.log(`${owner.name} 棄掉 ${byShort[code].display_name}`);
    }
    for(const e of state.effects.slice(effectCursor)) {
      if(e.kind==='numeric') {const key=state.cards[e.target.id].zone.split('.')[1],slot={player:state.cards[e.target.id].owner,key};g.log(`${g.cardName(g.players[slot.player],slot.key)}（${labels[slot.key]||'側攔'}區）：${labels[e.parameter]} ${e.value<0?'−':'+'}${Math.abs(e.value)}`);}
      else if(e.kind==='rename')g.log(`登場名稱：${displayName(e.name)}（本回合角色有效期間）。`);
      else if(e.kind==='ban'){
        const s=e.scope,period={next_opponent_turn:'下個回合',this_turn:'本回合',this_draw_phase:'本抽牌階段'}[e.duration.kind],role=labels[s.role]||'角色';
        const text=e.action==='play_event'?`不能使用具有 ${(s.play_icons_any||[]).map(p=>labels[p]||'抽牌').join('／')} 圖示的Event`:e.action==='add_hand'?(s.origins?.length===1&&s.origins[0]==='skill'?'不能以技能加入手牌':'抽牌階段不能抽牌或加入手牌'):s.max_count!=null?`${s.entry_origins?.includes('hand')?'從手牌':''}最多登場 ${s.max_count} 人攔網`:`${s.names?.map(displayName).join('／')||s.positions?.join('／')||`原始接球 ${s.printed_receive_gte} 以上角色`}${s.entry_origins?.includes('hand')?'不能從手牌':'不能'}登場${role}`;
        g.log(`效果：${g.players[e.actor].name}${period}，${text}。`);
      }
      else if(e.kind==='invalid')g.log(`效果：${g.players[e.actor].name}${e.duration.kind==='next_opponent_turn'?'下個回合':'本回合'}，符合角色／名稱／圖示／關鍵字條件的技能失效；已結算效果保留。`);
      else if(e.kind==='protect')g.log(e.selector?'本回合符合所屬的場上角色與之後登場角色受到防降保護。':e.ballOwner!==null?'下個對方回合，這個來球的進攻值受到防降保護。':'這位角色的指定參數受到防降保護。');
      else if(e.kind==='keyword')g.log(`效果：${({doshat:'ドシャット',feint:'フェイント',a_pass:'Aパス',blockout:'ブロックアウト',feint_block_ban:'下回合禁止攔網'})[e.keyword]}${e.N?' '+e.N:''}。`);
      else if(e.kind==='watch')g.log(`效果：${g.players[e.actor].name}${e.duration.kind==='next_opponent_turn'?'的下個回合':'本回合'}，${({hand_added:'加牌',character_entry:'符合條件的角色登場',loss:'喊 Loss',block_success:'攔網成功',source_moved:'來源卡移動'})[e.event]}時結算後續效果。`);
    }
    if(state.ball&&state.ball.offense!==ballOff){g.log(`來球進攻 ${state.ball.offense-ballOff<0?'−':'+'}${Math.abs(state.ball.offense-ballOff)} → ${state.ball.offense}`);ballOff=state.ball.offense;}
    for(const entry of state.publicLog.slice(publicLogCursor)){
      if(entry.type==='deck_view'&&entry.visibility==='reveal')g.log(`翻開：${entry.cards.map(c=>byShort[short[c.id]].display_name).join('、')}`);
      if(entry.type==='deck_remainder')g.log(`${entry.result==='no_matching_card_added'?'本次沒有加入手牌；':''}其餘 ${entry.count} 張已放回牌庫${entry.destination==='deck_top'?'頂':'底'}。`);
    }
    eventCursor=state.events.length;effectCursor=state.effects.length;publicLogCursor=state.publicLog.length;
    if(complete&&state.forcedLoss)g.lost(g.players[state.forcedLoss.player],state.forcedLoss.reason);
  }
  function validGuts(req,answer) { return Array.isArray(answer)&&answer.length===req.count&&new Set(answer).size===req.count&&answer.every(id=>req.options.includes(id)); }
  async function ask(req,state,available) {
    const owner=g.players[req.player];
    if(['payment_cards','move_cards','entry'].includes(req.kind)&&req.count>1){
      const selected=[];
      while(selected.length<req.count){
        const options=req.options.filter(id=>!selected.includes(id)&&available.some(a=>selected.every(x=>a.includes(x))&&a.includes(id))).map(id=>({value:id,card:short[id],label:byShort[short[id]].display_name+' · '+short[id]}));
        const answer=await g.ask(owner,{kind:'rulesChoice',timing,prompt:`${owner.name}選擇${req.kind==='payment_cards'?'支付費用':'移動'}的牌（${selected.length+1}／${req.count}）；確認全部後才搬牌`,options});
        if(options.some(o=>o.value===answer))selected.push(answer);
      }
      return available.find(a=>a.length===selected.length&&selected.every(id=>a.includes(id)));
    }
    if(req.kind==='reveal'||req.kind==='revealResult'){
      const options=req.kind==='reveal'?[{value:true,label:`查看牌庫頂 ${req.top_count} 張`}]:req.options.map(id=>({value:id,card:short[id],label:byShort[short[id]].display_name+' · 確認後繼續'}));
      const prompt=req.kind==='reveal'?`請點擊查看牌庫頂 ${req.top_count} 張`:`${req.visibility==='look'?'查看':'翻開'}的卡片${req.eligible_count?'：確認後選擇要加入手牌的牌':'：沒有符合條件的牌，確認後安排回牌庫'}（點任一卡片繼續）`;
      for(;;){const answer=await g.ask(owner,{kind:'rulesChoice',prompt,timing,options});if(options.some(o=>o.value===answer))return req.kind==='reveal'?true:[];}
    }
    if(req.kind==='guts') {
      for(;;){const chosen=await g.ask(owner,{kind:'guts',multi:true,need:req.count,area:req.area||state.cards[req.source].zone.split('.')[1],timing,prompt:`${byShort[short[req.source]].display_name}：付 ${req.count} Guts（最上面的角色不能付）`,options:req.options.map((id,value)=>({value,card:short[id],label:byShort[short[id]].display_name}))});
        const answer=Array.isArray(chosen)?chosen.map(i=>Number.isInteger(i)?req.options[i]:null):null;
        if(validGuts(req,answer))return answer;
      }
    }
    const payment=req.payment?.steps?.[0],isPassive=byShort[short[req.source]]?.profiles[0].activation?.skill_type==='passive';
    const zoneLabel=z=>({serve:'發球區',receive:'接球區',toss:'舉球區',attack:'攻擊區','attack.guts':'攻擊區Guts','receive.guts':'接球區Guts',hand:'手牌',event:'Event區',drop:'棄牌區',deck:'牌庫',block:'攔網角色',court:'場上角色',deck_bottom:'牌庫底',choose_deck_top_or_bottom:'牌庫頂或底'}[z]||z);
    const handDiscard=payment?.pool?.zone==='hand'&&payment.count===1&&payment.destination==='owner.drop';
    const paymentPrompt=(payment?.kind==='move_self'?'是否將這張已被覆蓋的卡送到棄牌區，發動效果？':payment?.kind==='pay_guts'?`是否支付 ${payment.count} Guts，發動登場效果？`:handDiscard?(isPassive?'是否棄 1 張手牌，發動登場效果？':'是否支付棄牌費用，對同一目標追加效果？'):payment?.kind==='mill'?`是否將牌庫頂 ${payment.count_mode==='upto'?'最多 ':''}${payment.count} 張送到棄牌區，發動效果？`:payment?.kind==='move'?`是否將 ${payment.count} 張${zoneLabel(payment.pool.zone)}放到${zoneLabel(payment.destination.split('.').slice(1).join('.'))}，發動效果？`:'是否支付費用，追加效果？')+(req.ineffectiveReason?' ⚠ '+req.ineffectiveReason:'');
    const sourceName=req.kind==='trigger_order'?'效果':byShort[short[req.source]]?.display_name||g.src||'效果';
    const opts=available.map(answer=>{
      if(req.kind==='target') {
        const id=answer[0],slot={player:state.cards[id].owner,key:state.cards[id].zone.split('.')[1]};return {label:`${labels[slot.key]||'側攔'}區 · ${g.cardName(g.players[slot.player],slot.key)} · ${short[id]}`,card:short[id],value:slot.key,answer};
      }
      if(['payment_cards','move_cards','entry'].includes(req.kind)) {const id=answer[0];return {label:`${req.ordering?'依序安排：':''}${byShort[short[id]].display_name} · ${short[id]}`,card:short[id],value:id,answer};}
      if(req.kind==='guts_destination')return {label:`放到${labels[answer]||'側攔'}區的 Guts`,value:answer,answer};
      if(req.kind==='name')return {label:displayName(answer),value:answer,answer};
      if(req.kind==='mode')return {label:req.effectModes?req.modeLabels[answer]:req.keywordOutgoing?`回球進攻 ${answer}`:answer==='deck_top'?'其餘放回牌庫頂':'其餘放到牌庫底',value:answer,answer};
      if(req.kind==='parameter')return {label:labels[answer],value:Object.keys(params).find(key=>params[key]===answer),answer};
      if(req.kind==='mill_count')return {label:answer?`將牌庫頂 ${answer} 張送到棄牌區`:'不送牌',value:answer,answer};
      if(req.kind==='entry_count')return {label:answer?'讓 1 張符合條件的角色登場':'不登場',value:answer,answer};
      if(req.kind==='move_count')return {label:req.selectionAction==='exchange'?answer?'交換兩側各1張':'不交換':answer?`移動 ${answer} 張`:'不移動',value:answer,answer};
      if(req.kind==='payment_count')return {label:`支付 ${answer} 張`,value:answer,answer};
      if(req.kind==='trigger_order') {
        const job=state.queue.find(q=>q.id===answer),name=byShort[short[job.source?.id]]?.display_name||'觸發效果';
        return {label:`先結算 ${name}（${state.queue.indexOf(job)+1}）`,value:answer,answer};
      }
      return {label:req.kind==='optional'?answer?req.effectDescription||'執行登場效果':'不執行':req.kind==='draw_count'?answer?`抽 ${answer} 張`:'不抽牌':answer?payment?.kind==='pay_guts'?`支付 ${payment.count} Guts`:payment?.destination==='self.event'?'選 1 張事件放到 Event 區':handDiscard?'棄 1 張符合條件的手牌，追加效果':'支付費用並發動':'不追加',value:answer,answer};
    });
    const kind=req.kind==='parameter'?'parameter':req.kind==='target'?'target':['activate_payment','optional'].includes(req.kind)?'skill':'rulesChoice';
    const fromZones=[...new Set(req.options.filter(id=>typeof id==='string'&&state.cards[id]).map(id=>state.cards[id].zone.split('.')[1]))];
    const fromLabel=fromZones.length===1?({event:'Event 區',drop:'棄牌區',hand:'手牌',deck:'牌庫'}[fromZones[0]]||zoneLabel(fromZones[0])):'來源區';
    const movePrompt=`${req.selectionAction==='exchange'?'交換：':''}從${fromLabel}選擇 1 張，放到${zoneLabel(req.destination?.split('.').slice(1).join('.'))}`;
    const prompt=sourceName+'：'+({entry:'選擇要由效果登場的角色',entry_count:'是否讓符合條件的角色登場？',target:'選擇場上 1 位角色',draw_count:'選擇抽牌數量',mill_count:'選擇牌庫頂要送到棄牌區的張數（先選張數再公開）',payment_count:'選擇支付Guts數量',activate_payment:paymentPrompt,optional:req.effectDescription?'是否執行：'+req.effectDescription+'？':'是否執行這個登場效果？',payment_cards:req.destination==='self.event'?'選擇 1 張事件放到 Event 區':fromZones[0]==='hand'&&req.destination==='owner.drop'?'選擇 1 張符合條件的手牌棄掉':'支付費用：'+movePrompt,parameter:`選擇這位角色要增加的參數${req.target?`（${g.cardName(g.players[state.cards[req.target.id].owner],state.cards[req.target.id].zone.split('.')[1])}・${labels[state.cards[req.target.id].zone.split('.')[1]]||'側攔'}區）`:''}`,guts_destination:'選擇放置Guts的區域',move_count:req.selectionAction==='exchange'?'是否交換兩側各1張？':'選擇移動數量',mode:req.effectModes?'選擇1項效果':req.keywordOutgoing?'選擇結束回合的回球進攻值':'其餘的牌放到哪裡？',move_cards:req.ordering?'安排其餘牌的順序（先選的會先抽到）':req.destination?.endsWith('.hand')?`從${fromLabel}選擇 1 張加入手牌`:fromZones[0]==='hand'&&req.destination==='owner.drop'?(isPassive?'請選 1 張手牌棄掉':'非抽牌加入手牌後，請選 1 張手牌棄掉'):movePrompt,trigger_order:'選擇同時觸發的結算順序'}[req.kind]);
    let invalid=false;
    for(;;) {
      const value=await g.ask(owner,{kind,prompt:prompt+(invalid?'（請重新選擇有效選項）':''),timing,ctx:{card:short[req.source],...(req.effectModes?{effectModes:true}:{}),...(req.keywordOutgoing?{keywordOutgoing:true}:{}),...(req.ineffectiveReason?{ineffectiveReason:req.ineffectiveReason}:{}),...(req.kind==='parameter'?{target:state.cards[req.target?.id||req.source]?.zone.split('.')[1]}:{}),...(state.cards[req.source]?.zone===req.player+'.receive'&&g.ball?{need:g.ball.off-g.parameter(owner,'receive','rcv')}: {})},options:opts.map(({answer,...o})=>o)});
      const option=opts.find(o=>o.value===value);if(option)return option.answer;invalid=true;
    }
  }
  return {entryPreview:(code,area,param)=>{
    k.restore(base);const id=k.zone(p.idx,'hand').find(id=>short[id]===code);
    if(!id)throw new Error('Preview requires an actual hand card');
    // Preview the base and generated watches; optional entry costs remain the player's decision.
    k._enqueuePassive=()=>{};
    k.state.turn.phase=area;k.choose=req=>['target','payment_cards','move_cards','guts','entry'].includes(req.kind)?[req.options[0]]:req.options[0];
    k.enter(id,area);
    return {value:k.parameter(id,param),protected:k._protected(k.reference(id),param,{controller:p.idx})};
  },possible:()=>possible([]),run:()=>settle({kernel:k,invoke,ask,publish,options:(req,state,answers)=>notification?choices(req):choices(req).filter(answer=>possible([...answers,{request:req,answer}])),validate:(req,answer,available)=>req.kind==='guts'?validGuts(req,answer):available.some(value=>JSON.stringify(value)===JSON.stringify(answer))})};
}
function canPlay(g,p,c,timing) {
  if(g.sharedRulesPending||!handles(c)||g.turnP!==p||!p.hand.includes(c))return false;
  const profile=byShort[c].profiles[0];
  const window=profile.activation.activation_phases.includes(phase[timing])||phase[timing]==='receive'&&profile.practice_override?.extra_window==='before_receive_judgment';
  if(!window||profile.variants[0].printed.type!=='event'&&profile.limit&&p.ts.used?.[c])return false;
  return transaction(g,p,c,timing).possible();
}
async function resolve(g,p,c,timing) { return transaction(g,p,c,timing).run(); }
async function handAdded(g,p,id,revision) {
  assertReady(g);
  if(!stored(g).effects.some(e=>e.kind==='watch'&&e.event==='hand_added'&&e.actor===p.idx&&active(e,g)))return;
  const receipt=`hand:${g.turnNo}:${p.idx}:${id}:${revision}`;
  if(stored(g).receipts.includes(receipt)||g.sharedRulesEvents?.some(e=>e.receipt===receipt))return;
  if(revision!==identity.ensure(g).revision)throw new Error('Stale hand-add notification');
  (g.sharedRulesEvents ||= []).push({type:'hand_added',player:p.idx,card:id,operation:'add_hand',receipt});
  if(!g.sharedRulesDepth)return flushHandEvents(g);
}
function queueHost(g,event){
  if(!stored(g).effects.some(e=>e.kind==='watch'&&active(e,g)&&e.actor===event.player&&e.event===event.type&&(event.type!=='source_moved'||e.source?.id===event.card)))return;
  if(stored(g).receipts.includes(event.receipt)||g.sharedRulesEvents?.some(e=>e.receipt===event.receipt))return;
  (g.sharedRulesEvents ||= []).push(event);
}
function sourceMoved(g,id,from,to,revision){const [player,raw]=to.split('.'),zone=raw==='ev'?'event':raw,old=from.split('.')[1]==='ev'?'event':from.split('.')[1];if(old===zone)return;queueHost(g,{type:'source_moved',player:+player,card:id,from_zone:old,to_zone:zone,receipt:`move:${g.turnNo}:${id}:${revision}`});}
function drawn(g,p,id,revision){
  if(!stored(g).effects.some(e=>e.kind==='watch'&&e.event==='hand_added'&&e.actor===p.idx&&active(e,g)&&!(e.filters.exclude_operations||[]).includes('draw')))return;
  queueHost(g,{type:'hand_added',player:p.idx,card:id,operation:'draw',receipt:`draw:${g.turnNo}:${id}:${revision}`});
}
async function judgment(g,p,type,extra={}){
  if(type==='loss'){g.sharedRulesPending=null;g.sharedRulesEvents=[];}
  queueHost(g,{type,player:p.idx,...extra,receipt:`${type}:${g.rallyNo}:${g.turnNo}:${p.idx}`});
  await flushHandEvents(g);
}
function active(e,g) { if(e.duration.kind==='this_draw_phase'&&g.rulePhase!=='drw')return false;return e.duration.kind==='next_opponent_turn'?e.duration.activeTurn===g.turnNo:e.duration.turn===g.turnNo; }
function protectedParameter(g,p,key,param) {
  const ref=g.roleReference(p,key);
  return !!ref&&stored(g).effects.some(e=>e.kind==='protect'&&active(e,g)&&(e.parameter==='all'||e.parameter===params[param])&&(e.selector?((e.selector.actor==='opponent'?1-e.controller:e.controller)===p.idx&&g.courtTargets(p).some(t=>t.key===key&&(e.selector.filters.tags||[]).every(tag=>library.card(t.card).schoolTags.includes(tag)))):e.targets.some(r=>g.sameReference(r,ref))));
}
function protectedBall(g,owner) {return stored(g).effects.some(e=>e.kind==='protect'&&active(e,g)&&e.ballOwner===owner&&['all','offense'].includes(e.parameter));}
function entryPreview(g,p,code,area,param) {
  const covering=!!p.top(area)&&handles(p.top(area))&&byShort[p.top(area)].profiles[0].activation.trigger?.event==='source_covered';
  if(!covering&&!stored(g).effects.some(e=>active(e,g)&&(e.kind==='watch'&&e.event==='character_entry'&&e.actor===p.idx||e.kind==='protect'&&e.selector&&(e.selector.actor==='opponent'?1-e.controller:e.controller)===p.idx)))return {value:byShort[code].profiles[0].variants[0].printed.parameters[params[param]],protected:false};
  return transaction(g,p,null,g.rulePhase||'drw',{events:[]}).entryPreview(code,area,params[param]);
}
async function charactersEntered(g,p,entries) {
  assertReady(g);
  for(const {key,origin='hand'}of entries)if(key==='block'||key.startsWith('side:')){const ref=g.roleReference(p,key);if(!ref)throw new Error('Missing actual blocker receipt');const receipt=`${g.turnNo}:${p.idx}:${ref.id}:${ref.incarnation}:${key}`;p.ts.blockEntryReceipts ||= [];if(!p.ts.blockEntryReceipts.includes(receipt))p.ts.blockEntryReceipts.push(receipt);p.ts.blockEntryOrigins ||= {};p.ts.blockEntryOrigins[receipt]=origin;}
  const physical=identity.ensure(g);for(const {key,origin='hand',reason='rule',coveredCharacter=null,entrySkillName=null}of entries){const ref=g.roleReference(p,key);if(!ref)throw Error('Missing actual entry reference');const card=physical.cards[ref.id];if(card.entryIncarnation!==ref.incarnation||card.entryTurn!==g.turnNo)Object.assign(card,{entryIncarnation:ref.incarnation,entryOrigin:origin,entryReason:reason,entryTurn:g.turnNo,coveredCharacter:copy(coveredCharacter),entrySkillName});}
  const keywordEntry=stored(g).effects.some(e=>e.kind==='keyword'&&active(e,g)&&e.actor===p.idx&&['a_pass','blockout'].includes(e.keyword));
  const passive=entries.some(({key})=>{const code=g.courtTargets(p).find(t=>t.key===key)?.card;return byShort[code]?.profiles[0].activation?.skill_type==='passive';});
  const covered=entries.some(({key,coveredSource})=>{const ids=physical.zones[p.idx+'.'+key],id=coveredSource?.id??ids?.at(-2);return id&&handles(physical.cards[id].code)&&byShort[physical.cards[id].code].profiles[0].activation.trigger?.event==='source_covered';});
  const observer=g.players.some(q=>g.courtTargets(q).some(t=>handles(t.card)&&byShort[t.card].profiles[0].activation.trigger?.event==='character_entry'));
  if(!passive&&!covered&&!observer&&!keywordEntry&&!stored(g).effects.some(e=>active(e,g)&&(e.kind==='watch'&&e.event==='character_entry'&&e.actor===p.idx||e.kind==='protect'&&e.selector&&(e.selector.actor==='opponent'?1-e.controller:e.controller)===p.idx)))return;
  // Payments and draws change move revision; a repeated entry is still the same role instance.
  identity.ensure(g);
  for(const {key,origin='hand',reason='rule',coveredCharacter=null,coveredSource=null,entrySkillName=null,entry_keyword_family=null} of entries) {
    const character=g.roleReference(p,key),receipt=`entry:${g.turnNo}:${p.idx}:${character.id}:${character.incarnation}:${key}`;
    if(stored(g).receipts.includes(receipt)||g.sharedRulesEvents?.some(e=>e.receipt===receipt))continue;
    const role=key==='block'?'center_blocker':key.startsWith('side:')?'side_blocker':key;
    const previous=coveredSource?.id??physical.zones[p.idx+'.'+key]?.at(-2),coverage=previous?{id:previous,incarnation:physical.cards[previous].incarnation}:null;
    const passiveSources=g.players.flatMap(q=>g.courtTargets(q).filter(t=>handles(t.card)&&byShort[t.card].profiles[0].activation.trigger?.event==='character_entry').map(t=>({source:g.roleReference(q,t.key),role:t.key==='block'?'center_blocker':t.key.startsWith('side:')?'side_blocker':t.key})));
    (g.sharedRulesEvents ||= []).push({type:'character_entry',player:p.idx,card:character.id,character,role,origin,reason,receipt,coveredCharacter,coveredSource:coverage,coveredRole:coverage?role:null,entrySkillName,entry_keyword_family,passiveSources,effectiveName:norm(g.cardName(p,key))});
  }
  if(!g.sharedRulesDepth)return flushHandEvents(g);
}
async function flushHandEvents(g) {
  if(!g.sharedRulesEvents?.length)return;
  return transaction(g,g.turnP,null,g.rulePhase||'drw',{events:copy(g.sharedRulesEvents)}).run();
}
async function legacyEffect(g,run) {
  g.sharedRulesDepth=(g.sharedRulesDepth||0)+1;let complete=false;
  try {const result=await run();complete=true;return result;}
  finally {g.sharedRulesDepth--;if(complete&&!g.sharedRulesDepth)await flushHandEvents(g);}
}
async function outgoing(g,p,type,off){
 if(!p.ts.keywordOutgoing&&!stored(g).effects.some(e=>e.kind==='keyword'&&active(e,g)&&e.actor===p.idx&&['doshat','feint'].includes(e.keyword)))return {type,off};
 const result=await transaction(g,p,null,g.rulePhase||'atk',{events:[],outgoing:{kind:type,offense:off}}).run();p.ts.keywordResolved={type:result.kind,off:result.offense};return p.ts.keywordResolved;
}
const api={protectedBall,skillAllowed,blockGroupAllowed,endDrawPhase,eventAllowed,entryNames,distinctNameOptions,outgoing,sourceMoved,drawn,judgment,flushHostEvents:flushHandEvents,permission,entryAllowed,blockEntered,charactersEntered,entryPreview,protectedParameter,handles,canPlay,resolve,assertReady,handAdded,legacyEffect,beginTurn,finishTurn,loss,approvals:[...approved]};
if(node)module.exports=api;else root.BreakRulesLegacy=api;
})(typeof globalThis!=='undefined'?globalThis:this);
