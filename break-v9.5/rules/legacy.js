/* Host settlement adapter for hash-pinned finite skills and admitted watches.
   Only pinned self-entry passives enter this queue; other skills stay legacy. */
(function(root) {
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const {Kernel}=node?require('./core'):root.BreakRulesCore;
const {attempt,settle}=node?require('./decisions'):root.BreakRulesDecisions;
const identity=node?require('./identity'):root.BreakCardIdentity;
const data=node?require('./runtime-data.json'):root.BreakRulesData;
const copy=x=>JSON.parse(JSON.stringify(x));
const phase={srv:'serve',drw:'draw',rcv:'receive',tos:'toss',atk:'attack',blk:'block'};
const params={srv:'serve',blk:'block',rcv:'receive',tos:'toss',atk:'attack'};
const labels={serve:'發球',block:'攔網',receive:'接球',toss:'舉球',attack:'攻擊'};
const norm=s=>s.normalize('NFKC').replace(/\s/g,'');
const byShort=Object.fromEntries(data.catalog.cards.map(c=>[c.card_no.replace(/^HV-?/,''),c]));
const approved=new Set(data.approved);
function handles(c) { return approved.has(byShort[c]?.profiles[0].profile_id); }
function stored(g) {
  const s=g.sharedRulesState;
  if(s&&(s.version!==1||s.fingerprint!==data.fingerprint))throw new Error('Shared watcher data version mismatch');
  return s||{version:1,fingerprint:data.fingerprint,next:1,effects:[],receipts:[]};
}
const watchSignatures=new Set(),banSignatures=new Set();
function signature(e) { return JSON.stringify([e.event,typeof e.duration==='string'?e.duration:e.duration.kind,e.filters||{},e.then,e.remaining_uses??e.remaining??null]); }
function banSignature(e) {return JSON.stringify([e.action,typeof e.duration==='string'?e.duration:e.duration.kind,e.scope]);}
(function walk(n){if(!n||typeof n!=='object')return;if(n.kind==='watch')watchSignatures.add(signature(n));if(n.kind==='ban_action')banSignatures.add(banSignature(n));for(const v of Object.values(n))if(v&&typeof v==='object')walk(v);})(data.catalog);
function persistent(e) { return ['watch','protect','ban'].includes(e.kind); }
function admitEffect(e) {
  if(e.kind==='ban'&&e.duration.kind==='next_opponent_turn'&&banSignatures.has(banSignature(e)))return;
  const admittedFamily=e.event==='hand_added'&&e.duration.kind==='next_opponent_turn'||e.event==='character_entry'&&['this_turn','next_opponent_turn'].includes(e.duration.kind);
  if(e.kind==='watch'&&admittedFamily&&watchSignatures.has(signature(e)))return;
  if(e.kind==='protect'&&e.parameter==='all'&&e.duration.kind==='this_turn'&&e.ballOwner===null&&e.targets.length===1&&e.targets.every(r=>typeof r.id==='string'&&Number.isInteger(r.incarnation)))return;
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
  if(!effects.some(e=>e.kind==='ban'&&active(e,g)))return {allowed:true};
  const k=new Kernel({catalog:data.catalog,ruleIds:data.ruleIds,fingerprint:data.fingerprint,mode:'live'});
  k.state.turn={id:Math.max(1,g.turnNo),player:g.turnP?.idx??action.player,phase:phase[g.rulePhase]||'draw',step:'free'};
  k.state.effects=effects.filter(e=>e.kind==='ban');return k.permission(action);
}
function blockEntered(g,p) {return g.turnP===p&&!p.ts.finished?(p.ts.blockEntryReceipts?.length||0):0;}
function entryAllowed(g,p,code,area,{origin='rule',entryOrigin='hand',entryCount=null}={}) {
  if(entryCount===null)entryCount=area==='block'||area.startsWith('side:')?blockEntered(g,p)+1:1;
  const printed=byShort[code]?.profiles[0].variants[0].printed;
  return !!printed&&permission(g,{action:'enter_character',player:p.idx,origin,entryOrigin,entryCount,role:area==='block'?'center_blocker':area.startsWith('side:')?'side_blocker':area,printed,name:printed.name}).allowed;
}
function transaction(g,p,c,timing,notification=null) {
  if(g.sharedRulesPending)throw new Error('A shared settlement is already awaiting a choice');
  if(!notification&&(!handles(c)||!p.hand.includes(c)||g.turnP!==p))throw new Error('Not an admitted settlement');
  if(!notification&&byShort[c].profiles[0].limit&&p.ts.used?.[c])throw new Error('Same-name skill already used this turn');
  const saved=copy(stored(g));
  const k=new Kernel({catalog:data.catalog,ruleIds:data.ruleIds,fingerprint:data.fingerprint,mode:'live',practiceDrawBeforeReceive:true});
  const physical=identity.snapshot(g);
  k.state.turn={id:Math.max(1,g.turnNo),player:g.turnP?.idx??p.idx,phase:phase[timing],step:'free',blockEntries:g.players.map(q=>blockEntered(g,q))};
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
  const source=notification?null:k.zone(p.idx,'hand').find(id=>short[id]===c),base=k.snapshot();
  const command=notification?{kind:'host_events',...notification}:{kind:'skill',player:p.idx,source,timing};
  const invoke=notification?kernel=>kernel.notifyHostEvents(notification.events):kernel=>kernel.card(source).printed.type==='event'?kernel.playEvent(source):kernel.useSkill(source);
  function choices(req) {
    if(req.kind==='guts')return [req.options.slice(0,req.count)];
    if(['target','payment_cards','move_cards'].includes(req.kind)) {
      if(req.count!==1)throw new Error('Adapter requires single physical-card choices');
      return req.options.map(id=>[id]);
    }
    if(['draw_count','move_count','parameter','activate_payment','optional','trigger_order'].includes(req.kind))return [...req.options].reverse();
    throw new Error('Decision is outside migration scope: '+req.kind);
  }
  // A legal event needs at least one resolving effect. Explore the same rules,
  // also removing a zero-draw choice when it would leave the entire event inert.
  function possible(answers, budget={left:256}) {
    if(--budget.left<0)throw new Error('Admission search limit reached');
    let step;
    try {step=attempt(k,base,invoke,answers);}
    catch(e) {if(e.code==='ILLEGAL_ACTION'||e.code==='REQUIRES_REVIEW'&&e.message==='OPEN-EVENT-NO-CHANGE')return false;throw e;}
    if(!step.boundary)return step.result.performed||step.result.invalid;
    const req=step.boundary.request;
    return choices(req).some(answer=>possible([...answers,{request:req,answer}],budget));
  }
  const savedIds=new Set(saved.effects.map(e=>e.id));
  const durable=state=>state.effects.filter((e,i)=>persistent(e)&&(savedIds.has(e.id)||i>=base.effects.length));
  let eventCursor=0,effectCursor=base.effects.length,announced=false,ballOff=base.ball?.offense;
  function publish(state,complete,journal) {
    for(const e of durable(state))admitEffect(e);
    const next=copy(physical);
    for(const key of Object.keys(next.zones)) {
      const [player,zone]=key.split('.');
      next.zones[key]=zone==='sides'?[...state.zones[player+'.side:0'],...state.zones[player+'.side:1']]:[...state.zones[player+'.'+(zone==='ev'?'event':zone)]];
      for(const id of next.zones[key]){next.cards[id].zone=key;next.cards[id].incarnation=state.cards[id].incarnation;}
    }
    next.revision=physical.revision+state.events.filter(e=>e.type==='move').length;
    identity.restore(g,next);
    if(state.ball)g.ball.off=state.ball.offense;
    // Projection always starts from the same host checkpoint, never from an earlier preview.
    for(const q of g.players) {
      const b=basePlayers[q.idx],codes=z=>state.zones[q.idx+'.'+z].map(id=>short[id]);
      for(const [host,z] of Object.entries({hand:'hand',deck:'deck',drop:'drop',ev:'event',sets:'sets'}))q[host]=codes(z);
      q.effects=copy(b.effects);q.ts=copy(b.ts);q.newCount=copy(b.newCount);
      for(const id of Object.keys(slots)) {
        const slot=slots[id];if(slot.player!==q.idx)continue;
        for(const [old,param] of Object.entries(params)) {
          const delta=state.effects.slice(base.effects.length).filter(e=>e.kind==='numeric'&&e.target.id===id&&e.parameter===param).reduce((n,e)=>n+e.value,0);
          if(!delta)continue;
          if(q.effects[slot.key]?.card!==short[id] || q.effects[slot.key].ref && (q.effects[slot.key].ref.id!==id||q.effects[slot.key].ref.incarnation!==state.cards[id].incarnation))q.effects[slot.key]={card:short[id],ref:{id,incarnation:state.cards[id].incarnation},mods:{}};
          const fx=q.effects[slot.key];fx.mods ||= {};fx.mods[old]=(fx.mods[old]||0)+delta;
          const active=g.activeParameter(q,slot.key,old);if(active&&q.ts[active]!=null)q.ts[active]+=delta;
        }
      }
      for(const e of state.events)if(e.type==='move'&&e.from===q.idx+'.deck'&&e.to===q.idx+'.hand')q.newCount[short[e.id]]=(q.newCount[short[e.id]]||0)+1;
      if(complete)for(const lock of state.locks)if(lock.player===q.idx) {
        q.ts.used ||= {};
        for(const [code,def] of Object.entries(byShort))if(def.profiles[0].variants[0].printed.name===lock.name)q.ts.used[code]=1;
      }
    }
    if(complete) {
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
      if(e.from.endsWith('.deck')&&e.to.endsWith('.hand'))g.log(owner.idx===g.reveal?`${owner.name}（技能）抽到：${byShort[code].display_name}`:`${owner.name}（技能）抽 1 張`,'draw');
      else if(notification&&e.to.endsWith('.event'))g.log(`${owner.name} 將 ${byShort[code].display_name} 放到 Event 區（技能放置）`);
      else if(e.to.endsWith('.hand'))g.log(`${owner.name} 將 ${byShort[code].display_name} 加入手牌`);
      else if(e.to.endsWith('.drop'))g.log(`${owner.name} 棄掉 ${byShort[code].display_name}`);
    }
    for(const e of state.effects.slice(effectCursor)) {
      if(e.kind==='numeric') {const slot=slots[e.target.id];g.log(`${g.cardName(g.players[slot.player],slot.key)}（${labels[slot.key]||'側攔'}區）：${labels[e.parameter]} ${e.value<0?'−':'+'}${Math.abs(e.value)}`);}
      else if(e.kind==='ban')g.log(`效果：${g.players[e.actor].name}下個回合，${e.action==='add_hand'?'不能用技能加入手牌':e.scope.printed_receive_gte!=null?`原始接球 ${e.scope.printed_receive_gte} 以上角色不能登場接球`:`最多 ${e.scope.max_count} 人攔網`}。`);
      else if(e.kind==='protect')g.log('登場效果：這位角色本回合的數值不會被降低。');
      else if(e.kind==='watch')g.log(e.event==='hand_added'?`效果：${g.players[e.actor].name}的下個回合，非抽牌加入手牌後需棄 1 張。`:e.duration.kind==='this_turn'?'效果：本回合符合條件的角色登場時，接球 +2，數值不會被降低。':`效果：${g.players[e.actor].name}下個回合的接球角色登場時，接球 −1。`);
    }
    if(state.ball&&state.ball.offense!==ballOff){g.log(`來球進攻 ${state.ball.offense-ballOff<0?'−':'+'}${Math.abs(state.ball.offense-ballOff)} → ${state.ball.offense}`);ballOff=state.ball.offense;}
    eventCursor=state.events.length;effectCursor=state.effects.length;
  }
  function validGuts(req,answer) { return Array.isArray(answer)&&answer.length===req.count&&new Set(answer).size===req.count&&answer.every(id=>req.options.includes(id)); }
  async function ask(req,state,available) {
    const owner=g.players[req.player];
    if(req.kind==='guts') {
      for(;;){const chosen=await g.ask(owner,{kind:'guts',multi:true,need:req.count,area:state.cards[req.source].zone.split('.')[1],timing,prompt:`${byShort[short[req.source]].display_name}：付 ${req.count} Guts（最上面的角色不能付）`,options:req.options.map((id,value)=>({value,card:short[id],label:byShort[short[id]].display_name}))});
        const answer=Array.isArray(chosen)?chosen.map(i=>Number.isInteger(i)?req.options[i]:null):null;
        if(validGuts(req,answer))return answer;
      }
    }
    const payment=req.payment?.steps?.[0],isPassive=byShort[short[req.source]]?.profiles[0].activation?.skill_type==='passive';
    const paymentPrompt=payment?.kind==='pay_guts'?`是否支付 ${payment.count} Guts，發動登場效果？`:payment?.destination==='self.event'?'是否將 1 張事件放到 Event 區，發動登場效果？':isPassive?'是否棄 1 張手牌，發動登場效果？':'是否支付棄牌費用，對同一目標追加效果？';
    const sourceName=req.kind==='trigger_order'?'效果':byShort[short[req.source]]?.display_name||g.src||'效果';
    const opts=available.map(answer=>{
      if(req.kind==='target') {
        const id=answer[0],slot=slots[id];return {label:`${labels[slot.key]||'側攔'}區 · ${g.cardName(g.players[slot.player],slot.key)} · ${short[id]}`,card:short[id],value:slot.key,answer};
      }
      if(['payment_cards','move_cards'].includes(req.kind)) {const id=answer[0];return {label:`${byShort[short[id]].display_name} · ${short[id]}`,card:short[id],value:id,answer};}
      if(req.kind==='parameter')return {label:labels[answer],value:Object.keys(params).find(key=>params[key]===answer),answer};
      if(req.kind==='move_count')return {label:answer?`選擇 ${answer} 張加入手牌`:'不加入手牌',value:answer,answer};
      if(req.kind==='trigger_order') {
        const job=state.queue.find(q=>q.id===answer),name=byShort[short[job.source?.id]]?.display_name||'觸發效果';
        return {label:`先結算 ${name}（${state.queue.indexOf(job)+1}）`,value:answer,answer};
      }
      return {label:req.kind==='optional'?answer?'執行登場效果':'不執行':req.kind==='draw_count'?answer?`抽 ${answer} 張`:'不抽牌':answer?payment?.kind==='pay_guts'?`支付 ${payment.count} Guts`:payment?.destination==='self.event'?'選 1 張事件放到 Event 區':'棄 1 張符合條件的手牌，追加效果':'不追加',value:answer,answer};
    });
    const kind=req.kind==='parameter'?'parameter':req.kind==='target'?'target':['activate_payment','optional'].includes(req.kind)?'skill':'rulesChoice';
    const fromZones=[...new Set(req.options.filter(id=>typeof id==='string'&&state.cards[id]).map(id=>state.cards[id].zone.split('.')[1]))];
    const fromLabel=fromZones.length===1?({event:'Event 區',drop:'棄牌區',hand:'手牌',deck:'牌庫'}[fromZones[0]]||'來源區'):'來源區';
    const prompt=sourceName+'：'+({target:'選擇場上 1 位角色',draw_count:'選擇抽牌數量',activate_payment:paymentPrompt,optional:'是否執行這個登場效果？',payment_cards:req.destination==='self.event'?'選擇 1 張事件放到 Event 區':'選擇 1 張符合條件的手牌棄掉',parameter:`選擇這位角色要增加的參數${req.target?`（${g.cardName(g.players[slots[req.target.id].player],slots[req.target.id].key)}・${labels[slots[req.target.id]?.key]||'側攔'}區）`:''}`,move_count:'最多選 1 張符合條件的牌加入手牌',move_cards:req.destination?.endsWith('.hand')?`從${fromLabel}選擇 1 張加入手牌`:isPassive?'請選 1 張手牌棄掉':'非抽牌加入手牌後，請選 1 張手牌棄掉',trigger_order:'選擇同時觸發的結算順序'}[req.kind]);
    let invalid=false;
    for(;;) {
      const value=await g.ask(owner,{kind,prompt:prompt+(invalid?'（請重新選擇有效選項）':''),timing,ctx:{card:short[req.source],...(req.kind==='parameter'?{target:slots[req.target?.id||req.source]?.key}:{}),...(state.cards[req.source]?.zone===req.player+'.receive'&&g.ball?{need:g.ball.off-g.parameter(owner,slots[req.source].key,'rcv')}: {})},options:opts.map(({answer,...o})=>o)});
      const option=opts.find(o=>o.value===value);if(option)return option.answer;invalid=true;
    }
  }
  return {entryPreview:(code,area,param)=>{
    k.restore(base);const id=k.zone(p.idx,'hand').find(id=>short[id]===code);
    if(!id)throw new Error('Preview requires an actual hand card');
    // Preview the base and generated watches; optional entry costs remain the player's decision.
    k._enqueuePassive=()=>{};
    k.state.turn.phase=area;k.choose=req=>req.kind==='trigger_order'?req.options[0]:[req.options[0]];
    k.enter(id,area);
    return {value:k.parameter(id,param),protected:k._protected(k.reference(id),param,{controller:p.idx})};
  },possible:()=>possible([]),run:()=>settle({kernel:k,invoke,ask,publish,options:(req,state,answers)=>notification?choices(req):choices(req).filter(answer=>possible([...answers,{request:req,answer}])),validate:(req,answer,available)=>req.kind==='guts'?validGuts(req,answer):available.some(value=>JSON.stringify(value)===JSON.stringify(answer))})};
}
function canPlay(g,p,c,timing) {
  if(g.sharedRulesPending||!handles(c)||g.turnP!==p||!p.hand.includes(c))return false;
  const profile=byShort[c].profiles[0];
  const window=profile.activation.activation_phases.includes(phase[timing])||phase[timing]==='receive'&&profile.practice_override?.extra_window==='before_receive_judgment';
  if(!window||profile.limit&&p.ts.used?.[c])return false;
  return transaction(g,p,c,timing).possible();
}
async function resolve(g,p,c,timing) { return transaction(g,p,c,timing).run(); }
async function handAdded(g,p,id,revision) {
  assertReady(g);
  if(!stored(g).effects.some(e=>e.kind==='watch'&&e.event==='hand_added'&&e.actor===p.idx&&e.duration.activeTurn===g.turnNo))return;
  const receipt=`hand:${g.turnNo}:${p.idx}:${id}:${revision}`;
  if(stored(g).receipts.includes(receipt)||g.sharedRulesEvents?.some(e=>e.receipt===receipt))return;
  if(revision!==identity.ensure(g).revision)throw new Error('Stale hand-add notification');
  (g.sharedRulesEvents ||= []).push({type:'hand_added',player:p.idx,card:id,operation:'add_hand',receipt});
  if(!g.sharedRulesDepth)return flushHandEvents(g);
}
function active(e,g) { return e.duration.kind==='next_opponent_turn'?e.duration.activeTurn===g.turnNo:e.duration.turn===g.turnNo; }
function protectedParameter(g,p,key,param) {
  const ref=g.roleReference(p,key);
  return stored(g).effects.some(e=>e.kind==='protect'&&active(e,g)&&(e.parameter==='all'||e.parameter===params[param])&&e.targets.some(r=>g.sameReference(r,ref)));
}
function entryPreview(g,p,code,area,param) {
  if(!stored(g).effects.some(e=>e.kind==='watch'&&e.event==='character_entry'&&e.actor===p.idx&&active(e,g)))return {value:byShort[code].profiles[0].variants[0].printed.parameters[params[param]],protected:false};
  return transaction(g,p,null,g.rulePhase||'drw',{events:[]}).entryPreview(code,area,params[param]);
}
async function charactersEntered(g,p,entries) {
  assertReady(g);
  for(const {key}of entries)if(key==='block'||key.startsWith('side:')){const ref=g.roleReference(p,key);if(!ref)throw new Error('Missing actual blocker receipt');const receipt=`${g.turnNo}:${p.idx}:${ref.id}:${ref.incarnation}:${key}`;p.ts.blockEntryReceipts ||= [];if(!p.ts.blockEntryReceipts.includes(receipt))p.ts.blockEntryReceipts.push(receipt);}
  const passive=entries.some(({key})=>{const code=g.courtTargets(p).find(t=>t.key===key)?.card;return byShort[code]?.profiles[0].activation?.skill_type==='passive';});
  if(!passive&&!stored(g).effects.some(e=>e.kind==='watch'&&e.event==='character_entry'&&e.actor===p.idx&&active(e,g)))return;
  const revision=identity.ensure(g).revision;
  for(const {key,origin='hand',reason='rule'} of entries) {
    const character=g.roleReference(p,key),receipt=`entry:${g.turnNo}:${p.idx}:${character.id}:${character.incarnation}:${revision}`;
    if(stored(g).receipts.includes(receipt)||g.sharedRulesEvents?.some(e=>e.receipt===receipt))continue;
    const role=key==='block'?'center_blocker':key.startsWith('side:')?'side_blocker':key;
    (g.sharedRulesEvents ||= []).push({type:'character_entry',player:p.idx,card:character.id,character,role,origin,reason,receipt});
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
const api={permission,entryAllowed,blockEntered,charactersEntered,entryPreview,protectedParameter,handles,canPlay,resolve,assertReady,handAdded,legacyEffect,beginTurn,finishTurn,loss,approvals:[...approved]};
if(node)module.exports=api;else root.BreakRulesLegacy=api;
})(typeof globalThis!=='undefined'?globalThis:this);
