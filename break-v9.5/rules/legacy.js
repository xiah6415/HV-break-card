/* Host settlement adapter with persistent, admitted hand-add watches.
   Other event families and the full entry lifecycle remain unintegrated. */
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
function admitWatch(e) {
  const steps=e.then?.steps,move=steps?.[0];
  if(e.kind!=='watch'||e.event!=='hand_added'||e.duration.kind!=='next_opponent_turn'||JSON.stringify(e.filters)!==JSON.stringify({exclude_operations:['draw']})||e.then.kind!=='sequence'||steps.length!==1||move.kind!=='move'||move.pool.actor!=='opponent'||move.pool.zone!=='hand'||Object.keys(move.pool.filters).length||move.destination!=='owner.drop'||move.count!==1||move.count_mode!=='exact')throw new Error('Unintegrated persistent watcher mechanism');
}
function assertReady(g) {
  if(g.sharedRulesPending)throw new Error('A shared settlement is already awaiting a choice');
  for(const e of stored(g).effects)admitWatch(e);
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
function transaction(g,p,c,timing,notification=null) {
  if(g.sharedRulesPending)throw new Error('A shared settlement is already awaiting a choice');
  if(!notification&&(!handles(c)||!p.hand.includes(c)||g.turnP!==p))throw new Error('Not an admitted settlement');
  if(!notification&&byShort[c].profiles[0].limit&&p.ts.used?.[c])throw new Error('Same-name skill already used this turn');
  const saved=copy(stored(g));
  const k=new Kernel({catalog:data.catalog,ruleIds:data.ruleIds,fingerprint:data.fingerprint,mode:'live'});
  const physical=identity.snapshot(g);
  k.state.turn={id:Math.max(1,g.turnNo),player:g.turnP?.idx??p.idx,phase:phase[timing],step:'free'};
  k.state.next=Math.max(k.state.next,saved.next);
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
  // Keep only the admitted event family. Imported legacy numeric effects stay
  // in the host; persisting them here too would apply every bonus twice.
  for(const e of saved.effects) {
    admitWatch(e);
    k.preflight(e.then);k.state.effects.push(copy(e));
  }
  const source=notification?null:k.zone(p.idx,'hand').find(id=>short[id]===c),base=k.snapshot();
  const command=notification?{kind:'hand_added',...notification}:{kind:'skill',player:p.idx,source,timing};
  const invoke=notification?kernel=>kernel.notifyHandAdditions(notification.events):kernel=>kernel.card(source).printed.type==='event'?kernel.playEvent(source):kernel.useSkill(source);
  function choices(req) {
    if(['target','payment_cards','move_cards'].includes(req.kind)) {
      if(req.count!==1)throw new Error('Adapter requires single physical-card choices');
      return req.options.map(id=>[id]);
    }
    if(['draw_count','activate_payment','trigger_order'].includes(req.kind))return [...req.options].reverse();
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
  let eventCursor=0,effectCursor=base.effects.length,announced=false;
  function publish(state,complete,journal) {
    for(const e of state.effects.filter(e=>e.kind==='watch'))admitWatch(e);
    const next=copy(physical);
    for(const key of Object.keys(next.zones)) {
      const [player,zone]=key.split('.');
      next.zones[key]=zone==='sides'?[...state.zones[player+'.side:0'],...state.zones[player+'.side:1']]:[...state.zones[player+'.'+(zone==='ev'?'event':zone)]];
      for(const id of next.zones[key]){next.cards[id].zone=key;next.cards[id].incarnation=state.cards[id].incarnation;}
    }
    next.revision=physical.revision+state.events.filter(e=>e.type==='move').length;
    identity.restore(g,next);
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
      g.sharedRulesState={version:1,fingerprint:data.fingerprint,next:state.next,effects:copy(state.effects.filter(e=>e.kind==='watch')),receipts:notification?[...saved.receipts,...notification.events.map(e=>e.receipt)]:saved.receipts};
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
      else if(e.to.endsWith('.drop'))g.log(`${owner.name} 棄掉 ${byShort[code].display_name}`);
    }
    for(const e of state.effects.slice(effectCursor)) {
      if(e.kind==='numeric') {const slot=slots[e.target.id];g.log(`${g.cardName(g.players[slot.player],slot.key)}（${labels[slot.key]||'側攔'}區）：${labels[e.parameter]} +${e.value}`);}
      else if(e.kind==='watch')g.log(`效果：${g.players[e.actor].name}的下個回合，非抽牌加入手牌後需棄 1 張。`);
    }
    eventCursor=state.events.length;effectCursor=state.effects.length;
  }
  async function ask(req,state,available) {
    const owner=g.players[req.player];
    const sourceName=req.kind==='trigger_order'?'效果':byShort[short[req.source]]?.display_name||g.src||'效果';
    const opts=available.map(answer=>{
      if(req.kind==='target') {
        const id=answer[0],slot=slots[id];return {label:`${labels[slot.key]||'側攔'}區 · ${g.cardName(owner,slot.key)} · ${short[id]}`,card:short[id],value:slot.key,answer};
      }
      if(['payment_cards','move_cards'].includes(req.kind)) {const id=answer[0];return {label:`${byShort[short[id]].display_name} · ${short[id]}`,card:short[id],value:id,answer};}
      if(req.kind==='trigger_order') {
        const job=state.queue.find(q=>q.id===answer),name=byShort[short[job.source?.id]]?.display_name||'觸發效果';
        return {label:`先結算 ${name}（${state.queue.indexOf(job)+1}）`,value:answer,answer};
      }
      return {label:req.kind==='draw_count'?answer?`抽 ${answer} 張`:'不抽牌':answer?'棄 1 張符合條件的手牌，追加效果':'不追加',value:answer,answer};
    });
    const kind=req.kind==='target'?'target':req.kind==='activate_payment'?'skill':'rulesChoice';
    const prompt=sourceName+'：'+({target:'選擇場上 1 位角色',draw_count:'選擇抽牌數量',activate_payment:'是否支付棄牌費用，對同一目標追加效果？',payment_cards:'選擇 1 張符合條件的手牌棄掉',move_cards:'非抽牌加入手牌後，請選 1 張手牌棄掉',trigger_order:'選擇同時觸發的結算順序'}[req.kind]);
    let invalid=false;
    for(;;) {
      const value=await g.ask(owner,{kind,prompt:prompt+(invalid?'（請重新選擇有效選項）':''),timing,options:opts.map(({answer,...o})=>o)});
      const option=opts.find(o=>o.value===value);if(option)return option.answer;invalid=true;
    }
  }
  return {possible:()=>possible([]),run:()=>settle({kernel:k,invoke,ask,publish,options:(req,state,answers)=>choices(req).filter(answer=>possible([...answers,{request:req,answer}]))})};
}
function canPlay(g,p,c,timing) {
  if(g.sharedRulesPending||!handles(c)||g.turnP!==p||!p.hand.includes(c))return false;
  const profile=byShort[c].profiles[0];
  if(!profile.activation.activation_phases.includes(phase[timing])||profile.limit&&p.ts.used?.[c])return false;
  return transaction(g,p,c,timing).possible();
}
async function resolve(g,p,c,timing) { return transaction(g,p,c,timing).run(); }
async function handAdded(g,p,id,revision) {
  if(!stored(g).effects.some(e=>e.actor===p.idx&&e.duration.activeTurn===g.turnNo))return;
  const receipt=`${g.turnNo}:${p.idx}:${id}:${revision}`;
  if(stored(g).receipts.includes(receipt)||g.sharedRulesEvents?.some(e=>e.receipt===receipt))return;
  if(revision!==identity.ensure(g).revision)throw new Error('Stale hand-add notification');
  (g.sharedRulesEvents ||= []).push({player:p.idx,card:id,operation:'add_hand',receipt});
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
const api={handles,canPlay,resolve,assertReady,handAdded,legacyEffect,beginTurn,finishTurn,loss,approvals:[...approved]};
if(node)module.exports=api;else root.BreakRulesLegacy=api;
})(typeof globalThis!=='undefined'?globalThis:this);
