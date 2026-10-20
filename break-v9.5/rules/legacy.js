/* Bounded host adapter: transient IDs are valid for one finite settlement.
   Watches, entry, cross-player moves and deferred effects must not use this adapter. */
(function(root) {
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const {Kernel}=node?require('./core'):root.BreakRulesCore;
const {attempt,settle}=node?require('./decisions'):root.BreakRulesDecisions;
const data=node?require('./runtime-data.json'):root.BreakRulesData;
const copy=x=>JSON.parse(JSON.stringify(x));
const phase={srv:'serve',drw:'draw',rcv:'receive',tos:'toss',atk:'attack',blk:'block'};
const params={srv:'serve',blk:'block',rcv:'receive',tos:'toss',atk:'attack'};
const labels={serve:'發球',block:'攔網',receive:'接球',toss:'舉球',attack:'攻擊'};
const norm=s=>s.normalize('NFKC').replace(/\s/g,'');
const byShort=Object.fromEntries(data.catalog.cards.map(c=>[c.card_no.replace(/^HV-?/,''),c]));
const approved=new Set(data.approved);
function handles(c) { return approved.has(byShort[c]?.profiles[0].profile_id); }
function transaction(g,p,c,timing) {
  if(!handles(c)||!p.hand.includes(c)||g.turnP!==p)throw new Error('Not an admitted settlement');
  if(byShort[c].profiles[0].limit&&p.ts.used?.[c])throw new Error('Same-name skill already used this turn');
  const k=new Kernel({catalog:data.catalog,ruleIds:data.ruleIds,fingerprint:data.fingerprint,mode:'live'});
  k.state.turn={id:Math.max(1,g.turnNo),player:p.idx,phase:phase[timing],step:'free'};
  const short={},slots={},basePlayers=g.players.map(q=>copy({hand:q.hand,deck:q.deck,drop:q.drop,ev:q.ev,sets:q.sets,area:q.area,ts:q.ts,effects:q.effects,newCount:q.newCount}));
  for(const q of g.players) {
    for(const [zone,cards] of Object.entries({hand:q.hand,deck:q.deck,drop:q.drop,event:q.ev,sets:q.sets,...q.area,...Object.fromEntries((q.ts.sides||[]).map((x,i)=>['side:'+i,[x]]))})) {
      for(const code of cards) {
        const def=byShort[code];if(!def)throw new Error('Printed identity missing: '+code);
        const id=k.addCard(def.card_no,q.idx,zone);short[id]=code;
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
  const source=k.zone(p.idx,'hand').find(id=>short[id]===c),base=k.snapshot();
  const invoke=kernel=>kernel.card(source).printed.type==='event'?kernel.playEvent(source):kernel.useSkill(source);
  function choices(req) {
    if(['target','payment_cards'].includes(req.kind)) {
      if(req.count!==1)throw new Error('Adapter requires single physical-card choices');
      return req.options.map(id=>[id]);
    }
    if(['draw_count','activate_payment'].includes(req.kind))return [...req.options].reverse();
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
  function publish(state,complete) {
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
          if(q.effects[slot.key]?.card!==short[id])q.effects[slot.key]={card:short[id],mods:{}};
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
    if(!announced){g.log(`${p.name} 使用 ${g.src}`);announced=true;}
    for(const e of state.events.slice(eventCursor))if(e.type==='move') {
      const owner=g.players[state.cards[e.id].owner],code=short[e.id];
      if(e.from.endsWith('.deck')&&e.to.endsWith('.hand'))g.log(owner.idx===g.reveal?`${owner.name}（技能）抽到：${byShort[code].display_name}`:`${owner.name}（技能）抽 1 張`,'draw');
      else if(e.to.endsWith('.drop'))g.log(`${owner.name} 棄掉 ${byShort[code].display_name}`);
    }
    for(const e of state.effects.slice(effectCursor))if(e.kind==='numeric') {
      const slot=slots[e.target.id];g.log(`${g.cardName(g.players[slot.player],slot.key)}（${labels[slot.key]||'側攔'}區）：${labels[e.parameter]} +${e.value}`);
    }
    eventCursor=state.events.length;effectCursor=state.effects.length;
  }
  async function ask(req,state,available) {
    const owner=g.players[req.player];
    const opts=available.map(answer=>{
      if(req.kind==='target') {
        const id=answer[0],slot=slots[id];return {label:`${labels[slot.key]||'側攔'}區 · ${g.cardName(owner,slot.key)} · ${short[id]}`,card:short[id],value:slot.key,answer};
      }
      if(req.kind==='payment_cards') {const id=answer[0];return {label:`${byShort[short[id]].display_name} · ${short[id]}`,card:short[id],value:id,answer};}
      return {label:req.kind==='draw_count'?answer?`抽 ${answer} 張`:'不抽牌':answer?'棄 1 張符合條件的手牌，追加效果':'不追加',value:answer,answer};
    });
    const kind=req.kind==='target'?'target':req.kind==='activate_payment'?'skill':'rulesChoice';
    const prompt=g.src+'：'+({target:'選擇場上 1 位角色',draw_count:'選擇抽牌數量',activate_payment:'是否支付棄牌費用，對同一目標追加效果？',payment_cards:'選擇 1 張符合條件的手牌棄掉'}[req.kind]);
    let invalid=false;
    for(;;) {
      const value=await g.ask(owner,{kind,prompt:prompt+(invalid?'（請重新選擇有效選項）':''),timing,options:opts.map(({answer,...o})=>o)});
      const option=opts.find(o=>o.value===value);if(option)return option.answer;invalid=true;
    }
  }
  return {possible:()=>possible([]),run:()=>settle({kernel:k,invoke,ask,publish,options:(req,state,answers)=>choices(req).filter(answer=>possible([...answers,{request:req,answer}]))})};
}
function canPlay(g,p,c,timing) {
  if(!handles(c)||g.turnP!==p||!p.hand.includes(c))return false;
  const profile=byShort[c].profiles[0];
  if(!profile.activation.activation_phases.includes(phase[timing])||profile.limit&&p.ts.used?.[c])return false;
  return transaction(g,p,c,timing).possible();
}
async function resolve(g,p,c,timing) { return transaction(g,p,c,timing).run(); }
const api={handles,canPlay,resolve,approvals:[...approved]};
if(node)module.exports=api;else root.BreakRulesLegacy=api;
})(typeof globalThis!=='undefined'?globalThis:this);
