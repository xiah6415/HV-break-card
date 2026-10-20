/* Data-driven settlement kernel; host controllers own UI and match progression. */
(function(root) {
'use strict';
const clone = x => x===undefined ? null : JSON.parse(JSON.stringify(x));
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const COURT = ['serve','block','receive','toss','attack','side:0','side:1'];
const PARAMS = ['serve','block','receive','toss','attack'];
const KINDS = new Set(['sequence','conditional','numeric','draw','draw_to_hand_size','move','move_self',
  'pay_guts','payment_branch','retrieve','enter','enter_self','watch','ban_action','invalidate_skill',
  'protect_numeric_decrease','phase_jump','optional','choose_modes','mill','keyword']);
const FILTERS = new Set(['names','exclude_names','tags','tags_any','positions','positions_any','years','years_any',
  'role','role_any','type','skillless','play_icons_any','play_icons_exact','entry_origins','phase',
  'printed_attack','printed_attack_eq','printed_block_gte','printed_receive_gte','current_receive_gte',
  'current_block_eq','exclude_operations','from_zone','to_zone','position_has_any_other_than']);
class NeedsReview extends Error { constructor(message) { super(message); this.code='REQUIRES_REVIEW'; } }
class IllegalAction extends Error { constructor(message) { super(message); this.code='ILLEGAL_ACTION'; } }
class Unpayable extends Error {}
function need(ok, message) { if (!ok) throw new NeedsReview(message); }
function legal(ok, message) { if (!ok) throw new IllegalAction(message); }
function walk(value, fn) {
  if (Array.isArray(value)) value.forEach(v=>walk(v,fn));
  else if (value && typeof value==='object') { fn(value); Object.values(value).forEach(v=>walk(v,fn)); }
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
      if (key==='names') ok=v.includes(this.effectiveName(id));
      else if (key==='exclude_names') ok=!v.includes(this.effectiveName(id));
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
    need(['add_hand','play_event','enter_character','use_skill'].includes(action.action),'Unknown permission action');
    action={phase:this.state.turn.phase,...action};
    for (const e of this.state.effects) if (this.active(e) && e.actor===action.player) {
      if (e.kind==='ban' && e.action===action.action && this._scopeMatch(e.scope,action)) {
        if ('max_count' in e.scope && !(action.entryCount>e.scope.max_count)) continue;
        return {allowed:false,layer:action.action==='play_event' ? 'play_card':'resolve_step',effect:e.id};
      }
      if (e.kind==='invalid' && action.action==='use_skill') {
        const sel=e.selector;
        const match=s=>{
          for(const key of ['type','name','role','phaseTags','sourceZone','icons']) {
            const used={type:'type',name:'names',role:'roles',phaseTags:'phase_tags',sourceZone:'source_zones',icons:'play_icons_any'}[key];
            if(s[used])need(action[key]!==undefined,'Skill context missing '+key);
          }
          return (!s.type || s.type===action.type) && (!s.names || s.names.includes(action.name)) &&
          (!s.roles || s.roles.some(r=>this.roleMatches(action.role,r))) &&
          (!s.phase_tags || s.phase_tags.every(x=>action.phaseTags.includes(x))) &&
          (!s.source_zones || s.source_zones.includes(action.sourceZone)) &&
          (!s.play_icons_any || s.play_icons_any.some(x=>action.icons.includes(x)));};
        need(!sel.keyword_families && !sel.union_with?.keyword_families,'Keyword skill selectors not implemented');
        if (match(sel) || sel.union_with && match(sel.union_with)) return {allowed:false,layer:'use_skill',effect:e.id};
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
  _moveSelected(node,ctx) {
    const ids=this.pool(node.pool,ctx), recipient=this.owner(node.pool.actor,ctx);
    // Public-zone targets belong to the effect controller (QA1192/1317/1420).
    // A player discarding from their own private hand retains that choice.
    const chooser=node.pool.zone==='hand'?recipient:ctx.controller;
    const dest=node.destination;
    if(dest.endsWith('.guts') && !dest.includes('chosen_court_area')) {
      const parts=dest.split('.'),player=parts[0]==='owner'?recipient:this.owner(parts[0],ctx);
      if(!this.top(player,parts[1])){ctx.bind[node.bind || 'moved']=[];return false;}
    }
    if (dest.endsWith('.hand') && !this._handAllowed(dest.startsWith('owner.')?recipient:ctx.controller,ctx)) { ctx.bind[node.bind || 'moved']=[]; return false; }
    let n;
    if (node.count_mode==='all') n=ids.length;
    else if (node.count_mode==='one_of_exact') {
      const allowed=node.allowed_counts.filter(n=>n<=ids.length);
      if (!allowed.length) throw new Unpayable();
      n=this._decide('payment_count',ctx,allowed,{player:chooser}); legal(allowed.includes(n),'Invalid payment count');
    } else {
      need(['exact','upto'].includes(node.count_mode),'Unsupported move quantity');
      if (ctx.inPayment && ids.length<node.count) throw new Unpayable();
      n=Math.min(node.count,ids.length);
      if (node.count_mode==='upto') { n=this._decide('move_count',ctx,Array.from({length:n+1},(_,i)=>i),{player:chooser}); legal(Number.isInteger(n) && n>=0 && n<=Math.min(node.count,ids.length),'Invalid move count'); }
    }
    const chosen=node.count_mode==='all' ? ids : n ? this._selection(ids,n,ctx,ctx.inPayment?'payment_cards':'move_cards',chooser,{destination:dest}) : [];
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
  _fact(field,ctx) {
    if (field==='phase') return this.state.turn.phase;
    if (field==='current_turn_id') return this.state.turn.id;
    if (field==='both.set.count_sum') return this.zone(0,'sets').length+this.zone(1,'sets').length;
    if (field.startsWith('opponent_ball.')) { need(this.state.ball && this.state.ball.owner!==ctx.controller,'Incoming ball missing');return this.state.ball[field.split('.')[1]]; }
    let m=field.match(/^(self|opponent)\.(hand|sets|set)\.count$/);
    if (m) return this.zone(m[1]==='self'?ctx.controller:1-ctx.controller,m[2]==='set'?'sets':m[2]).length;
    m=field.match(/^(self|opponent)\.(serve|receive|toss|attack)\.(effective_name|printed_attack)$/);
    if (m) { const id=this.top(m[1]==='self'?ctx.controller:1-ctx.controller,m[2]); return !id ? null : m[3]==='effective_name'?this.effectiveName(id):this.card(id).printed.parameters.attack; }
    m=field.match(/^(paid|milled|retrieved|drawn)\.(count|event_count|names_are_distinct)$/);
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
      (typeof target==='string' ? e.ballOwner===(target==='self_ball'?ctx.controller:1-ctx.controller) : e.targets.some(r=>same(r,target) && this.current(r))));
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
        else if (value.kind==='sum_result_parameter') value=(ctx.bind[value.result] || []).reduce((n,id)=>n+this.card(id).printed.parameters[value.parameter],0);
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
          need(!(node.operation==='set' && value<old && protectedValue),'Set-to-lower with protection needs review');
          if (node.operation==='add' && value===0 || node.operation==='set' && value===old) continue;
          this.effect('numeric',{target,parameter:param,operation:node.operation,value},ctx,node.duration);
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
      if (n.kind && !['selector','compare','all','any','equal_fields','count_compare','uniform_affiliation','all_result_cards_match','printed_parameter','sum_result_parameter','result_count'].includes(n.kind)) need(KINDS.has(n.kind),'Unsupported mechanism '+n.kind);
      if (n.filters) for (const k of Object.keys(n.filters)) need(FILTERS.has(k),'Unsupported filter '+k);
      if (n.target_scope) need(n.target_scope.membership==='snapshot_on_resolution','Target membership is not supported');
      if (n.increase_guard) throw new NeedsReview('Numeric source contribution cap not implemented');
      if(n.kind==='pay_guts')need(n.count_mode!=='exact_each','Per-area payment not implemented');
      if(n.destination)need(!n.destination.includes('choose_deck') && !n.destination.endsWith('.deck_top'),'Destination mechanism not implemented');
      if(n.kind==='invalidate_skill')need(!n.selector.keyword_families && !n.selector.union_with?.keyword_families,'Keyword invalidation not implemented');
      if (n.kind==='keyword') need(n.keyword==='one_touch','Keyword not implemented: '+n.keyword);
      if (n.kind==='compare') {
        need(/^(phase|current_turn_id|both\.set\.count_sum|opponent_ball\.(kind|offense)|(self|opponent)\.(hand|sets|set)\.count|(self|opponent)\.(serve|receive|toss|attack)\.(effective_name|printed_attack)|(paid|milled|retrieved|drawn)\.(count|event_count|names_are_distinct)|optional\.performed|(source|target)\.(effective_name|role|entry_origin|entry_reason|entry_turn|current_(serve|receive|block|toss|attack)))$/.test(n.field),'Fact is not implemented: '+n.field);
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
      case 'numeric': return this._numeric(node,ctx);
      case 'draw': { const player=this.owner(node.actor,ctx);let n=node.count;
        if(!this._handAllowed(player,ctx)){ctx.bind.drawn=[];return false;}
        if (node.count_mode==='upto') { const max=Math.min(n,this.zone(player,'deck').length);n=this._decide('draw_count',ctx,Array.from({length:max+1},(_,i)=>i),{player});legal(Number.isInteger(n)&&n>=0&&n<=max,'Invalid draw choice'); }
        ctx.bind.drawn=this._draw(player,n,ctx);return ctx.bind.drawn.length>0; }
      case 'draw_to_hand_size': { const player=this.owner(node.actor,ctx);ctx.bind.drawn=this._draw(player,Math.max(0,node.hand_size-this.zone(player,'hand').length),ctx);return ctx.bind.drawn.length>0; }
      case 'move': case 'retrieve': return this._moveSelected(node,ctx);
      case 'move_self': { const id=ctx.source.id, dest=this._destination(node.destination,id,ctx);
        if(dest.zone==='hand'&&!this._handAllowed(dest.player,ctx)){if(ctx.inPayment)throw new Unpayable();ctx.bind.moved=[];return false;}
        this._move(id,dest.player,dest.zone,ctx,node.reason);if(dest.bottom){const d=this.zone(dest.player,'deck');d.unshift(d.pop());}ctx.bind.moved=[id];if(ctx.inPayment)ctx.paid.push(id);
        if(dest.zone==='hand')this._emit({type:'hand_added',player:dest.player,card:id,operation:'add_hand'});return true; }
      case 'mill': { const ids=this.zone(this.owner(node.actor,ctx),'deck'),player=this.owner(node.actor,ctx);let n=node.count;
        if (ctx.inPayment && node.count_mode==='exact' && ids.length<n) throw new Unpayable();
        n=Math.min(n,ids.length);if(node.count_mode==='upto'){const max=n;n=this._decide('mill_count',ctx,Array.from({length:n+1},(_,i)=>i));legal(Number.isInteger(n)&&n>=0&&n<=max,'Invalid mill count');}
        const moved=[];for(let i=0;i<n;i++){const id=this.top(player,'deck');this._move(id,player,'drop',ctx);moved.push(id);}ctx.bind.milled=moved;if(ctx.inPayment)ctx.paid.push(...moved);return moved.length>0; }
      case 'pay_guts': { need(node.count_mode!=='exact_each','Per-area payment not implemented');const areas=node.areas==='court'?COURT:node.areas==='source_area'?[this.card(ctx.source.id).zone.split('.')[1].startsWith('side:')?'block':this.card(ctx.source.id).zone.split('.')[1]]:node.areas;
        const ids=areas.flatMap(a=>this.zone(ctx.controller,a).slice(0,-1));let n=node.count;
        if(node.count_mode==='one_of_exact'){const counts=node.allowed_counts.filter(n=>n<=ids.length);if(!counts.length)throw new Unpayable();n=this._decide('payment_count',ctx,counts);legal(counts.includes(n),'Invalid Guts amount');}
        if(ids.length<n)throw new Unpayable();const paid=this._selection(ids,n,ctx,'guts');for(const id of paid)this._move(id,this.card(id).owner,'drop',ctx);ctx.bind.paid=paid;ctx.paid.push(...paid);return paid.length>0; }
      case 'payment_branch': {
        if(!this._paymentAvailable(node.payment,ctx))return false;
        const yes=this._decide('activate_payment',ctx,[true,false],{payment:node.payment});legal(typeof yes==='boolean','Payment decision must be boolean');if(!yes)return false;
        const saved=clone(this.state), before=clone(ctx);ctx.inPayment=true;ctx.paid=[];
        try {this._run(node.payment,ctx);} catch(e) {if(!(e instanceof Unpayable))throw e;this.state=saved;Object.assign(ctx,before);return false;}
        ctx.inPayment=false;ctx.bind.paid=[...ctx.paid];return this._run(node.then,ctx)||ctx.paid.length>0;
      }
      case 'optional': { const yes=this._decide('optional',ctx,[true,false]);legal(typeof yes==='boolean','Optional decision must be boolean');ctx.bind.optional={performed:yes&&this._run(node.then,ctx)};return ctx.bind.optional.performed; }
      case 'choose_modes': { const i=this._decide('mode',ctx,node.options.map((_,i)=>i));legal(Number.isInteger(i)&&i>=0&&i<node.options.length,'Invalid mode');return this._run(node.options[i],ctx); }
      case 'watch': this._registerWatch(node,ctx);return true;
      case 'ban_action': this.effect('ban',{actor:this.owner(node.actor,ctx),action:node.action,scope:node.scope},ctx,node.duration);return true;
      case 'invalidate_skill': this.effect('invalid',{actor:this.owner(node.actor,ctx),selector:node.selector},ctx,node.duration);return true;
      case 'protect_numeric_decrease': { const targets=this._targets(node,ctx);if(!targets.length)return false;const ball=typeof targets[0]==='string';this.effect('protect',{targets:ball?[]:targets,ballOwner:ball?(targets[0]==='self_ball'?ctx.controller:1-ctx.controller):null,parameter:node.parameter},ctx,node.duration);return true; }
      case 'phase_jump': this._jump(node.destination);return true;
      case 'keyword': need(this.state.turn.phase==='block' && this.state.ball?.kind==='attack','One touch requires an incoming attack in block phase');this._numeric({target:'opponent_ball',target_scope:{mode:'single',binding:'reference',membership:'snapshot_on_resolution'},parameter:'attack_offense',value:-node.N,operation:'add'},ctx);this._jump('draw');return true;
      case 'enter': case 'enter_self': { const ids=node.kind==='enter_self'?[ctx.source.id]:this.pool(node.pool,ctx);let n=node.kind==='enter_self'?1:Math.min(node.count,ids.length);
        if(node.count_mode==='upto'){const max=n;n=this._decide('entry_count',ctx,Array.from({length:n+1},(_,i)=>i));legal(Number.isInteger(n)&&n>=0&&n<=max,'Invalid entry count');}
        if(!n){ctx.bind.entered=null;return false;}need(n===1,'Multiple entry transaction not implemented');const id=node.kind==='enter_self'?ids[0]:this._selection(ids,1,ctx,'entry')[0];ctx.bind.entered=this._enter(id,ctx.controller,node.destination,ctx,'skill',node.as_side_blocker,true);return !!ctx.bind.entered; }
      default: throw new NeedsReview('Unsupported operation '+node.kind);
    }
  }
  _registerWatch(node,ctx) {
    this.preflight(node.then);legal(['character_entry','hand_added','source_moved','loss','turn_end','block_success'].includes(node.event),'Unknown trigger event');
    return this.effect('watch',{event:node.event,actor:this.owner(node.actor,ctx),filters:node.filters || {},then:node.then,remaining:node.remaining_uses ?? null},ctx,node.duration);
  }
  _emit(event) {
    event={phase:this.state.turn.phase,window:this.state.turn.id+':'+this.state.turn.phase,...clone(event)};
    this.state.events.push(clone(event));
    for (const e of this.state.effects) if(e.kind==='watch' && this.active(e) && e.actor===event.player && e.event===event.type && e.remaining!==0) {
      const id=event.card || event.character?.id;
      if(Object.keys(e.filters).length && (!id || !this.matches(id,e.filters,{controller:e.controller},event)))continue;
      if(e.remaining!==null)e.remaining--;
      this.state.queue.push({id:this.id('q'),controller:e.controller,source:e.source,event,program:clone(e.then),generated:true,window:event.window});
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
    if(p.activation.skill_type==='passive')need(p.activation.trigger?.event==='self_entry','Non-entry passive triggers not implemented');
    this.preflight(p.program);if(p.formal_cost)for(const n of p.formal_cost.steps)this.preflight(n); }
  _resolveSkill(p,ctx) {
    const name=this.effectiveName(ctx.source.id);
    if(p.formal_cost){ctx.inPayment=true;try{for(const n of p.formal_cost.steps)this._run(n,ctx);}catch(e){if(e instanceof Unpayable)throw new IllegalAction('Formal declaration cost cannot be paid');throw e;}ctx.inPayment=false;ctx.bind.paid=[...ctx.paid];}
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
  _enter(id,player,area,ctx,origin='hand',side=false,skipRestricted=false) {
    const c=this.card(id),p=this.profile(id);let dest=area;
    if(side){dest=['side:0','side:1'].find(z=>!this.top(player,z));legal(dest,'No side blocker slot');need(this.top(player,'block'),'Centerless side-block exception is not implemented');}
    legal(COURT.includes(dest)&&c.printed.type==='character','Invalid character destination');
    const parameter=dest.startsWith('side:')||dest==='block'?'block':dest;
    legal(c.printed.parameters[parameter]!=='dash','Dash parameter cannot enter');
    const name=this.effectiveName(id),other=dest==='attack'?this.top(player,'toss'):dest==='toss'?this.top(player,'receive'):null;
    legal(!other || this.effectiveName(other)!==name,'Same-name role entry forbidden');
    if(parameter==='block')legal(!['block','side:0','side:1'].map(z=>this.top(player,z)).filter(x=>x&&x!==id).some(x=>this.effectiveName(x)===name),'Same-name blockers forbidden');
    const count=parameter==='block'?(this.state.turn.blockEntries?.[player]||0)+1:1;
    const allowed=this.permission({action:'enter_character',player,origin:origin==='skill'?'skill':'rule',role:parameter==='block'?(side?'side_blocker':'center_blocker'):dest,
      entryOrigin:c.zone.split('.')[1]==='hand'?'hand':this.role(id)==='guts'&&COURT.includes(c.zone.split('.')[1])?'guts':c.zone.split('.')[1],entryCount:count,name,printed:c.printed}).allowed;
    if(!allowed&&skipRestricted)return null;
    legal(allowed,'Entry restriction');
    need(p.activation?.skill_type!=='permanent_entry_name','Entry-name replacement not implemented');
    if(p.activation?.skill_type==='passive')this._admit(p);
    const sourceZone=c.zone.split('.')[1], entryOrigin=COURT.includes(sourceZone)&&this.role(id)==='guts'?'guts':sourceZone;
    this._move(id,player,dest,ctx,'explicit_entry');
    c.entryOrigin=entryOrigin;c.entryReason=origin==='skill'?'skill':'rule';c.entryTurn=this.state.turn.id;
    const event={type:'character_entry',player,card:id,character:this.reference(id),role:this.role(id),origin:entryOrigin,phase:this.state.turn.phase,window:this.state.turn.id+':'+this.state.turn.phase};
    if(parameter==='block'){this.state.turn.blockEntries ||= [0,0];this.state.turn.blockEntries[player]++;}
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
      legal(this.card(e.card).owner===e.player,'Host event owner mismatch');
      if(e.type==='hand_added') {
        legal(['draw','add_hand'].includes(e.operation),'Unknown hand operation');
        this._emit({type:e.type,player:e.player,card:e.card,operation:e.operation});
      } else {
        legal(e.type==='character_entry'&&e.card===e.character?.id&&this.card(e.card).printed.type==='character'&&Number.isInteger(e.character.incarnation)&&e.character.incarnation>=0&&e.character.incarnation<=this.card(e.card).incarnation&&['serve','receive','toss','attack','center_blocker','side_blocker'].includes(e.role),'Entry event identity mismatch');
        if(e.character.incarnation===this.card(e.card).incarnation)legal(this.current(e.character)&&this.role(e.card)===e.role,'Current entry role mismatch');
        legal(['hand','drop','guts'].includes(e.origin)&&['rule','skill'].includes(e.reason),'Unknown entry origin');
        const c=this.card(e.card);c.entryOrigin=e.origin;c.entryReason=e.reason;c.entryTurn=this.state.turn.id;
        const event={type:e.type,player:e.player,card:e.card,character:e.character,role:e.role,origin:e.origin,phase:this.state.turn.phase,window:this.state.turn.id+':'+this.state.turn.phase};
        this._emit(event);this._enqueuePassive(e.card,event);
      }
    }
    this._drain();return {performed:true};
  }); }
  beginTurn(player,phase='draw') { return this._atomic(()=>{legal(this.state.stage==='rally'&&this.state.turn.step==='cleaned'&&player===1-this.state.turn.player,'Previous turn must be cleaned and handed to the opponent');this.state.turn={id:this.state.turn.id+1,player,phase,step:'free'};for(const e of this.state.effects)if(e.duration.kind==='next_opponent_turn'&&e.duration.activeTurn===null&&e.duration.player===player)e.duration.activeTurn=this.state.turn.id;}); }
  endTurn() { return this._atomic(()=>{legal(this.state.stage==='rally'&&this.state.turn.step==='free'&&!this.state.queue.length,'Cannot end outside an idle free step');this._emit({type:'turn_end',player:this.state.turn.player});this._drain();this._cleanup(false);this.state.turn.step='cleaned';}); }
  _cleanup(loss) { this.state.effects=this.state.effects.filter(e=>!loss&&e.duration.kind==='next_opponent_turn'&&e.duration.activeTurn===null);this.state.locks=[];this.state.events.push({type:'cleanup',reason:loss?'loss':'turn_end'}); }
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
const api={Kernel,NeedsReview,IllegalAction,capabilities:{status:'HOST_CONTROLLER_REQUIRED',nodes:[...KINDS],keywords:['one_touch'],defaultCatalogLiveCardApprovals:0}};
if(typeof module!=='undefined')module.exports=api;else root.BreakRulesCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
