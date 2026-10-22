/* Data-driven settlement kernel; host controllers own UI and match progression. */
(function(root) {
'use strict';
const clone = x => x===undefined ? null : JSON.parse(JSON.stringify(x));
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const COURT = ['serve','block','receive','toss','attack','side:0','side:1'];
const PARAMS = ['serve','block','receive','toss','attack'];
const KINDS = new Set(['sequence','conditional','numeric','draw','draw_to_hand_size','move','move_self',
  'pay_guts','payment_branch','formal_declaration_cost','retrieve','enter','enter_self','watch','ban_action','invalidate_skill',
  'rename_before_entry','protect_numeric_decrease','phase_jump','optional','choose_modes','mill','keyword','deck_selection','exchange','each_player_optional_draw']);
const FILTERS = new Set(['names','exclude_names','tags','tags_any','positions','positions_any','years','years_any',
  'role','role_any','type','skillless','play_icons_any','play_icons_exact','entry_origins','phase',
  'printed_attack','printed_attack_eq','printed_block_gte','printed_receive_gte','current_receive_gte',
  'current_block_eq','exclude_operations','from_zone','to_zone','position_has_any_other_than','entry_keyword_family']);
// Keep only choices that can be extended to distinct names for the whole group.
function distinctNameOptions(groups,used=[]) {
  if(!groups.length)return [];
  const possible=(rest,taken)=>!rest.length||rest[0].some(n=>!taken.includes(n)&&possible(rest.slice(1),[...taken,n]));
  return groups[0].filter(n=>!used.includes(n)&&possible(groups.slice(1),[...used,n]));
}
class NeedsReview extends Error { constructor(message) { super(message); this.code='REQUIRES_REVIEW'; } }
class IllegalAction extends Error { constructor(message) { super(message); this.code='ILLEGAL_ACTION'; } }
class Unpayable extends Error {}
class ModeChoice extends Error {constructor(request){super('Private mode probe');this.request=request;}}
function modeLabel(n) {
  const zh={serve:'發球',receive:'接球',block:'攔網',toss:'舉球',attack:'攻擊',draw:'抽牌',hand:'手牌',drop:'棄牌區',event:'Event區','receive.guts':'接球區Guts'};
  const who=s=>s==='opponent'?'對方':'我方';
  const filter=f=>[...(f.names||f.tags||[]),f.type==='character'?'角色卡':'',f.current_receive_gte!=null?'接球≥'+f.current_receive_gte:'',f.current_block_eq!=null?'攔網='+f.current_block_eq:''].filter(Boolean).join('・');
  if(n.kind==='sequence')return n.steps.map(modeLabel).join('；');
  if(n.kind==='conditional')return (n.condition.field==='phase'?(zh[n.condition.value]||n.condition.value)+'階段':n.condition.kind==='count_compare'?(zh[n.condition.pool.zone]||n.condition.pool.zone)+'至少'+n.condition.value+'張':'條件成立')+'：'+modeLabel(n.then);
  if(n.kind==='draw')return who(n.actor)+'抽'+n.count+'張';
  if(n.kind==='numeric')return (typeof n.target==='object'?filter(n.target.filters)||'場上角色':n.target==='$event.character'?'登場角色':'此角色')+'：'+(zh[n.parameter]||n.parameter)+(n.operation==='set'?'設為':n.value>=0?' +':' ')+n.value;
  if(n.kind==='move')return '從'+who(n.pool.actor)+(zh[n.pool.zone]||n.pool.zone)+'選擇'+(n.count_mode==='all'?'全部':n.count+'張')+(n.pool.filters.type==='event'?'Event':'牌')+'放到'+(n.destination==='owner.drop'?'棄牌區':who(n.destination.split('.')[0])+(zh[n.destination.split('.')[1]]||n.destination));
  if(n.kind==='shuffle')return who(n.actor)+'洗牌';
  if(n.kind==='enter')return '從'+(zh[n.pool.zone]||n.pool.zone)+'讓'+(filter(n.pool.filters)||'角色')+'登場'+(zh[n.destination]||n.destination)+'區';
  if(n.kind==='retrieve')return '從'+(zh[n.pool.zone]||n.pool.zone)+'取回'+(n.count_mode==='upto'?'最多':'')+n.count+'張'+filter(n.pool.filters);
  if(n.kind==='watch')return (n.duration==='next_opponent_turn'?'下個對方回合':'本回合')+'・'+who(n.actor)+(zh[n.filters.role]||'角色')+'登場時：'+modeLabel(n.then);
  if(n.kind==='ban_action')return (n.duration==='next_opponent_turn'?'下個對方回合':'本回合')+'・'+who(n.actor)+(n.scope.phases||[]).map(p=>zh[p]+'階段').join('／')+(n.action==='add_hand'?'禁止加入手牌':n.action==='enter_character'?(n.scope.max_count!=null?'最多登場'+n.scope.max_count+'名':'禁止登場')+(zh[n.scope.role]||'')+'角色':'禁止'+n.action);
  return n.kind;
}
function need(ok, message) { if (!ok) throw new NeedsReview(message); }
function legal(ok, message) { if (!ok) throw new IllegalAction(message); }
function validateProtection(n) {
  need(['all','block','offense'].includes(n.parameter)&&['this_turn','next_opponent_turn'].includes(n.duration),'Unsupported protection parameters');
  const s=n.target_scope;
  need(s&&['snapshot_on_resolution','continuous_matching'].includes(s.membership),'Unresolved protection scope');
  if(s.membership==='continuous_matching'){
    need(s.mode==='all'&&s.binding==='all_matches'&&n.target?.kind==='selector'&&['self','opponent','controller','owner'].includes(n.target.actor)&&n.target.zone==='court','Unsupported continuous protection');
    for(const [key,v]of Object.entries(n.target.filters||{}))need(key==='role'?v==='character':key==='tags'&&Array.isArray(v)&&v.length&&v.every(x=>typeof x==='string'),'Unsupported continuous protection filter');
  }else need(s.mode==='single'&&s.binding==='reference'&&['source','$target','$entered','$event.character','self_ball','opponent_ball'].includes(n.target),'Unsupported protection target');
  return true;
}
function walk(value, fn) {
  if (Array.isArray(value)) value.forEach(v=>walk(v,fn));
  else if (value && typeof value==='object') { fn(value); Object.values(value).forEach(v=>walk(v,fn)); }
}
function validateBan(n) {
  need(['enter_character','play_event','add_hand','use_skill'].includes(n.action)&&['self','opponent','owner','controller'].includes(n.actor)&&['next_opponent_turn','this_turn','this_draw_phase'].includes(n.duration)&&n.scope&&typeof n.scope==='object'&&!Array.isArray(n.scope),'Unsupported ban parameters');
  const enums={origins:['rule','skill'],phases:['serve','block','draw','receive','toss','attack','end'],entry_origins:['hand','drop','guts'],play_icons_any:['serve','block','draw','receive','toss','attack']};
  for(const [key,v]of Object.entries(n.scope)){
    if(enums[key])need(Array.isArray(v)&&v.length>0&&v.every(x=>enums[key].includes(x)),'Unsupported ban scope '+key);
    else if(['positions','names'].includes(key))need(Array.isArray(v)&&v.length>0&&v.every(x=>typeof x==='string'&&x.length),'Unsupported ban scope '+key);
    else if(key==='role')need(['serve','block','center_blocker','side_blocker','receive','toss','attack','character'].includes(v),'Unsupported ban role');
    else if(['max_count','printed_receive_gte'].includes(key))need(Number.isInteger(v)&&v>=0,'Unsupported ban limit');
    else throw new NeedsReview('Unsupported ban scope '+key);
  }
  return true;
}
function validateInvalid(n) {
 need(['self','opponent','controller','owner'].includes(n.actor)&&['this_turn','next_opponent_turn'].includes(n.duration),'Unsupported invalidation parameters');
 const check=s=>{need(s&&typeof s==='object'&&!Array.isArray(s)&&Object.keys(s).length,'Invalid skill selector');for(const[key,v]of Object.entries(s)){
  if(key==='union_with'){check(v);continue;}if(key==='type'){need(['character','event'].includes(v),'Invalid skill type');continue;}
  const values={roles:['character','receive','toss','attack','serve','block','center_blocker','side_blocker'],phase_tags:['serve','block','draw','receive','toss','attack'],source_zones:['hand','court','serve','block','receive','toss','attack','drop','event'],play_icons_any:['serve','block','draw','receive','toss','attack'],keyword_families:['one_touch','doshat']};
  need(key==='names'||values[key],'Unsupported skill selector '+key);need(Array.isArray(v)&&v.length&&v.every(x=>typeof x==='string'&&(key==='names'||values[key].includes(x))),'Invalid skill selector '+key);
 }};check(n.selector);return true;
}
class Kernel {
  constructor({catalog, ruleIds, fingerprint, mode='live', choose, state, practiceDrawBeforeReceive=false}={}) {
    need(catalog && Array.isArray(catalog.cards) && typeof fingerprint==='string','Catalog and fingerprint required');
    this.catalog=catalog; this.profiles={}; this.ruleIds=new Set(ruleIds || []);
    for (const c of catalog.cards) for (const p of c.profiles) this.profiles[p.profile_id]=p;
    need(['live','sandbox'].includes(mode),'Unknown execution mode');
    this.mode=mode; this.choose=choose || (()=>{throw new NeedsReview('A player decision is required');});
    this.depth=0; this.draining=false; this.busy=false;
    this.state=state ? clone(state) : {version:1,fingerprint,executionMode:mode,rulesOptions:{practiceDrawBeforeReceive},revision:0,next:1,turn:{id:1,player:0,phase:'attack',step:'free'},
      stage:'rally',cards:{},zones:{},effects:[],queue:[],locks:[],ball:null,decisions:[],events:[],publicLog:[]};
    need(this.state.version===1 && this.state.fingerprint===fingerprint && this.state.executionMode===mode && this.state.rulesOptions?.practiceDrawBeforeReceive===practiceDrawBeforeReceive,'State/catalog/policy version mismatch');
    for (let p=0;p<2;p++) for (const z of [...COURT,'hand','deck','drop','event','sets']) this.zone(p,z);
    this.assertState();
  }
  zone(player,name) { need([0,1].includes(player),'Unknown player'); const key=player+'.'+name; return this.state.zones[key] ||= []; }
  id(prefix) { return prefix+(this.state.next++); }
  card(id) { const c=this.state.cards[id]; need(c,'Unknown physical card '+id); return c; }
  profile(id) { const p=this.profiles[this.card(id).profileId]; need(p,'Unknown card profile'); return p; }
  addCard(cardNo,player,zone='hand',variant=0) {
    legal(!this.busy,'Cannot edit a running transaction');
    const def=this.catalog.cards.find(c=>c.card_no===cardNo); need(def,'Unknown card number');
    const p=def.profiles[variant]; need(p,'Unknown text variant');
    const id=this.id('c'); this.state.cards[id]={id,owner:player,profileId:p.profile_id,cardNo,
      printed:clone(p.variants[0].printed),zone:player+'.'+zone,incarnation:0};
    this.zone(player,zone).push(id); this.assertState(); return id;
  }
  top(player,area) { return this.zone(player,area).at(-1) || null; }
  role(id) {
    const c=this.card(id), [p,z]=c.zone.split('.');
    if (!COURT.includes(z) || this.top(+p,z)!==id) return 'guts';
    return z.startsWith('side:') ? 'side_blocker' : z==='block' ? 'center_blocker' : z;
  }
  character(id) { return this.card(id).printed.type==='character' && this.role(id)!=='guts'; }
  reference(id) { return id ? {id,incarnation:this.card(id).incarnation} : null; }
  current(ref) { return !!ref && !!this.state.cards[ref.id] && this.card(ref.id).incarnation===ref.incarnation && this.character(ref.id); }
  court(player) { return COURT.map(z=>this.top(player,z)).filter(id=>id && this.character(id)); }
  owner(actor,ctx) {
    if (actor==='self' || actor==='controller') return ctx.controller;
    if (actor==='opponent') return 1-ctx.controller;
    if (actor==='owner') return this.card(ctx.source.id).owner;
    throw new NeedsReview('Unsupported relative player '+actor);
  }
  active(effect) {
    const d=effect.duration, t=this.state.turn;
    if (d.kind==='next_opponent_turn') return d.activeTurn===t.id;
    if (d.kind==='this_draw_phase') return d.turn===t.id && t.phase==='draw';
    return d.turn===t.id;
  }
  duration(kind,ctx) {
    if (['this_turn','current_turn_cleanup_or_role_exit','this_turn_or_role_exit','this_draw_phase'].includes(kind))
      return {kind,turn:this.state.turn.id};
    if (kind==='next_opponent_turn') return {kind,createdTurn:this.state.turn.id,player:1-ctx.controller,activeTurn:null};
    throw new NeedsReview('Unsupported duration '+kind);
  }
  effect(kind,data,ctx,duration='this_turn') {
    const e={id:this.id('e'),kind,controller:ctx.controller,source:clone(ctx.source),duration:this.duration(duration,ctx),...clone(data)};
    this.state.effects.push(e); return e;
  }
  entryNames(id) {
    const p=this.profile(id),names=[];
    if(p.activation?.skill_type==='permanent_entry_name'&&(this.mode==='sandbox'||p.runtime_approved))walk(p.program,n=>{if(n.kind==='rename_before_entry')names.push(...n.choose_name);});
    return names.length?[...new Set(names)]:[this.effectiveName(id)];
  }
  _prepareEntryName(id,ctx,allowed=this.entryNames(id)) {
    if(this.profile(id).activation?.skill_type!=='permanent_entry_name')return null;
    this._admit(this.profile(id));const entry={...ctx,source:this.reference(id),entryNames:allowed,entryName:null};
    this._resolveSkill(this.profile(id),entry);return entry.entryName;
  }
  _applyEntryName(id,entry,ctx) {if(entry)this.effect('rename',{target:this.reference(id),name:entry.name},ctx,entry.duration);}
  effectiveName(id) {
    const ref=this.reference(id);
    const e=this.state.effects.findLast(e=>e.kind==='rename' && this.active(e) && same(e.target,ref) && this.current(ref));
    return e ? e.name : this.card(id).printed.name;
  }
  parameter(id,param) {
    const c=this.card(id), base=c.printed.parameters?.[param];
    need(base==='dash' || Number.isInteger(base),'Parameter unavailable');
    if (base==='dash') return base;
    let value=base; const ref=this.reference(id);
    for (const e of this.state.effects) if (e.kind==='numeric' && this.active(e) && same(e.target,ref) && this.current(ref) && e.parameter===param)
      value=e.operation==='set' ? e.value : value+e.value;
    return value;
  }
  roleMatches(actual,wanted) { return wanted==='character' ? actual!=='guts' : wanted==='block' ? ['center_blocker','side_blocker'].includes(actual) : actual===wanted; }
  matches(id,filters={},ctx,event={}) {
    for (const key of Object.keys(filters)) need(FILTERS.has(key),'Unsupported filter '+key);
    const c=this.card(id), p=c.printed, role=this.role(id);
    for (const [key,v] of Object.entries(filters)) {
      let ok=true;
      if (key==='names') ok=v.includes(event.effectiveName??this.effectiveName(id));
      else if (key==='exclude_names') ok=!v.includes(event.effectiveName??this.effectiveName(id));
      else if (key==='tags') ok=v.every(x=>p.affiliation_tags.includes(x));
      else if (key==='tags_any') ok=v.some(x=>p.affiliation_tags.includes(x));
      else if (key==='positions') ok=v.every(x=>p.position_tags.includes(x));
      else if (key==='positions_any') ok=v.some(x=>p.position_tags.includes(x));
      else if (key==='position_has_any_other_than') ok=p.position_tags.some(x=>!v.includes(x));
      else if (key==='years') ok=v.every(x=>p.year_tags.includes(x));
      else if (key==='years_any') ok=v.some(x=>p.year_tags.includes(x));
      else if (key==='role') ok=this.roleMatches(event.role || role,v);
      else if (key==='role_any') ok=v.some(r=>this.roleMatches(event.role || role,r));
      else if (key==='type') ok=p.type===v;
      else if (key==='skillless') ok=(this.profile(id).printed_has_skill ?? !!this.profile(id).program)===!v;
      else if (key==='play_icons_any') ok=v.some(x=>(this.profile(id).printed_play_icons ?? this.profile(id).activation?.activation_phases ?? []).includes(x));
      else if (key==='play_icons_exact') ok=same([...v].sort(),[...(this.profile(id).printed_play_icons ?? this.profile(id).activation?.activation_phases ?? [])].sort());
      else if (key==='entry_origins') ok=v.includes(event.origin ?? c.entryOrigin);
      else if (key==='entry_keyword_family') ok=event.entry_keyword_family===v;
      else if (key==='phase') ok=this.state.turn.phase===v;
      else if (key==='exclude_operations') ok=!v.includes(event.operation);
      else if (key==='from_zone' || key==='to_zone') ok=event[key]===v;
      else if (key==='printed_attack' || key==='printed_attack_eq') ok=p.parameters?.attack===v;
      else if (key==='printed_block_gte') ok=Number.isInteger(p.parameters?.block) && p.parameters.block>=v;
      else if (key==='printed_receive_gte') ok=Number.isInteger(p.parameters?.receive) && p.parameters.receive>=v;
      else if (key==='current_receive_gte') ok=Number.isInteger(this.parameter(id,'receive')) && this.parameter(id,'receive')>=v;
      else if (key==='current_block_eq') ok=this.parameter(id,'block')===v;
      if (!ok) return false;
    }
    return true;
  }
  pool(selector,ctx) {
    const player=this.owner(selector.actor,ctx), z=selector.zone;
    let ids;
    if (z==='court') ids=this.court(player);
    else if(z==='event_or_drop')ids=[...this.zone(player,'event'),...this.zone(player,'drop')];
    else if (z==='block') ids=['block','side:0','side:1'].map(z=>this.top(player,z)).filter(Boolean);
    else if (z==='court.guts') ids=COURT.flatMap(z=>this.zone(player,z).slice(0,-1));
    else if (z.endsWith('.guts')) ids=this.zone(player,z.split('.')[0]).slice(0,-1);
    else if (z.startsWith('$')) ids=[...(ctx.bind[z.slice(1)] || [])];
    else if (['hand','deck','drop','event','sets',...COURT].includes(z)) ids=[...this.zone(player,z)];
    else throw new NeedsReview('Unsupported selector zone '+z);
    return ids.filter(id=>this.matches(id,selector.filters,ctx));
  }
  _decide(kind,ctx,options,extra={}) {
    const req={kind,player:ctx.controller,source:ctx.source?.id,options:clone(options),...extra};
    const answer=this.choose(clone(req));
    this.state.decisions.push({request:req,answer:clone(answer)}); return answer;
  }
  _selection(ids,n,ctx,kind,player=ctx.controller,extra={}) {
    const chosen=this._decide(kind,ctx,ids,{count:n,player,...extra});
    legal(Array.isArray(chosen) && chosen.length===n && new Set(chosen).size===n && chosen.every(id=>ids.includes(id)),'Invalid physical-card selection');
    return chosen;
  }
  _targets(node,ctx) {
    const target=node.target, scope=node.target_scope;
    need(scope && scope.membership!=='unresolved','Unresolved target scope');
    if (scope.binding==='reference') {
      const ref=target==='source' ? ctx.source : target==='$target' ? ctx.bind.target : target==='$entered' ? ctx.bind.entered : target==='$event.character' ? ctx.event.character : null;
      if (['self_ball','opponent_ball'].includes(target)) return [target];
      need(ref!==undefined,'Unsupported target reference '+target);
      return this.current(ref) ? [ref] : [];
    }
    need(scope.membership==='snapshot_on_resolution','Continuous selector execution not implemented');
    const ids=this.pool(target,ctx);
    if (scope.mode==='all') return ids.map(id=>this.reference(id));
    if (!ids.length) return [];
    let n=1;
    if (scope.mode==='multiple') {
      n=scope.count_mode==='upto' ? this._decide('target_count',ctx,Array.from({length:Math.min(scope.count,ids.length)+1},(_,i)=>i)) : Math.min(scope.count,ids.length);
      legal(Number.isInteger(n) && n>=0 && n<=Math.min(scope.count,ids.length),'Invalid target count');
    }
    return this._selection(ids,n,ctx,'target').map(id=>this.reference(id));
  }
  _scopeMatch(scope,action) {
    for (const [key,v] of Object.entries(scope)) {
      const required={origins:'origin',phases:'phase',role:'role',entry_origins:'entryOrigin',names:'name',play_icons_any:'icons',max_count:'entryCount'}[key];
      if(required)need(action[required]!==undefined && action[required]!==null,'Restriction context missing '+required);
      if(key==='positions')need(Array.isArray(action.printed?.position_tags),'Printed positions missing');
      if(key==='printed_receive_gte')need(Number.isInteger(action.printed?.parameters?.receive)||action.printed?.parameters?.receive==='dash','Printed receive missing');
      if (key==='origins' && !v.includes(action.origin)) return false;
      else if (key==='phases' && !v.includes(action.phase)) return false;
      else if (key==='role' && !this.roleMatches(action.role,v)) return false;
      else if (key==='entry_origins' && !v.includes(action.entryOrigin)) return false;
      else if (key==='positions' && !v.every(p=>action.printed?.position_tags.includes(p))) return false;
      else if (key==='names' && !v.includes(action.name)) return false;
      else if (key==='printed_receive_gte' && !(Number.isInteger(action.printed?.parameters?.receive) && action.printed.parameters.receive>=v)) return false;
      else if (key==='play_icons_any' && !v.some(p=>action.icons?.includes(p))) return false;
      else if (!['origins','phases','role','entry_origins','positions','names','printed_receive_gte','play_icons_any','max_count'].includes(key)) throw new NeedsReview('Unsupported restriction scope '+key);
    }
    return true;
  }
  permission(action) {
    need([0,1].includes(action.player) && ['rule','skill'].includes(action.origin),'Permission context incomplete');
    need(['add_hand','play_event','enter_character','use_skill','use_keyword'].includes(action.action),'Unknown permission action');
    action={phase:this.state.turn.phase,...action};
    for (const e of this.state.effects) if (this.active(e) && e.actor===action.player) {
      if(e.kind==='keyword'&&e.keyword==='feint_block_ban'&&action.action==='enter_character'&&this.roleMatches(action.role,'block'))return {allowed:false,layer:'resolve_step',effect:e.id};
      if (e.kind==='ban' && e.action===action.action && this._scopeMatch(e.scope,action)) {
        if ('max_count' in e.scope) {const count=e.scope.entry_origins&&action.entryCounts?e.scope.entry_origins.reduce((n,z)=>n+(action.entryCounts[z]||0),0):action.entryCount;if(!(count>e.scope.max_count))continue;}
        return {allowed:false,layer:action.action==='play_event' ? 'play_card':'resolve_step',effect:e.id};
      }
      if (e.kind==='invalid' && ['use_skill','use_keyword'].includes(action.action)) {
        const sel=e.selector;
        const match=s=>{
          if(s.union_with&&match(s.union_with))return true;
          if(s.keyword_families){if(!action.keywordFamily||!s.keyword_families.includes(action.keywordFamily))return false;}else if(action.action==='use_keyword')return false;
          for(const key of ['type','name','role','phaseTags','sourceZone','icons']) {
            const used={type:'type',name:'names',role:'roles',phaseTags:'phase_tags',sourceZone:'source_zones',icons:'play_icons_any'}[key];
            if(s[used])need(action[key]!==undefined,'Skill context missing '+key);
          }
          return (!s.type || s.type===action.type) && (!s.names || s.names.includes(action.name)) &&
          (!s.roles || s.roles.some(r=>this.roleMatches(action.role,r))) &&
          (!s.phase_tags || s.phase_tags.every(x=>action.phaseTags.includes(x))) &&
          (!s.source_zones || s.source_zones.includes(action.sourceZone)) &&
          (!s.play_icons_any || s.play_icons_any.some(x=>action.icons.includes(x)));};
        if (match(sel)) return {allowed:false,layer:'use_skill',effect:e.id};
      }
    }
    return {allowed:true,layer:action.action==='use_skill'?'use_skill':'resolve_step'};
  }
  _handAllowed(player,ctx,origin='skill') { return this.permission({action:'add_hand',player,origin}).allowed; }
  _move(id,player,destination,ctx,reason='effect',asGuts=false) {
    const card=this.card(id), from=card.zone, [fromPlayer,fromArea]=from.split('.');
    const wasCharacter=this.character(id), oldTop=this.top(player,destination);
    const areaIsCourt=COURT.includes(destination), staysCharacter=wasCharacter && areaIsCourt && !asGuts;
    if(asGuts)legal(oldTop && oldTop!==id && this.character(oldTop),'Guts destination needs another character');
    const list=this.state.zones[from]; list.splice(list.indexOf(id),1);
    if (wasCharacter && !staysCharacter) card.incarnation++;
    if (wasCharacter && this.top(+fromPlayer,fromArea)) this.card(this.top(+fromPlayer,fromArea)).incarnation++;
    if (areaIsCourt && oldTop && oldTop!==id && !asGuts) this.card(oldTop).incarnation++;
    card.zone=player+'.'+destination;
    if(asGuts)this.zone(player,destination).splice(this.zone(player,destination).length-1,0,id);
    else this.zone(player,destination).push(id);
    if (areaIsCourt && !staysCharacter && !asGuts) card.incarnation++;
    this.state.events.push({type:'move',id,from,to:card.zone,reason});
    this._emit({type:'source_moved',player,card:id,from_zone:fromArea,to_zone:destination,phase:this.state.turn.phase});
    return id;
  }
  _destination(value,id,ctx) {
    const parts=value.split('.'), actor=parts.shift();
    let zone=parts.join('.'), player=actor==='owner' ? this.card(id).owner : this.owner(actor,ctx);
    if(zone==='choose_deck_top_or_bottom') {
      const answer=this._decide('mode',ctx,['deck_top','deck_bottom'],{player});
      legal(['deck_top','deck_bottom'].includes(answer),'Invalid deck destination');
      zone=answer==='deck_top'?'deck':'deck_bottom';
    }
    if (zone==='deck_bottom') return {player,zone:'deck',bottom:true};
    if(zone.endsWith('.guts')) {
      let area=zone.slice(0,-5);
      if(area==='chosen_court_area') {
        const areas=COURT.filter(a=>this.top(player,a));need(areas.length,'No character for Guts placement');
        area=this._decide('guts_destination',ctx,areas);legal(areas.includes(area),'Invalid Guts area');
      }
      need(COURT.includes(area),'Unknown Guts destination');return {player,zone:area,guts:true};
    }
    if (zone.includes('choose')) throw new NeedsReview('Special destination not implemented');
    need(['hand','deck','drop','event'].includes(zone),'Unsupported move destination');
    return {player,zone};
  }
  _retrieveCompatible(ids,constraints) {
    for(const [key,value] of Object.entries(constraints))
      need(['single_area','distinct_names','shared_affiliation'].includes(key)&&value===true,'Unsupported retrieve constraint '+key);
    if(constraints.single_area && new Set(ids.map(id=>this.card(id).zone)).size>1)return false;
    if(constraints.distinct_names && new Set(ids.map(id=>this.effectiveName(id))).size!==ids.length)return false;
    if(constraints.shared_affiliation && ids.length && !this.card(ids[0]).printed.affiliation_tags.some(tag=>ids.every(id=>this.card(id).printed.affiliation_tags.includes(tag))))return false;
    return true;
  }
  _retrieveCompletions(ids,n,constraints,prefix=[]) {
    if(!this._retrieveCompatible(prefix,constraints))return false;
    if(prefix.length===n)return true;
    return ids.some((id,i)=>this._retrieveCompletions(ids.slice(i+1),n,constraints,[...prefix,id]));
  }
  _moveSelected(node,ctx) {
    const ids=this.pool(node.pool,ctx), recipient=this.owner(node.pool.actor,ctx);
    // Public-zone targets belong to the effect controller (QA1192/1317/1420).
    // A player discarding from their own private hand retains that choice.
    const chooser=node.pool.zone==='hand'?recipient:ctx.controller;
    const dest=node.destination;
    if(dest.endsWith('chosen_court_area.guts')&&!COURT.some(a=>this.top(this.owner(dest.split('.')[0],ctx),a))){ctx.bind[node.bind||'moved']=[];return false;}
    if(dest.endsWith('.guts') && !dest.includes('chosen_court_area')) {
      const parts=dest.split('.'),player=parts[0]==='owner'?recipient:this.owner(parts[0],ctx);
      if(!this.top(player,parts[1])){ctx.bind[node.bind || 'moved']=[];return false;}
    }
    if (dest.endsWith('.hand') && !this._handAllowed(dest.startsWith('owner.')?recipient:this.owner(dest.split('.')[0],ctx),ctx)) { if(ctx.inPayment)throw new Unpayable();ctx.bind[node.bind || 'moved']=[]; return false; }
    const constraints=node.group_constraints;
    if(constraints)this._retrieveCompatible([],constraints);
    let maximum=ids.length;
    if(constraints){
      maximum=Math.min(node.count,ids.length);
      while(maximum && !this._retrieveCompletions(ids,maximum,constraints))maximum--;
    }
    let n;
    if (node.count_mode==='all') n=ids.length;
    else if (node.count_mode==='one_of_exact') {
      const allowed=node.allowed_counts.filter(n=>n<=ids.length);
      if (!allowed.length) throw new Unpayable();
      n=this._decide('payment_count',ctx,allowed,{player:chooser}); legal(allowed.includes(n),'Invalid payment count');
    } else {
      need(['exact','upto'].includes(node.count_mode),'Unsupported move quantity');
      if (ctx.inPayment && maximum<node.count) throw new Unpayable();
      n=Math.min(node.count,maximum);
      if (node.count_mode==='upto') { n=this._decide('move_count',ctx,Array.from({length:n+1},(_,i)=>i),{player:chooser}); legal(Number.isInteger(n) && n>=0 && n<=Math.min(node.count,maximum),'Invalid move count'); }
    }
    let chosen=[];
    if(constraints){
      // Reuse existing single-card requests. Only offer choices which can still
      // complete the whole legal group; no card moves until all are selected.
      while(chosen.length<n){
        const options=ids.filter(id=>!chosen.includes(id)&&this._retrieveCompletions(ids.filter(x=>!chosen.includes(x)&&x!==id),n,constraints,[...chosen,id]));
        chosen.push(this._selection(options,1,ctx,'move_cards',chooser,{destination:dest})[0]);
      }
    }else chosen=node.count_mode==='all' ? ids : n ? this._selection(ids,n,ctx,ctx.inPayment?'payment_cards':'move_cards',chooser,{destination:dest}) : [];
    ctx.bind[node.bind || 'moved']=[...chosen];
    for (const id of chosen) {
      const destination=this._destination(dest,id,ctx);
      this._move(id,destination.player,destination.zone,ctx,node.reason,destination.guts);
      if (destination.bottom) { const deck=this.zone(destination.player,'deck');deck.unshift(deck.pop()); }
      if (destination.zone==='hand') this._emit({type:'hand_added',player:destination.player,card:id,operation:'add_hand'});
    }
    if (ctx.inPayment) ctx.paid.push(...chosen);
    return chosen.length>0;
  }
  _draw(player,n,ctx,origin='skill',operation='draw') {
    legal(Number.isInteger(n) && n>=0,'Invalid draw amount');
    const ids=[];
    if (!this._handAllowed(player,ctx,origin)) return ids;
    while (ids.length<n && this.zone(player,'deck').length) {
      const id=this.top(player,'deck'); this._move(id,player,'hand',ctx); ids.push(id);
      this._emit({type:'hand_added',player,card:id,operation});
    }
    if (ids.length) this.state.publicLog.push({type:'draw',player,count:ids.length});
    return ids;
  }
  _deckSelection(node,ctx) {
    const player=this.owner(node.actor,ctx),deck=this.zone(player,'deck');
    need(['look','reveal'].includes(node.visibility)&&Number.isInteger(node.top_count),'Unsupported deck view');
    const shown=deck.slice(-node.top_count).reverse();
    ctx.bind[node.bind]=[...shown];ctx.bind[node.selection.bind]=[];
    if(!shown.length)return false;
    // The first request contains no hidden cards: the player initiates the flip.
    legal(this._decide('reveal',ctx,[true],{player,visibility:node.visibility,top_count:shown.length})===true,'Confirm deck view');
    const viewed=this._decide('revealResult',ctx,shown,{player,count:0,visibility:node.visibility,eligible_count:shown.filter(id=>this.matches(id,node.selection.filters,ctx)).length});
    legal(Array.isArray(viewed)&&viewed.length===0,'Confirm revealed cards');
    const log={type:'deck_view',player,count:shown.length,visibility:node.visibility};
    if(node.visibility==='reveal')log.cards=shown.map(id=>({id,cardNo:this.card(id).cardNo}));
    this.state.publicLog.push(log);
    const retrieved=[],remaining=[...shown];
    const select=selection=>{
      const options=remaining.filter(id=>this.matches(id,selection.filters,ctx));
      let n=selection.count_mode==='all'?options.length:Math.min(selection.count,options.length);
      need(['all','exact','upto'].includes(selection.count_mode),'Unsupported deck selection count');
      if(!this._handAllowed(player,ctx))n=0;
      else if(selection.count_mode==='upto'){
        const max=n;n=this._decide('move_count',ctx,Array.from({length:max+1},(_,i)=>i),{player});
        legal(Number.isInteger(n)&&n>=0&&n<=max,'Invalid deck selection count');
      }
      const chosen=[];
      for(let i=0;i<n;i++){
        const id=this._selection(options.filter(id=>!chosen.includes(id)),1,ctx,'move_cards',player,{destination:node.actor+'.hand'})[0];
        chosen.push(id);
      }
      for(const id of chosen){
        remaining.splice(remaining.indexOf(id),1);this._move(id,player,'hand',ctx,'deck_selection');
        retrieved.push(id);this._emit({type:'hand_added',player,card:id,operation:'add_hand'});
        if(selection.reveal_selected!==false)this.state.publicLog.push({type:'deck_selected',player,card:id,cardNo:this.card(id).cardNo});
      }
      return chosen;
    };
    const primary=select(node.selection);
    if(node.secondary_selection&&(!node.secondary_selection.when_primary_added||primary.length))select(node.secondary_selection);
    ctx.bind[node.selection.bind]=retrieved;
    let destination=node.remainder.destination;
    if(destination==='choose_deck_top_or_bottom'&&remaining.length){
      destination=this._decide('mode',ctx,['deck_top','deck_bottom'],{player});
      legal(['deck_top','deck_bottom'].includes(destination),'Invalid remainder destination');
    }
    need(['deck_top','deck_bottom','choose_deck_top_or_bottom'].includes(destination)&&node.remainder.order==='chooser','Unsupported remainder placement');
    const ordered=[];
    while(ordered.length<remaining.length){
      const options=remaining.filter(id=>!ordered.includes(id));
      ordered.push(this._selection(options,1,ctx,'move_cards',player,{destination:node.actor+'.'+destination,ordering:true})[0]);
    }
    for(const id of remaining)deck.splice(deck.indexOf(id),1);
    if(destination==='deck_top')deck.push(...ordered.reverse());else deck.unshift(...ordered.reverse());
    this.state.publicLog.push({type:'deck_remainder',player,count:remaining.length,destination,result:retrieved.length?'added':'no_matching_card_added'});
    return true; // Viewing and arranging cards is an effect even without a match.
  }
  _fact(field,ctx) {
    if(field==='random.result')return ctx.bind.random?.result??ctx.event.random?.result??null;
    if(field==='revealed.affiliation_intersects_self_court'){
      const tags=new Set(this.court(ctx.controller).flatMap(id=>this.card(id).printed.affiliation_tags));
      return (ctx.bind.revealed||[]).some(id=>this.card(id).printed.affiliation_tags.some(t=>tags.has(t)));
    }
    if(field==='opponent.block_defense')return ['block','side:0','side:1'].reduce((n,z)=>{const id=this.top(1-ctx.controller,z);return n+(id?this.parameter(id,'block'):0);},0);
    if(field==='self.attack.guts.count')return Math.max(0,this.zone(ctx.controller,'attack').length-1);
    if(field==='self.court.distinct_affiliation_assignment_count'){
      const assigned=new Map();
      const assign=(id,seen)=>this.card(id).printed.affiliation_tags.some(tag=>{if(seen.has(tag))return false;seen.add(tag);if(!assigned.has(tag)||assign(assigned.get(tag),seen)){assigned.set(tag,id);return true;}return false;});
      return this.court(ctx.controller).filter(id=>assign(id,new Set())).length;
    }
    if(field.startsWith('source.covered_character.'))return this.card(ctx.source.id).coveredCharacter?.[field.split('.').at(-1)]??null;
    if(field==='source.entry_skill_name')return this.card(ctx.source.id).entrySkillName??null;
    if (field==='phase') return this.state.turn.phase;
    if (field==='current_turn_id') return this.state.turn.id;
    if (field==='both.set.count_sum') return this.zone(0,'sets').length+this.zone(1,'sets').length;
    if (field.startsWith('opponent_ball.')) { need(this.state.ball && this.state.ball.owner!==ctx.controller,'Incoming ball missing');return this.state.ball[field.split('.')[1]]; }
    let m=field.match(/^(self|opponent)\.(hand|sets|set)\.count$/);
    if (m) return this.zone(m[1]==='self'?ctx.controller:1-ctx.controller,m[2]==='set'?'sets':m[2]).length;
    m=field.match(/^(self|opponent)\.(serve|receive|toss|attack)\.(effective_name|printed_attack)$/);
    if (m) { const id=this.top(m[1]==='self'?ctx.controller:1-ctx.controller,m[2]); return !id ? null : m[3]==='effective_name'?this.effectiveName(id):this.card(id).printed.parameters.attack; }
    m=field.match(/^(paid|milled|retrieved|drawn|revealed|moved)\.(count|event_count|names_are_distinct)$/);
    if (m) { const ids=ctx.bind[m[1]] || []; return m[2]==='count'?ids.length:m[2]==='event_count'?ids.filter(id=>this.card(id).printed.type==='event').length:new Set(ids.map(id=>this.effectiveName(id))).size===ids.length; }
    if (field==='optional.performed') return ctx.bind.optional?.performed ?? false;
    m=field.match(/^(source|target)\.(effective_name|role|entry_origin|entry_reason|entry_turn|current_(?:serve|receive|block|toss|attack))$/);
    if (m) {
      const ref=m[1]==='source'?ctx.source:ctx.bind.target;
      if (!this.current(ref)) return null;
      const c=this.card(ref.id), key=m[2];
      if (key==='effective_name') return this.effectiveName(ref.id);
      if (key==='role') return this.role(ref.id);
      if (key.startsWith('current_')) return this.parameter(ref.id,key.slice(8));
      return c[{entry_origin:'entryOrigin',entry_reason:'entryReason',entry_turn:'entryTurn'}[key]] ?? null;
    }
    throw new NeedsReview('Unsupported fact '+field);
  }
  _predicate(node,ctx) {
    if (node.kind==='all') return node.conditions.every(c=>this._predicate(c,ctx));
    if (node.kind==='any') return node.conditions.some(c=>this._predicate(c,ctx));
    if (node.kind==='equal_fields') return node.fields.every(f=>same(this._fact(f,ctx),this._fact(node.fields[0],ctx)));
    if (node.kind==='compare') {
      const a=this._fact(node.field,ctx), b=node.value;
      if (a===null) return false;
      if (node.op==='eq') return same(a,b);
      if (node.op==='in') return b.includes(a);
      if (node.op==='contains') { need(Array.isArray(a),'Contains expects a set');return a.includes(b); }
      if (node.op==='lt_field') return a<this._fact(b,ctx);
      need(Number.isInteger(a),'Numeric comparison requires an integer');
      if (node.op==='gte') return a>=b;
      if (node.op==='lte') return a<=b;
      if (node.op==='odd') return (Math.abs(a)%2===1)===b;
    }
    if (node.kind==='count_compare') {
      need(['eq','gte','lte'].includes(node.op)&&Number.isInteger(node.value)&&node.value>=0,'Unsupported count comparison');
      need(node.distinct_by==null||node.distinct_by==='effective_name_in_current_zone','Unsupported count identity');
      const ids=this.pool(node.pool,ctx), n=node.distinct_by ? new Set(ids.map(id=>this.effectiveName(id))).size : ids.length;
      return node.op==='eq'?n===node.value:node.op==='gte'?n>=node.value:n<=node.value;
    }
    if (node.kind==='uniform_affiliation') {
      const ids=node.pools?node.pools.flatMap(p=>this.pool(p,ctx)):this.pool(node.pool,ctx);
      return ids.length>0 && node.options.some(tag=>ids.every(id=>this.card(id).printed.affiliation_tags.includes(tag)));
    }
    if (node.kind==='all_result_cards_match') { const ids=ctx.bind[node.result] || []; return ids.length>0 && ids.every(id=>this.matches(id,node.filters,ctx)); }
    throw new NeedsReview('Unsupported predicate '+node.kind);
  }
  _protected(target,param,ctx) {
    return this.state.effects.some(e=>e.kind==='protect' && this.active(e) && (e.parameter==='all' || e.parameter===param) &&
      (typeof target==='string' ? e.ballOwner===(target==='self_ball'?ctx.controller:1-ctx.controller) : this.current(target)&&(e.selector?this.pool(e.selector,{controller:e.controller}).includes(target.id):e.targets.some(r=>same(r,target)))));
  }
  _numeric(node,ctx) {
    const targets=this._targets(node,ctx); let performed=false;
    ctx.bind.target=targets[0] || null;
    for (const target of targets) {
      let params=node.parameter==='all'?PARAMS:typeof node.parameter==='object'?node.parameter.choose_from:[node.parameter];
      if (params.includes('chosen') || typeof node.parameter==='object') {
        need(typeof target!=='string','Cannot choose character parameter on ball');
        const allowed=(params.includes('chosen')?PARAMS:params).filter(p=>this.parameter(target.id,p)!=='dash');
        if (!allowed.length) continue;
        const p=this._decide('parameter',ctx,allowed,{target:clone(target)}); legal(allowed.includes(p),'Invalid parameter');params=[p];
      }
      let value=node.value;
      if (typeof value==='object') {
        if (value.kind==='result_count') value=(ctx.bind[value.result] || []).length;
        else if (value.kind==='printed_parameter') { need(typeof target!=='string','Printed ball value unsupported');value=this.card(target.id).printed.parameters[value.parameter]; }
        else if (value.kind==='sum_result_parameter') value=(ctx.bind[value.result] || []).reduce((n,id)=>{const v=this.card(id).printed.parameters?.[value.parameter];return n+(Number.isInteger(v)?v:0);},0); // 「－」沒有該參數，合計僅累加實際存在的數值
        else throw new NeedsReview('Unsupported numeric expression');
      }
      need(Number.isInteger(value),'Numeric value must be an integer');
      for (const param of params) {
        if (typeof target==='string') {
          const owner=target==='self_ball'?ctx.controller:1-ctx.controller;
          need(this.state.ball && this.state.ball.owner===owner,'Ball target unavailable');
          need(['offense','attack_offense'].includes(param),'Unsupported ball domain');
          if (param==='attack_offense' && this.state.ball.kind!=='attack') continue;
          if (node.operation==='add' && value<0 && this._protected(target,'offense',ctx)) continue;
          need(node.operation==='add','Ball set is not implemented');
          this.state.ball.offense+=value; performed ||= value!==0;
        } else {
          const old=this.parameter(target.id,param); if (old==='dash') continue;
          const protectedValue=this._protected(target,param,ctx);
          if (node.operation==='add' && value<0 && protectedValue) continue;
          if(node.operation==='set' && value<old && protectedValue)continue;
          if (node.operation==='add' && value===0 || node.operation==='set' && value===old) continue;
          let applied=value;
          if(node.increase_guard){
            need(node.increase_guard.kind==='source_skill_maximum'&&node.operation==='add'&&value>=0,'Unsupported numeric guard');
            // Guard this increment, never the final value of other effects.
            applied=Math.min(value,Math.max(0,node.increase_guard.max_result-old));
            if(!applied)continue;
          }
          this.effect('numeric',{target,parameter:param,operation:node.operation,value:applied},ctx,node.duration);
          performed=true;
        }
      }
    }
    return performed;
  }
  _context(source,controller,event={}) { return {source:source?this.reference(source):null,controller,event:clone(event),bind:{paid:[],milled:[],retrieved:[],drawn:[],target:null,entered:null},paid:[],inPayment:false}; }
  preflight(program) {
    walk(program,n=>{
      if (n.shared_rule_ids) for (const r of n.shared_rule_ids) need(this.ruleIds.has(r),'Unknown shared rule '+r);
      if (n.kind && !['selector','compare','all','any','equal_fields','count_compare','uniform_affiliation','all_result_cards_match','printed_parameter','sum_result_parameter','result_count','source_skill_maximum'].includes(n.kind)) need(KINDS.has(n.kind),'Unsupported mechanism '+n.kind);
      if(n.group_constraints)this._retrieveCompatible([],n.group_constraints);
      if (n.filters) for (const k of Object.keys(n.filters)) need(FILTERS.has(k),'Unsupported filter '+k);
      if (n.target_scope) need(n.target_scope.membership==='snapshot_on_resolution'||n.kind==='protect_numeric_decrease'&&n.target_scope.membership==='continuous_matching','Target membership is not supported');
      if(n.kind==='protect_numeric_decrease')validateProtection(n);
      if(n.destination)need((!n.destination.includes('choose_deck') || ['choose_deck_top_or_bottom','self.choose_deck_top_or_bottom'].includes(n.destination)) && !n.destination.endsWith('.deck_top'),'Destination mechanism not implemented');
      if(n.kind==='invalidate_skill')validateInvalid(n);
      if(n.kind==='ban_action')validateBan(n);
      if(n.kind==='formal_declaration_cost')need(n.must_be_complete===true&&n.performed_for_this_skill_only===true&&Array.isArray(n.steps)&&n.steps.length>0,'Unsupported declaration cost parameters');
      if(n.kind==='exchange')need(Array.isArray(n.sides)&&n.sides.length===2&&n.sides.every(x=>x&&x.kind==='selector')&&n.count_each===1&&n.count_mode==='upto'&&n.requires_both===true&&n.atomic_movement===true,'Unsupported exchange parameters');
      if(n.kind==='each_player_optional_draw')need(Number.isInteger(n.count)&&n.count>0&&n.count_mode==='exact_or_zero'&&n.chooser==='each_affected_player','Unsupported optional draw parameters');
      if(n.kind==='mill')need(['self','opponent'].includes(n.actor)&&['exact','upto'].includes(n.count_mode)&&Number.isInteger(n.count)&&n.count>=0&&n.bind==='milled','Unsupported mill parameters');
      if(n.kind==='optional')need(n.bind==='optional'&&[undefined,'self','opponent'].includes(n.actor)&&n.then?.kind==='sequence','Unsupported optional parameters');
      if(n.kind==='choose_modes')need(n.count===1&&n.required===true&&Array.isArray(n.options)&&n.options.length>0&&n.options.every(o=>o&&KINDS.has(o.kind)),'Unsupported mode parameters');
      if(n.kind==='all_result_cards_match')need(['paid','milled','revealed'].includes(n.result)&&n.require_nonempty===true,'Unsupported result-match parameters');
      if(n.kind==='rename_before_entry')need(n.target==='source'&&n.character_count===1&&Array.isArray(n.choose_name)&&n.choose_name.length===2&&n.choose_name.every(x=>typeof x==='string')&&['this_turn','this_turn_or_role_exit'].includes(n.duration),'Unsupported entry-name parameters');
      if(n.kind==='keyword')need(['one_touch','doshat','feint','blockout','a_pass','two_attack','back_attack','multi_attack'].includes(n.keyword)&&Number.isInteger(n.N)&&n.N>=0&&Object.keys(n.parameters||{}).every(k=>n.keyword==='multi_attack'&&k==='affiliation')&&(n.keyword!=='multi_attack'||typeof n.parameters?.affiliation==='string'),'Keyword parameters not implemented: '+n.keyword);
      if (n.kind==='compare') {
        need(new Set(['random.result','revealed.affiliation_intersects_self_court','opponent.block_defense','self.attack.guts.count','self.court.distinct_affiliation_assignment_count','source.covered_character.tags','source.covered_character.positions','source.covered_character.effective_name','source.entry_skill_name','revealed.count','moved.count']).has(n.field)||/^(phase|current_turn_id|both\.set\.count_sum|opponent_ball\.(kind|offense)|(self|opponent)\.(hand|sets|set)\.count|(self|opponent)\.(serve|receive|toss|attack)\.(effective_name|printed_attack)|(paid|milled|retrieved|drawn)\.(count|event_count|names_are_distinct)|optional\.performed|(source|target)\.(effective_name|role|entry_origin|entry_reason|entry_turn|current_(serve|receive|block|toss|attack)))$/.test(n.field),'Fact is not implemented: '+n.field);
      }
    });
  }
  _paymentAvailable(payment,ctx) {
    // Probe only the cost on a private checkpoint; never ask or publish a choice.
    const saved=clone(this.state),choose=this.choose,probe=clone(ctx);probe.inPayment=true;probe.paid=[];
    this.choose=req=>req.count!=null?req.options.slice(0,req.count):req.options[0];
    try {this._run(payment,probe);return true;}catch(e){if(e instanceof Unpayable)return false;throw e;}
    finally {this.state=saved;this.choose=choose;}
  }
  _run(node,ctx) {
    switch (node.kind) {
      case 'sequence': { let yes=false;for (const step of node.steps) yes=this._run(step,ctx)||yes;return yes; }
      case 'conditional': return this._predicate(node.condition,ctx) ? this._run(node.then,ctx):false;
      case 'deck_selection': return this._deckSelection(node,ctx);
      case 'numeric': return this._numeric(node,ctx);
      case 'draw': { const player=this.owner(node.actor,ctx);let n=node.count;
        if(!this._handAllowed(player,ctx)){ctx.bind.drawn=[];return false;}
        if (node.count_mode==='upto') { const max=Math.min(n,this.zone(player,'deck').length);n=this._decide('draw_count',ctx,Array.from({length:max+1},(_,i)=>i),{player});legal(Number.isInteger(n)&&n>=0&&n<=max,'Invalid draw choice'); }
        ctx.bind.drawn=this._draw(player,n,ctx);return ctx.bind.drawn.length>0; }
      case 'draw_to_hand_size': { const player=this.owner(node.actor,ctx);ctx.bind.drawn=this._draw(player,Math.max(0,node.hand_size-this.zone(player,'hand').length),ctx);return ctx.bind.drawn.length>0; }
      case 'move': case 'retrieve': return this._moveSelected(node,ctx);
      case 'move_self': { const id=ctx.source.id, dest=this._destination(node.destination,id,ctx);
        if(this.card(id).incarnation!==ctx.source.incarnation||this.card(id).zone===dest.player+'.'+dest.zone){if(ctx.inPayment)throw new Unpayable();ctx.bind[node.bind||'moved']=[];return false;}
        if(dest.zone==='hand'&&!this._handAllowed(dest.player,ctx)){if(ctx.inPayment)throw new Unpayable();ctx.bind.moved=[];return false;}
        this._move(id,dest.player,dest.zone,ctx,node.reason);if(dest.bottom){const d=this.zone(dest.player,'deck');d.unshift(d.pop());}ctx.bind.moved=[id];if(ctx.inPayment)ctx.paid.push(id);
        if(dest.zone==='hand')this._emit({type:'hand_added',player:dest.player,card:id,operation:'add_hand'});return true; }
      // Claude 長尾節點（2026-10-22）。交換：兩側各最多 1 張，必須兩側都選才交換（QA：不能只移單邊）；一次原子移動。
      case 'exchange': {
        const player=ctx.controller,[a,b]=node.sides.map(sel=>this.pool(sel,ctx));
        const toHand=node.sides.map(sel=>sel.zone==='hand');
        // 一側是手牌時，另一側的牌會加入手牌：被禁止加牌就不能交換（QA：岩泉）
        if(!a.length||!b.length||toHand.some(Boolean)&&!this._handAllowed(player,ctx)){ctx.bind[node.bind||'exchanged']=[];return false;}
        const n=this._decide('move_count',ctx,[0,1],{player,selectionAction:'exchange'});legal(n===0||n===1,'Invalid exchange count');
        if(!n){ctx.bind[node.bind||'exchanged']=[];return false;}
        const x=this._selection(a,1,ctx,'move_cards',player,{destination:'self.'+node.sides[1].zone,selectionAction:'exchange'})[0],y=this._selection(b,1,ctx,'move_cards',player,{destination:'self.'+node.sides[0].zone,selectionAction:'exchange'})[0];
        const place=(id,zone)=>{const area=zone.split('.')[0];if(zone==='hand'){this._move(id,player,'hand',ctx);this._emit({type:'hand_added',player,card:id,operation:'add_hand'});}else{legal(zone.endsWith('.guts')&&COURT.includes(area),'Unsupported exchange zone '+zone);this._move(id,player,area,ctx,'effect',true);}};
        place(x,node.sides[1].zone);place(y,node.sides[0].zone);
        ctx.bind[node.bind||'exchanged']=[x,y];return true;
      }
      // 自己與對手各自決定要不要抽 count 張（只能全抽或不抽；QA）；牌庫不足時能抽多少抽多少。
      case 'each_player_optional_draw': {
        const drawn=[];
        for(const player of [ctx.controller,1-ctx.controller]){
          const n=this._decide('draw_count',ctx,[0,node.count],{player});legal(n===0||n===node.count,'Invalid optional draw');
          if(n)drawn.push(...this._draw(player,n,ctx));
        }
        ctx.bind[node.bind||'drawn']=drawn;return drawn.length>0;
      }
      case 'mill': { const ids=this.zone(this.owner(node.actor,ctx),'deck'),player=this.owner(node.actor,ctx);let n=node.count;
        if (ctx.inPayment && node.count_mode==='exact' && ids.length<n) throw new Unpayable();
        n=Math.min(n,ids.length);if(node.count_mode==='upto'){const max=n;n=this._decide('mill_count',ctx,Array.from({length:n+1},(_,i)=>i));legal(Number.isInteger(n)&&n>=0&&n<=max,'Invalid mill count');}
        const moved=[];for(let i=0;i<n;i++){const id=this.top(player,'deck');this._move(id,player,'drop',ctx);moved.push(id);}ctx.bind.milled=moved;if(ctx.inPayment)ctx.paid.push(...moved);return moved.length>0; }
      case 'formal_declaration_cost': return this._formalCost(node,ctx);
      case 'pay_guts': { if(node.areas==='source_area'&&!this.current(ctx.source))throw new Unpayable();const areas=node.areas==='court'?COURT:node.areas==='source_area'?[this.card(ctx.source.id).zone.split('.')[1].startsWith('side:')?'block':this.card(ctx.source.id).zone.split('.')[1]]:node.areas;
        if(node.count_mode==='exact_each'){
          if(areas.some(a=>this.zone(ctx.controller,a).length-1<node.count_each))throw new Unpayable();
          const paid=[];for(const area of areas){const ids=this.zone(ctx.controller,area).slice(0,-1);paid.push(...this._selection(ids,node.count_each,ctx,'guts',ctx.controller,{area}));}
          for(const id of paid)this._move(id,this.card(id).owner,'drop',ctx);
          ctx.bind[node.bind]=paid;ctx.paid.push(...paid);return paid.length>0;
        }
        const ids=areas.flatMap(a=>this.zone(ctx.controller,a).slice(0,-1));let n=node.count;
        if(node.count_mode==='one_of_exact'){const counts=node.allowed_counts.filter(n=>n<=ids.length);if(!counts.length)throw new Unpayable();n=this._decide('payment_count',ctx,counts);legal(counts.includes(n),'Invalid Guts amount');}
        if(ids.length<n)throw new Unpayable();const paid=this._selection(ids,n,ctx,'guts');for(const id of paid)this._move(id,this.card(id).owner,'drop',ctx);ctx.bind.paid=paid;ctx.paid.push(...paid);return paid.length>0; }
      case 'payment_branch': {
        const effects=[];walk(node.then,n=>{if(KINDS.has(n.kind)&&!['sequence','conditional'].includes(n.kind))effects.push(n);});
        if(effects.length&&effects.every(n=>n.kind==='keyword'&&!this._keywordAvailable(ctx,n.keyword)))return false;
        if(!this._paymentAvailable(node.payment,ctx))return false;
        // Warn without forbidding a human choice. A serving/blocking ball has
        // no attack-offense field; do not confuse an old attack card with it.
        const leaves=[];walk(node.then,n=>{if(KINDS.has(n.kind)&&!['sequence','conditional'].includes(n.kind))leaves.push(n);});
        const attackOnly=leaves.length>0&&leaves.every(n=>n.kind==='numeric'&&n.target==='opponent_ball'&&n.parameter==='attack_offense');
        const protectedAttack=attackOnly&&leaves.every(n=>n.operation==='add'&&Number.isInteger(n.value)&&n.value<0)&&this._protected('opponent_ball','offense',ctx);
        const ineffectiveReason=attackOnly&&this.state.ball?.kind!=='attack'?'來球不是攻擊，攻擊進攻值效果無效；支付費用不會改變來球數值。':protectedAttack?'來球受到防降保護，支付費用不會降低來球數值。':null;
        const yes=this._decide('activate_payment',ctx,[true,false],{payment:node.payment,...(ineffectiveReason?{ineffectiveReason}:{})});legal(typeof yes==='boolean','Payment decision must be boolean');if(!yes)return false;
        const saved=clone(this.state), before=clone(ctx);ctx.inPayment=true;ctx.paid=[];
        try {this._run(node.payment,ctx);} catch(e) {if(!(e instanceof Unpayable))throw e;this.state=saved;Object.assign(ctx,before);return false;}
        ctx.inPayment=false;ctx.bind.paid=[...ctx.paid];return this._run(node.then,ctx)||ctx.paid.length>0;
      }
      case 'optional': { const yes=this._modeAvailable(node.then,ctx)?this._decide('optional',ctx,[true,false],{player:this.owner(node.actor||'self',ctx),effectDescription:modeLabel(node.then)}):false;legal(typeof yes==='boolean','Optional decision must be boolean');ctx.bind.optional={performed:yes&&this._run(node.then,ctx)};return ctx.bind.optional.performed; }
      case 'choose_modes': {
        const options=node.options.map((_,i)=>i).filter(i=>this._modeAvailable(node.options[i],ctx));
        if(!options.length)return false;
        const i=this._decide('mode',ctx,options,{effectModes:true,modeLabels:node.options.map(modeLabel)});
        legal(options.includes(i),'Invalid mode');return this._run(node.options[i],ctx);
      }
      case 'rename_before_entry': {
        const options=(ctx.entryNames||node.choose_name).filter(name=>node.choose_name.includes(name));
        legal(options.length>0,'No legal entry name');
        const name=this._decide('name',ctx,options);legal(options.includes(name),'Invalid entry name');
        const entry={name,duration:node.duration};
        if(ctx.entryNames)ctx.entryName=entry;else this._applyEntryName(ctx.source.id,entry,ctx);
        return true;
      }
      case 'watch': this._registerWatch(node,ctx);return true;
      case 'ban_action': this.effect('ban',{actor:this.owner(node.actor,ctx),action:node.action,scope:node.scope},ctx,node.duration);return true;
      case 'invalidate_skill': this.effect('invalid',{actor:this.owner(node.actor,ctx),selector:node.selector},ctx,node.duration);return true;
      case 'protect_numeric_decrease': {
        if(node.target_scope.membership==='continuous_matching'){this.effect('protect',{targets:[],ballOwner:null,parameter:node.parameter,selector:node.target},ctx,node.duration);return true;}
        const targets=this._targets(node,ctx);if(!targets.length)return false;const ball=typeof targets[0]==='string';this.effect('protect',{targets:ball?[]:targets,ballOwner:ball?(targets[0]==='self_ball'?ctx.controller:1-ctx.controller):null,parameter:node.parameter},ctx,node.duration);return true;
      }
      case 'phase_jump': this._jump(node.destination);return true;
      case 'keyword': return this._keyword(node,ctx);
      case 'enter': case 'enter_self': { const ids=node.kind==='enter_self'?[ctx.source.id]:this.pool(node.pool,ctx).filter(id=>this._entryOptions(id,ctx.controller,node.destination,node.as_side_blocker,'skill').names.length);let n=node.kind==='enter_self'?1:Math.min(node.count,ids.length);
        if(node.count_mode==='upto'){const max=n;n=this._decide('entry_count',ctx,Array.from({length:n+1},(_,i)=>i));legal(Number.isInteger(n)&&n>=0&&n<=max,'Invalid entry count');}
        if(!n){ctx.bind.entered=null;return false;}need(n===1,'Multiple entry transaction not implemented');const id=node.kind==='enter_self'?ids[0]:this._selection(ids,1,ctx,'entry')[0];ctx.bind.entered=this._enter(id,ctx.controller,node.destination,ctx,'skill',node.as_side_blocker,true);return !!ctx.bind.entered; }
      default: throw new NeedsReview('Unsupported operation '+node.kind);
    }
  }
  _keywordAllowed(ctx,keywordFamily) {return this.permission({action:'use_keyword',player:ctx.controller,origin:'skill',keywordFamily}).allowed;}
  _modeAvailable(node,ctx) {
    // Explore only immediate resolution on private checkpoints. Never resolve
    // queued future triggers, publish decisions, consume resources or RNG.
    const saved=clone(this.state),choose=this.choose;
    const explore=answers=>{
      this.state=clone(saved);let cursor=0;
      this.choose=req=>{if(cursor<answers.length)return clone(answers[cursor++]);throw new ModeChoice(req);};
      try{return !!this._run(node,clone(ctx));}
      catch(e){
        if(e instanceof IllegalAction||e instanceof Unpayable)return false;
        if(!(e instanceof ModeChoice))throw e;
        const req=e.request;
        if(req.kind==='revealResult')return explore([...answers,[]]);
        if(req.kind==='reveal')return explore([...answers,true]);
        if(req.count!=null){
          const combinations=[];
          const collect=(start,pick)=>{if(pick.length===req.count){combinations.push(pick);return;}for(let i=start;i<=req.options.length-(req.count-pick.length);i++)collect(i+1,[...pick,req.options[i]]);};collect(0,[]);
          return combinations.some(value=>explore([...answers,value]));
        }
        return [...req.options].reverse().some(value=>explore([...answers,value]));
      }
    };
    try{return explore([]);}finally{this.state=saved;this.choose=choose;}
  }
  _keywordAvailable(ctx,keywordFamily) {
    if(!this._keywordAllowed(ctx,keywordFamily))return false;
    if(keywordFamily!=='back_attack')return true;
    const id=ctx.source?.id,c=id&&this.card(id);
    return !!(c&&c.incarnation===ctx.source.incarnation&&(this.current(ctx.source)||c.zone===ctx.controller+'.hand')&&this._entryOptions(id,ctx.controller,'attack',false,'skill').names.length);
  }
  _keyword(node,ctx) {
    if(!this._keywordAvailable(ctx,node.keyword))return false;
    const p=ctx.controller,n=node.N,kind=node.keyword,scope={mode:'single',binding:'reference',membership:'snapshot_on_resolution'};
    if(kind==='one_touch'){
      need(this.state.turn.phase==='block'&&this.state.ball?.kind==='attack','One touch requires an incoming attack in block phase');
      this._numeric({target:'opponent_ball',target_scope:scope,parameter:'attack_offense',value:-n,operation:'add'},ctx);this._jump('draw');return true;
    }
    if(kind==='two_attack'){this.state.keywordOutgoing={player:p,kind:'attack',offense:n,turn:this.state.turn.id};this._jump('end');return true;}
    if(kind==='back_attack'){
      const id=ctx.source.id,c=this.card(id);legal(c.incarnation===ctx.source.incarnation&&(this.current(ctx.source)||c.zone===p+'.hand'),'Back attack requires a current source character or its actual hand card');
      ctx.bind.entered=this._enter(id,p,'attack',ctx,'skill',false,false,'back_attack');
      this._numeric({target:'$entered',target_scope:scope,parameter:'attack',value:n,operation:'set'},ctx);return true;
    }
    if(kind==='multi_attack'){
      const tag=node.parameters.affiliation,attack=this.top(p,'attack'),setter=this.top(p,'toss');
      if(!attack||!setter||!this.court(p).every(id=>this.card(id).printed.affiliation_tags.includes(tag)))return false;
      const ids=COURT.flatMap(z=>this.zone(p,z).slice(0,-1)).filter(id=>this.card(id).printed.affiliation_tags.includes(tag)&&this.effectiveName(id)!==this.effectiveName(setter));
      if(!ids.length)return false;
      const count=this._decide('payment_count',ctx,Array.from({length:Math.min(n,ids.length)+1},(_,i)=>i));
      legal(Number.isInteger(count)&&count>=0&&count<=Math.min(n,ids.length),'Invalid multi-attack count');if(!count)return false;
      const paid=this._selection(ids,count,ctx,'payment_cards');for(const id of paid)this._move(id,p,'drop',ctx);
      const value=new Set(paid.map(id=>this.effectiveName(id))).size;ctx.bind.target=this.reference(attack);
      return this._numeric({target:'$target',target_scope:scope,parameter:'attack',value,operation:'add'},ctx);
    }
    if(kind==='blockout'&&ctx.event.keywordResolution==='blockout'){
      this.state.forcedLoss={player:this.state.turn.player,reason:'ブロックアウト：原始攔網值不大於 '+n};this.state.queue=[];return true;
    }
    need(['doshat','feint','blockout','a_pass'].includes(kind),'Keyword not implemented: '+kind);
    this.effect('keyword',{keyword:kind,N:n,parameters:node.parameters||{},actor:kind==='blockout'?1-p:p},ctx,kind==='blockout'?'next_opponent_turn':'this_turn');return true;
  }
  outgoing(kind,offense) { return this._atomic(()=>{
    const p=this.state.turn.player,override=this.state.keywordOutgoing;
    if(override?.turn===this.state.turn.id&&override.player===p){kind=override.kind;offense=override.offense;}
    const effects=this.state.effects.filter(e=>e.kind==='keyword'&&e.actor===p&&this.active(e)&&e.keyword===(kind==='block'?'doshat':kind==='attack'?'feint':null));
    if(effects.length){const options=[...new Set(effects.map(e=>e.N))],value=options.length===1?options[0]:this._decide('mode',this._context(null,p),options,{keywordOutgoing:true});legal(options.includes(value),'Invalid outgoing value');offense=value;
      if(kind==='attack'&&!this.state.effects.some(e=>e.kind==='keyword'&&e.keyword==='feint_block_ban'&&e.createdTurn===this.state.turn.id))this.effect('keyword',{keyword:'feint_block_ban',N:0,parameters:{},actor:1-p,createdTurn:this.state.turn.id},this._context(null,p),'next_opponent_turn');
    }
    return {kind,offense};
  }); }
  _registerWatch(node,ctx) {
    this.preflight(node.then);legal(['character_entry','hand_added','source_moved','loss','turn_end','block_success'].includes(node.event),'Unknown trigger event');
    return this.effect('watch',{event:node.event,actor:this.owner(node.actor,ctx),filters:node.filters || {},then:node.then,remaining_uses:node.remaining_uses??null,remaining:node.remaining_uses ?? null},ctx,node.duration);
  }
  _emit(event) {
    event={phase:this.state.turn.phase,window:this.state.turn.id+':'+this.state.turn.phase,...clone(event)};
    if(event.type==='character_entry')event.effectiveName??=this.effectiveName(event.card);
    this.state.events.push(clone(event));
    for(const e of this.state.effects)if(e.kind==='keyword'&&this.active(e)&&e.actor===event.player&&event.type==='character_entry'){
      let program=null;
      if(e.keyword==='a_pass'&&event.role==='toss')program={kind:'numeric',target:'$event.character',target_scope:{mode:'single',binding:'reference',membership:'snapshot_on_resolution'},parameter:'toss',operation:'add',value:e.N};
      if(e.keyword==='blockout'&&['center_blocker','side_blocker'].includes(event.role)&&Number.isInteger(this.card(event.card).printed.parameters.block)&&this.card(event.card).printed.parameters.block<=e.N)program={kind:'keyword',keyword:'blockout',N:e.N,parameters:{}};
      if(program)this.state.queue.push({id:this.id('q'),controller:e.controller,source:e.source,event:{...event,keywordResolution:e.keyword},program,generated:true,window:event.window});
    }
    for (const e of this.state.effects) if(e.kind==='watch' && this.active(e) && e.actor===event.player && e.event===event.type && e.remaining!==0) {
      if(e.event==='source_moved'&&event.card!==e.source?.id)continue;
      const id=event.card || event.character?.id;
      if(Object.keys(e.filters).length && (!id || !this.matches(id,e.filters,{controller:e.controller},event)))continue;
      if(e.remaining!==null)e.remaining--;
      this.state.queue.push({id:this.id('q'),controller:e.controller,source:e.source,event,program:clone(e.then),generated:true,window:event.window});
    }
    if(event.type==='character_entry')this._entryObservers(event);
  }
  _entryObservers(event) {
    const sources=event.passiveSources??[0,1].flatMap(player=>this.court(player).map(id=>({source:this.reference(id),role:this.role(id)})));
    for(const {source,role}of sources){
      const c=this.card(source.id),p=this.profile(source.id),a=p.activation,t=a?.trigger;
      if(!p.program||a?.skill_type!=='passive'||t?.event!=='character_entry'||this.mode==='live'&&!p.runtime_approved)continue;
      if(this.owner(t.actor,{controller:c.owner,source})!==event.player||t.source_role&&!this.roleMatches(role,t.source_role))continue;
      if(!this.matches(event.card,t.filters||{},{controller:c.owner},event))continue;
      this._admit(p);
      const ctx=this._context(source.id,c.owner,event);ctx.source=source;
      if(!this._skillAllowed(ctx,p))continue;
      this.state.queue.push({id:this.id('q'),controller:c.owner,source:clone(source),event:clone(event),program:p.program,profileId:p.profile_id,generated:false,window:event.window});
    }
  }
  _enqueuePassive(id,event) {
    const p=this.profile(id),a=p.activation;if(!p.program || a?.skill_type!=='passive' || a.trigger?.event!=='self_entry')return;
    if(!a.trigger.destination_any.some(r=>r==='court'||this.roleMatches(event.role,r)))return;
    this._admit(p);
    this.state.queue.push({id:this.id('q'),controller:this.card(id).owner,source:clone(event.character),event,program:p.program,profileId:p.profile_id,generated:false,window:event.window});
  }
  _drain() {
    if(this.depth || this.draining)return;
    this.draining=true;
    try {
      let count=0;
      while(this.state.queue.length){need(++count<500,'Trigger loop limit reached');
        const player=this.state.queue.some(q=>q.controller===this.state.turn.player)?this.state.turn.player:1-this.state.turn.player;
        const own=this.state.queue.filter(q=>q.controller===player);
        const id=own.length===1?own[0].id:this._decide('trigger_order',{controller:player,source:null},own.map(q=>q.id));
        legal(own.some(q=>q.id===id),'Invalid trigger order');const index=this.state.queue.findIndex(q=>q.id===id),job=this.state.queue.splice(index,1)[0];
        if(!job.generated && (!this.state.cards[job.source.id] || ['hand','deck','sets'].includes(this.card(job.source.id).zone.split('.')[1])))continue;
        const ctx=this._context(job.source?.id,job.controller,job.event);ctx.source=job.source;
        if(!job.generated && !this._skillAllowed(ctx,this.profiles[job.profileId]))continue;
        this.state.events.push({type:'resolve_trigger',id:job.id,controller:job.controller,generated:job.generated});
        if(job.generated){this.depth++;try{this._run(job.program,ctx);}finally{this.depth--;}}
        else this._resolveSkill(this.profiles[job.profileId],ctx);
      }
    }finally{this.draining=false;}
  }
  _skillAllowed(ctx,p) {
    const id=ctx.source.id,c=this.card(id),a=p.activation;
    if(this.state.locks.some(l=>l.player===ctx.controller&&l.turn===this.state.turn.id&&l.name===this.effectiveName(id)))return false;
    return this.permission({action:'use_skill',player:ctx.controller,origin:'skill',role:this.role(id),name:this.effectiveName(id),
      phaseTags:a.activation_phases,sourceZone:c.zone.split('.')[1],icons:a.activation_phases,type:c.printed.type}).allowed;
  }
  _admit(p) { need(p?.program && p.activation,'Skill profile required');need(this.mode==='sandbox' || p.runtime_approved,'Card not approved for live execution');need(!p.flags?.some(f=>['TARGET_MEMBERSHIP_UNRESOLVED','OFFICIAL_TEXT_VARIANTS_PRESERVED','SHARED_MECHANISM_EXTENSION_NEEDS_CONFIRMATION','OPTIONAL_EXACT_PAYMENT_BRANCH_SCENARIO_REVIEW'].includes(f)),'Profile requires ruling review');
    if(p.activation.skill_type==='passive')need(['self_entry','character_entry'].includes(p.activation.trigger?.event),'Non-entry passive triggers not implemented');
    if(p.activation.trigger?.event==='character_entry'){const t=p.activation.trigger;need(t.source_role_checkpoint==='at_trigger'&&['self','opponent'].includes(t.actor)&&[null,'serve','receive','toss','attack','block'].includes(t.source_role)&&JSON.stringify(p.activation.source_zones)==='["court"]','Unsupported character-entry trigger');for(const key of Object.keys(t.filters||{}))need(FILTERS.has(key),'Unsupported entry filter '+key);}
    this.preflight(p.program);if(p.formal_cost)this.preflight(p.formal_cost); }
  _formalCost(node,ctx) {
    const previous=ctx.inPayment;ctx.inPayment=true;ctx.paid=[];ctx.bind.paid=[];
    try {for(const step of node.steps)this._run(step,ctx);}
    catch(e){if(e instanceof Unpayable)throw new IllegalAction('Formal declaration cost cannot be paid');throw e;}
    finally {ctx.inPayment=previous;}
    ctx.bind.paid=[...ctx.paid];return ctx.paid.length>0;
  }
  _resolveSkill(p,ctx) {
    const name=this.effectiveName(ctx.source.id);
    if(p.formal_cost)this._run(p.formal_cost,ctx);
    this.depth++;let performed;try{performed=this._run(p.program,ctx);}finally{this.depth--;}
    if(performed&&p.limit)this.state.locks.push({player:ctx.controller,name,turn:this.state.turn.id});
    return performed;
  }
  _use(id,{event=false,trigger=false}={}) {
    const p=this.profile(id),a=p.activation,controller=this.card(id).owner;
    this._admit(p);const ctx=this._context(id,controller);
    legal(controller===this.state.turn.player || trigger,'Only the turn player can declare an active action');
    legal(this.state.stage==='rally'&&this.state.turn.step==='free','Not a free step');
    legal(event || !this.state.queue.length,'Pending triggers must resolve first');
    if(!trigger){legal(['active','event'].includes(a.skill_type),'This skill needs its trigger');
      legal(this._phaseAllowed(p),'Skill phase mismatch');
      legal(event || a.source_zones.includes(this.card(id).zone.split('.')[1]),'Skill source zone mismatch');}
    if(!this._skillAllowed(ctx,p))return {performed:false,invalid:true};
    if(a.reveal_source_on_declaration)this.state.publicLog.push({type:'skill_declared',player:controller,cardNo:this.card(id).cardNo});
    const performed=this._resolveSkill(p,ctx);
    this._drain();return {performed,invalid:false};
  }
  _entryCounts(player,origin,count=1) {
    const current=this.state.turn.blockEntriesByOrigin?.[player]||{hand:this.state.turn.blockEntries?.[player]||0};return {...current,[origin]:(current[origin]||0)+count};
  }
  _recordBlockEntry(player,origin) {
    const counts=this._entryCounts(player,origin);this.state.turn.blockEntriesByOrigin ||= [{},{}];this.state.turn.blockEntriesByOrigin[player]=counts;this.state.turn.blockEntries ||= [0,0];this.state.turn.blockEntries[player]++;
  }
  _entryOptions(id,player,area,side=false,origin='hand') {
    const c=this.card(id);let dest=area;
    if(side){dest=['side:0','side:1'].find(z=>!this.top(player,z));if(!dest||!this.top(player,'block'))return {dest,names:[]};}
    if(!COURT.includes(dest)||c.printed.type!=='character')return {dest,names:[],error:'Invalid character destination'};
    const parameter=dest.startsWith('side:')||dest==='block'?'block':dest;
    if(c.printed.parameters[parameter]==='dash')return {dest,names:[],error:'Dash parameter cannot enter'};
    const other=dest==='attack'?this.top(player,'toss'):dest==='toss'?this.top(player,'receive'):null;
    const entryCount=parameter==='block'?(this.state.turn.blockEntries?.[player]||0)+1:1;
    const names=this.entryNames(id).filter(name=>(!other||this.effectiveName(other)!==name)&&(parameter!=='block'||!['block','side:0','side:1'].map(z=>this.top(player,z)).filter(x=>x&&x!==id).some(x=>this.effectiveName(x)===name))&&this.permission({action:'enter_character',player,origin:origin==='skill'?'skill':'rule',role:parameter==='block'?(side?'side_blocker':'center_blocker'):dest,entryOrigin:c.zone.split('.')[1]==='hand'?'hand':this.role(id)==='guts'&&COURT.includes(c.zone.split('.')[1])?'guts':c.zone.split('.')[1],entryCount,entryCounts:this._entryCounts(player,c.zone.split('.')[1]==='hand'?'hand':this.role(id)==='guts'&&COURT.includes(c.zone.split('.')[1])?'guts':c.zone.split('.')[1]),name,printed:c.printed}).allowed);
    return {dest,names};
  }
  _enter(id,player,area,ctx,origin='hand',side=false,skipRestricted=false,keywordFamily=null) {
    const c=this.card(id),p=this.profile(id),{dest,names,error}=this._entryOptions(id,player,area,side,origin);
    if(!names.length&&skipRestricted)return null;
    legal(names.length,error||'Entry restriction or No legal entry name');
    const parameter=dest.startsWith('side:')||dest==='block'?'block':dest;
    const other=dest==='attack'?this.top(player,'toss'):dest==='toss'?this.top(player,'receive'):null;
    const entryName=this._prepareEntryName(id,ctx,names),name=entryName?.name||this.effectiveName(id);
    legal(!other || this.effectiveName(other)!==name,'Same-name role entry forbidden');
    if(parameter==='block')legal(!['block','side:0','side:1'].map(z=>this.top(player,z)).filter(x=>x&&x!==id).some(x=>this.effectiveName(x)===name),'Same-name blockers forbidden');
    const count=parameter==='block'?(this.state.turn.blockEntries?.[player]||0)+1:1;
    const allowed=this.permission({action:'enter_character',player,origin:origin==='skill'?'skill':'rule',role:parameter==='block'?(side?'side_blocker':'center_blocker'):dest,
      entryOrigin:c.zone.split('.')[1]==='hand'?'hand':this.role(id)==='guts'&&COURT.includes(c.zone.split('.')[1])?'guts':c.zone.split('.')[1],entryCount:count,entryCounts:this._entryCounts(player,c.zone.split('.')[1]==='hand'?'hand':this.role(id)==='guts'&&COURT.includes(c.zone.split('.')[1])?'guts':c.zone.split('.')[1]),name,printed:c.printed}).allowed;
    if(!allowed&&skipRestricted)return null;
    legal(allowed,'Entry restriction');
    if(p.activation?.skill_type==='passive')this._admit(p);
    const sourceZone=c.zone.split('.')[1], entryOrigin=COURT.includes(sourceZone)&&this.role(id)==='guts'?'guts':sourceZone;
    const covered=this.top(player,dest);c.coveredCharacter=covered?{effective_name:this.effectiveName(covered),tags:clone(this.card(covered).printed.affiliation_tags),positions:clone(this.card(covered).printed.position_tags)}:null;
    c.entrySkillName=origin==='skill'&&ctx.source?this.effectiveName(ctx.source.id):null;
    this._move(id,player,dest,ctx,'explicit_entry');this._applyEntryName(id,entryName,ctx);
    c.entryOrigin=entryOrigin;c.entryReason=origin==='skill'?'skill':'rule';c.entryTurn=this.state.turn.id;
    const event={type:'character_entry',player,card:id,character:this.reference(id),role:this.role(id),origin:entryOrigin,entry_keyword_family:keywordFamily,phase:this.state.turn.phase,window:this.state.turn.id+':'+this.state.turn.phase};
    if(parameter==='block')this._recordBlockEntry(player,entryOrigin);
    this._emit(event);this._enqueuePassive(id,event);return this.reference(id);
  }
  _jump(phase) { const old=this.state.turn.id+':'+this.state.turn.phase;this.state.queue=this.state.queue.filter(q=>q.window!==old);this.state.effects=this.state.effects.filter(e=>e.duration.kind!=='this_draw_phase');this.state.turn.phase=phase;this.state.turn.step='start';this.state.events.push({type:'phase_jump',from:old,to:phase}); }
  _atomic(fn) {
    legal(!this.busy,'Reentrant settlement is not allowed');const saved=clone(this.state);this.busy=true;
    try{const result=fn();this.assertState();this.state.revision++;return result;}catch(e){this.state=saved;throw e;}finally{this.busy=false;this.depth=0;this.draining=false;}
  }
  useSkill(id) { return this._atomic(()=>this._use(id)); }
  _phaseAllowed(profile) { return profile.activation.activation_phases.includes(this.state.turn.phase) ||
    this.state.rulesOptions.practiceDrawBeforeReceive && profile.practice_override?.extra_window==='before_receive_judgment' && this.state.turn.phase==='receive' && this.state.turn.step==='free'; }
  playEvent(id) { return this._atomic(()=>{
    const c=this.card(id),p=this.profile(id),a=p.activation;this._admit(p);
    legal(!this.state.queue.length,'Pending triggers must resolve first');
    legal(c.printed.type==='event'&&c.zone===c.owner+'.hand','Event must be in its owner hand');
    legal(this._phaseAllowed(p),'Event phase mismatch');
    legal(this.permission({action:'play_event',player:c.owner,origin:'rule',icons:a.activation_phases}).allowed,'Event play forbidden');
    this._move(id,c.owner,'event',this._context(id,c.owner),'normal_event_play');
    const result=this._use(id,{event:true});need(result.performed||result.invalid,'OPEN-EVENT-NO-CHANGE');return {played:true,...result};
  }); }
  enter(id,area,{side=false,reason='rule'}={}) { return this._atomic(()=>{const c=this.card(id),ctx=this._context(id,c.owner);
    legal(this.state.stage==='rally' && c.owner===this.state.turn.player && !this.state.queue.length,'Entry action is not available');
    legal(['rule','skill'].includes(reason),'Unknown entry reason');
    if(reason==='rule')legal(c.zone===c.owner+'.hand' && (side?'block':area)===this.state.turn.phase,'Normal entry requires the correct phase and hand source');
    const result=this._enter(id,c.owner,area,ctx,reason,side);this._drain();return result;}); }
  enterBlock(ids,center) { return this._atomic(()=>{
    const player=this.state.turn.player;
    legal(this.state.stage==='rally'&&this.state.turn.phase==='block'&&!this.state.queue.length,'Block entry unavailable');
    legal(Array.isArray(ids)&&ids.length>=1&&ids.length<=3&&new Set(ids).size===ids.length&&ids.includes(center),'Invalid blocker group');
    const ordered=[center,...ids.filter(id=>id!==center)],groups=ordered.map((id,i)=>{
      const c=this.card(id);legal(c.owner===player&&c.zone===player+'.hand'&&c.printed.type==='character'&&c.printed.parameters.block!=='dash','Invalid blocker');
      return this.entryNames(id).filter(name=>this.permission({action:'enter_character',player,origin:'rule',entryOrigin:'hand',entryCount:(this.state.turn.blockEntries?.[player]||0)+ids.length,entryCounts:this._entryCounts(player,'hand',ids.length),role:i?'side_blocker':'center_blocker',name,printed:c.printed}).allowed);
    });
    legal(distinctNameOptions(groups).length,'Same-name blockers forbidden or entry restriction');
    const chosen=[],entries=[];
    for(let i=0;i<ordered.length;i++){
      const id=ordered[i],ctx=this._context(id,player),options=distinctNameOptions(groups.slice(i),chosen),entry=this._prepareEntryName(id,ctx,options),name=entry?.name||this.effectiveName(id);
      legal(options.includes(name),'Invalid blocker name');chosen.push(name);entries.push(entry);
    }
    for(let i=0;i<ordered.length;i++){
      const id=ordered[i],c=this.card(id),area=i?'side:'+(i-1):'block',ctx=this._context(id,player),covered=this.top(player,area);
      c.coveredCharacter=covered?{effective_name:this.effectiveName(covered),tags:clone(this.card(covered).printed.affiliation_tags),positions:clone(this.card(covered).printed.position_tags)}:null;
      this._move(id,player,area,ctx,'explicit_entry');this._applyEntryName(id,entries[i],ctx);c.entryOrigin='hand';c.entryReason='rule';c.entryTurn=this.state.turn.id;c.entrySkillName=null;
      this._recordBlockEntry(player,'hand');
    }
    // All members and chosen names exist before any entry-trigger resolves.
    for(const id of ordered){const event={type:'character_entry',player,card:id,character:this.reference(id),role:this.role(id),origin:'hand',phase:'block',window:this.state.turn.id+':block'};this._emit(event);this._enqueuePassive(id,event);}
    this._drain();return ordered.map(id=>this.reference(id));
  }); }
  registerWatch(node,controller,source=null) { return this._atomic(()=>this._registerWatch(node,this._context(source,controller))); }
  resolveProgram(program,controller,source=null,event={}) { return this._atomic(()=>{legal(this.mode==='sandbox','Raw programs are sandbox-only');this.preflight(program);const ctx=this._context(source,controller,event);this.depth++;let result;try{result=this._run(program,ctx);}finally{this.depth--;}this._drain();return result;}); }
  drawRule(player,n=1) { return this._atomic(()=>{const result=this._draw(player,n,this._context(null,player),'rule');this._drain();return result;}); }
  advancePhase(phase,step='free') { return this._atomic(()=>{legal(this.state.stage==='rally'&&!this.state.queue.length,'Phase boundary is not idle');legal(['serve','block','draw','receive','toss','attack','end'].includes(phase)&&['start','entry','free','judge'].includes(step),'Unknown phase checkpoint');if(this.state.turn.phase==='draw'&&phase!=='draw')this.state.effects=this.state.effects.filter(e=>e.duration.kind!=='this_draw_phase');this.state.turn.phase=phase;this.state.turn.step=step;}); }
  flushTriggers() { return this._atomic(()=>this._drain()); }
  notifyHandAdded(player,id,operation='add_hand') {
    legal(this.card(id).zone===player+'.hand','Hand notification does not match the actual card');
    return this.notifyHandAdditions([{player,card:id,operation}]);
  }
  notifyHandAdditions(events) { return this._atomic(()=>{
    legal(this.state.stage==='rally'&&this.state.turn.step==='free'&&!this.state.queue.length,'Hand notification requires an idle host checkpoint');
    legal(Array.isArray(events)&&events.length>0,'Actual host hand-add events required');
    for(const e of events){legal(['draw','add_hand'].includes(e.operation)&&this.card(e.card).owner===e.player,'Hand-add event identity mismatch');this._emit({type:'hand_added',player:e.player,card:e.card,operation:e.operation});}
    this._drain();return {performed:true};
  }); }
  // Host sends explicit entry receipts after the physical move and name choice.
  // Historical entries may have left during the same skill: retain the event,
  // but their old reference cannot receive a new numeric effect.
  // Covering/exposing a card alone must never call this API.
  notifyHostEvents(events) { return this._atomic(()=>{
    legal(this.state.stage==='rally'&&this.state.turn.step==='free'&&!this.state.queue.length,'Host notification requires an idle checkpoint');
    legal(Array.isArray(events)&&events.length>0,'Actual host events required');
    for(const e of events) {
      if(e.type==='loss'||e.type==='block_success'){
        legal(e.player===this.state.turn.player,'Judgment event player mismatch');
        if(e.type==='block_success')legal(this.state.turn.phase==='block'&&this.state.ball?.kind==='attack'&&Number.isInteger(e.defense)&&e.defense>=this.state.ball.offense,'Block success requires successful defense');
        this._emit(e);continue;
      }
      legal(this.card(e.card).owner===e.player,'Host event owner mismatch');
      if(e.type==='hand_added') {
        legal(['draw','add_hand'].includes(e.operation),'Unknown hand operation');
        this._emit({type:e.type,player:e.player,card:e.card,operation:e.operation});
      } else if(e.type==='source_moved'){
        // Like hand-add receipts, earlier source moves can be followed by another
        // move within the same host skill before this queue is drained.
        const zones=['hand','deck','drop','event','sets','sides',...COURT];
        legal(zones.includes(e.from_zone)&&zones.includes(e.to_zone)&&e.from_zone!==e.to_zone,'Invalid source move zones');this._emit(e);
      } else {
        legal(e.type==='character_entry'&&e.card===e.character?.id&&this.card(e.card).printed.type==='character'&&Number.isInteger(e.character.incarnation)&&e.character.incarnation>=0&&e.character.incarnation<=this.card(e.card).incarnation&&['serve','receive','toss','attack','center_blocker','side_blocker'].includes(e.role),'Entry event identity mismatch');
        if(e.character.incarnation===this.card(e.card).incarnation)legal(this.current(e.character)&&this.role(e.card)===e.role,'Current entry role mismatch');
        legal(['hand','drop','guts'].includes(e.origin)&&['rule','skill'].includes(e.reason),'Unknown entry origin');
        const c=this.card(e.card);c.entryOrigin=e.origin;c.entryReason=e.reason;c.entryTurn=this.state.turn.id;
        c.coveredCharacter=clone(e.coveredCharacter??null);c.entrySkillName=e.entrySkillName??null;
        const event={type:e.type,player:e.player,card:e.card,character:e.character,role:e.role,origin:e.origin,...(e.effectiveName?{effectiveName:e.effectiveName}:{}),...(e.passiveSources?{passiveSources:clone(e.passiveSources)}:{}),entry_keyword_family:e.entry_keyword_family??null,phase:this.state.turn.phase,window:this.state.turn.id+':'+this.state.turn.phase};
        this._emit(event);this._enqueuePassive(e.card,event);
      }
    }
    this._drain();return {performed:true};
  }); }
  beginTurn(player,phase='draw') { return this._atomic(()=>{legal(this.state.stage==='rally'&&this.state.turn.step==='cleaned'&&player===1-this.state.turn.player,'Previous turn must be cleaned and handed to the opponent');this.state.turn={id:this.state.turn.id+1,player,phase,step:'free'};for(const e of this.state.effects)if(e.duration.kind==='next_opponent_turn'&&e.duration.activeTurn===null&&e.duration.player===player)e.duration.activeTurn=this.state.turn.id;}); }
  endTurn() { return this._atomic(()=>{legal(this.state.stage==='rally'&&this.state.turn.step==='free'&&!this.state.queue.length,'Cannot end outside an idle free step');this._emit({type:'turn_end',player:this.state.turn.player});this._drain();this._cleanup(false);this.state.turn.step='cleaned';}); }
  _cleanup(loss) { this.state.effects=this.state.effects.filter(e=>!loss&&e.duration.kind==='next_opponent_turn'&&e.duration.activeTurn===null);this.state.locks=[];delete this.state.keywordOutgoing;delete this.state.forcedLoss;this.state.events.push({type:'cleanup',reason:loss?'loss':'turn_end'}); }
  loss(player,{voluntary=true}={}) { return this._atomic(()=>{
    legal(this.state.stage==='rally'&&player===this.state.turn.player,'Only current player can lose this rally');
    legal(!voluntary||this.state.turn.step==='free'&&!this.state.queue.length,'Voluntary Loss needs an idle free step');
    this.state.queue=[];this.state.stage='loss_triggers';this.state.turn.phase='loss_set';this.state.turn.step='loss';this.state.ball=null;this.state.loser=player;
    this._emit({type:'loss',player});this._drain();this.state.events.push({type:'loss_triggers_complete',player});
  }); }
  finishLoss() { return this._atomic(()=>{legal(this.state.stage==='loss_triggers'&&!this.state.queue.length,'Loss triggers must complete first');this._cleanup(true);this.state.stage='interval';this.state.turn.phase='interval';this.state.turn.step='interval';}); }
  snapshot() { legal(!this.busy,'Snapshot requires a settlement boundary');return clone(this.state); }
  restore(snapshot) { legal(!this.busy,'Restore requires a settlement boundary');need(snapshot.version===1&&snapshot.fingerprint===this.state.fingerprint&&snapshot.executionMode===this.mode&&same(snapshot.rulesOptions,this.state.rulesOptions),'Snapshot version/policy mismatch');const old=this.state;this.state=clone(snapshot);try{this.assertState();}catch(e){this.state=old;throw e;} }
  view(player) { return {version:1,revision:this.state.revision,turn:clone(this.state.turn),stage:this.state.stage,ball:clone(this.state.ball),players:[0,1].map(p=>({
    hand:p===player?this.zone(p,'hand').map(id=>({id,cardNo:this.card(id).cardNo})): {count:this.zone(p,'hand').length},deck:{count:this.zone(p,'deck').length},sets:{count:this.zone(p,'sets').length},
    court:this.court(p).map(id=>({id,cardNo:this.card(id).cardNo,name:this.effectiveName(id),role:this.role(id),parameters:Object.fromEntries(PARAMS.map(param=>[param,this.parameter(id,param)])),
      guts:this.state.zones[this.card(id).zone].slice(0,-1).map(id=>({id,cardNo:this.card(id).cardNo}))})),drop:this.zone(p,'drop').map(id=>({id,cardNo:this.card(id).cardNo})),event:this.zone(p,'event').map(id=>({id,cardNo:this.card(id).cardNo}))})),publicLog:clone(this.state.publicLog)}; }
  assertState() { need([0,1].includes(this.state.turn.player)&&Number.isInteger(this.state.turn.id)&&this.state.turn.id>0,'Invalid turn identity');
    need(['rally','loss_triggers','interval'].includes(this.state.stage),'Invalid rally stage');
    const seen=new Set();for(const [zone,ids] of Object.entries(this.state.zones))for(const id of ids){need(!seen.has(id),'Physical card appears twice');seen.add(id);const c=this.card(id);need(c.zone===zone&&c.id===id&&[0,1].includes(c.owner)&&Number.isInteger(c.incarnation)&&c.incarnation>=0&&this.profiles[c.profileId],'Card identity/zone mismatch');}need(seen.size===Object.keys(this.state.cards).length,'Card conservation failed'); }
}
const api={validateProtection,validateInvalid,validateBan,Kernel,distinctNameOptions,NeedsReview,IllegalAction,capabilities:{status:'HOST_CONTROLLER_REQUIRED',nodes:[...KINDS],keywords:['one_touch','doshat','feint','blockout','a_pass','two_attack','back_attack','multi_attack'],defaultCatalogLiveCardApprovals:0}};
if(typeof module!=='undefined')module.exports=api;else root.BreakRulesCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
