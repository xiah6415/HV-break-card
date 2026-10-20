/* Static migration inventory. Never executes a skill or grants live approval. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {Kernel}=require('./core');
const ROOT=__dirname,read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,p))).digest('hex');
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
// Match the Python approval writer: sorted keys, Unicode, default JSON separators.
const approvalJSON=x=>Array.isArray(x)?'['+x.map(approvalJSON).join(', ')+']':x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+': '+approvalJSON(x[k])).join(', ')+'}':JSON.stringify(x);
const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
const META=new Set(['node_id','shared_rule_ids','category_tags','classification_role','polarity']);
const LEVEL={no_skill:0,approved:1,reuse_candidate:2,host_gap:3,core_gap:4,ruling_review:5};
const LABELS={no_skill:'無技能：基礎資料匯入候選',approved:'現有對練台已核准',reuse_candidate:'現有機制候選：需核對與組合測試',host_gap:'需補遊戲橋接或未驗證結算形態',core_gap:'需補核心共用機制',ruling_review:'卡文版本／判例／資料語意待覆核'};
const GROUPS={
 rename_entry:'改名登場與登場前身分',keywords:'關鍵字與階段銜接',deck_operations:'牌庫選牌、翻牌與洗牌',non_entry_passive:'場上角色監聽與覆蓋觸發',selection:'多選／複合選項介面',movement:'移牌、技能登場與新角色數值投影',numeric:'數值範圍／固定值／特殊條件',persistent:'新增持續效果、期限或權限範圍',triggers:'其他觸發事件與來源資訊',review:'卡文版本／判例／資料語意',other:'其他未接共用機制'};
function walk(value,fn,at='program'){if(Array.isArray(value))value.forEach((v,i)=>walk(v,fn,at+'['+i+']'));else if(value&&typeof value==='object'){if(value.kind)fn(value,at);for(const [k,v]of Object.entries(value))if(!META.has(k))walk(v,fn,at+'.'+k);}}
// Isolate local preflight checks; children are checked at their own exact paths.
function local(n){const nested=v=>v&&typeof v==='object'&&(v.kind||Object.values(v).some(nested));return Object.fromEntries(Object.entries(n).filter(([k,v])=>META.has(k)||k==='kind'||!nested(v)));}
function groupFor(n,message){const k=n?.kind;if(k==='rename_before_entry'||message.includes('permanent_entry_name'))return 'rename_entry';if(k==='keyword'||message.includes('Keyword'))return 'keywords';if(['deck_selection','reveal_top','move_result','shuffle','reveal_and_retrieve'].includes(k)||/deck_top|choose_deck/.test(message))return 'deck_operations';if(/Non-entry passive/.test(message))return 'non_entry_passive';if(['choose_modes','each_player_optional_draw','retrieve_slots','simultaneous_entry_group'].includes(k))return 'selection';if(['enter','enter_self','exchange','cover_source_with_guts'].includes(k))return 'movement';if(['numeric','parameter_absent','source_skill_maximum','compare','equal_fields'].includes(k)||/parameter|Numeric/.test(message))return 'numeric';if(['watch','ban_action','invalidate_skill','protect_numeric_decrease'].includes(k))return 'persistent';return 'other';}
function buildCoverage(){
 const catalog=read('data/cards.json'),rules=read('data/shared-rules.json'),approvals=read('approvals.json'),runtime=read('runtime-data.json');
 const before=digest({catalog,approvals,runtime}),admitted=new Set(Object.keys(approvals.profiles)),runtimeCards=new Set(runtime.catalog.cards.map(c=>c.card_no));
 if(JSON.stringify([...admitted].sort())!==JSON.stringify([...runtime.approved].sort()))throw Error('Runtime approval set differs from approvals.json');
 for(const id of admitted){const original=catalog.cards.flatMap(c=>c.profiles).find(p=>p.profile_id===id),live=runtime.catalog.cards.flatMap(c=>c.profiles).find(p=>p.profile_id===id);if(!original||!live?.runtime_approved)throw Error('Missing approved profile '+id);const sha=crypto.createHash('sha256').update(approvalJSON(original)).digest('hex');if(sha!==approvals.profiles[id].profile_sha256||JSON.stringify(stable(original))!==JSON.stringify(stable({...live,runtime_approved:original.runtime_approved})))throw Error('Approved data differs: '+id);}
 const kernel=new Kernel({catalog,ruleIds:rules.rules.map(r=>r.id),fingerprint:hash('data/cards.json'),mode:'sandbox'});
 const profiles=[],mechanisms=new Map();
 function inspect(card,p){
  const reasons=[];const put=(layer,group,key,at,detail)=>{if(!reasons.some(r=>r.layer===layer&&r.key===key&&r.path===at))reasons.push({layer,group,key,path:at,detail});};
  const core=(group,key,at,detail)=>put('core',group,key,at,detail),host=(group,key,at,detail)=>put('host',group,key,at,detail);
  let gate=null;const obs=[];
  const roots=[['program',p.program],...((p.formal_cost?.steps||[]).map((n,i)=>['formal_cost.steps['+i+']',n]))];
  if(p.program){
   for(const flag of p.flags||[])put('review','review','flag:'+flag,'flags',flag);
   if(card.skill_text_variant_conflict)put('review','review','card_text_variants','profiles','保留卡文版本，尚未選定規範版本');
   const a=p.activation;
   if(a?.skill_type==='permanent_entry_name')core('rename_entry','activation:permanent_entry_name','activation','登場前改名流程未接入共用核心');
   else if(a?.skill_type==='passive'&&a.trigger?.event!=='self_entry')core('non_entry_passive','trigger:'+a.trigger?.event,'activation.trigger','核心僅核准自身登場型角色被動；其他角色監聽須新增控制器');
   else if(!['passive','active','event'].includes(a?.skill_type))core('other','activation:'+a?.skill_type,'activation','未知或尚未接入的技能類型');
   if(a?.skill_type==='active'&&JSON.stringify(a.source_zones)!=='["hand"]')host('triggers','active_source_zone','activation.source_zones','現有宣告入口僅處理手牌主動技能');
   try{kernel._admit(p);gate={passed:true};}catch(e){gate={passed:false,code:e.code||null,message:e.message};}
  }
  for(const [rootAt,root]of roots)walk(root,(n,at)=>{
   obs.push({kind:n.kind,path:at,...(n.keyword?{keyword:n.keyword}:{})});
   if(!mechanisms.has(n.kind))mechanisms.set(n.kind,new Set());mechanisms.get(n.kind).add(card.card_no);
   try{kernel.preflight(local(n));}catch(e){core(groupFor(n,e.message),'preflight:'+e.message,at,e.message);}
   if(n.kind==='equal_fields'||n.kind==='compare'&&n.op==='lt_field')for(const field of n.fields||[n.value])try{kernel.preflight({kind:'compare',field,op:'eq',value:0});}catch(e){core('numeric','fact:'+field,at,e.message);}
   if(n.kind==='selector'){
    if(!['self','opponent','owner','controller'].includes(n.actor))core('other','actor:'+n.actor,at,'此actor尚無核心owner解析');
    if(n.zone==='event_or_drop'||n.zone==='entering_card')core('movement','selector_zone:'+n.zone,at,'此selector區域尚無核心pool解析');
   }
   if(typeof n.duration==='string'&&!['this_turn','current_turn_cleanup_or_role_exit','this_turn_or_role_exit','this_draw_phase','next_opponent_turn'].includes(n.duration))core('persistent','duration:'+n.duration,at,'核心沒有此期限的生命週期');
   if(n.kind==='numeric'){
    if(!['current_turn_cleanup_or_role_exit','this_turn_or_role_exit','this_turn'].includes(n.duration))host('numeric','numeric_duration:'+n.duration,at,'此數值期限未接入host清理／啟用流程');
    if(n.operation!=='add')host('numeric','numeric_operation:'+n.operation,at,'目前host數值投影累加delta，不能直接投影固定值');
    if(n.target?.actor==='opponent'&&n.target_scope?.binding==='choose')host('selection','opponent_target_viewpoint',at,'目前場上目標介面需補對手角色名稱與視角資訊');
    if(n.target_scope?.mode==='multiple')host('selection','multiple_numeric_targets',at,'目前玩家目標選擇橋接僅支援單一實體');
    if(typeof n.target==='string'&&!['source','$target','$event.character','opponent_ball'].includes(n.target))host('numeric','numeric_target:'+n.target,at,'此綁定或球域尚未由host完整投影驗證');
    if(['offense','attack_offense','defense'].includes(n.parameter)&&n.target!=='opponent_ball')host('numeric','numeric_domain:'+n.parameter,at,'未接入此數值領域的host投影');
   }
   if(n.kind==='pay_guts'){
    if(n.areas!=='source_area')host('selection','guts_areas:'+JSON.stringify(n.areas),at,'共用橋接尚未支援此跨區Guts選擇');
    if(n.count_mode!=='exact')host('selection','guts_count:'+n.count_mode,at,'共用橋接尚未支援此Guts數量選單');
   }
   if(['move','retrieve'].includes(n.kind)){
    if(n.count>1||!['exact','upto'].includes(n.count_mode))host('selection','move_quantity:'+n.count_mode+':'+(n.count>1?'many':'other'),at,'共用橋接僅支援單一實體選擇與0／1回收');
    if(n.count_mode==='upto'&&!n.destination.endsWith('.hand'))host('selection','move_count_non_hand',at,'目前數量介面只驗證加入手牌的0／1選擇');
    if(!/^(self|opponent|owner)\.(hand|drop|event|deck_bottom)$/.test(n.destination))host('movement','destination:'+n.destination,at,'新區域移動需要host角色／數值投影與相應選擇');
    if(n.destination.endsWith('.hand')&&!(n.pool.actor==='self'&&n.destination==='self.hand'))host('movement','hand_recipient:'+n.pool.actor+':'+n.destination,at,'目前回收只驗證自身牌加入自己手牌');
   }
   if(n.kind==='move_self'&&!/^(self|opponent|owner)\.(hand|drop|event|deck_bottom)$/.test(n.destination))host('movement','self_destination:'+n.destination,at,'自身移牌到此區域需新增host投影');
   if(n.kind==='watch'){
    const family=n.event==='hand_added'&&n.duration==='next_opponent_turn'||n.event==='character_entry'&&['this_turn','next_opponent_turn'].includes(n.duration);
    if(!family)host('triggers','watch:'+n.event+':'+n.duration,at,'尚未接入host通知／持久化的watch族');
   }
   if(n.kind==='ban_action'){
    const scope=n.scope||{},keys=Object.keys(scope).sort(),shape=JSON.stringify(keys);
    const add=n.action==='add_hand'&&JSON.stringify(scope)==='{"origins":["skill"]}';
    const receive=n.action==='enter_character'&&scope.role==='receive'&&shape==='["printed_receive_gte","role"]';
    const block=n.action==='enter_character'&&scope.role==='block'&&shape==='["max_count","role"]';
    if(n.duration!=='next_opponent_turn'||!(add||receive||block))host('persistent','ban:'+n.action+':'+n.duration+':'+shape,at,'其他權限範圍／期限尚未接入host各動作入口');
   }
   if(n.kind==='protect_numeric_decrease'&&!(n.parameter==='all'&&n.duration==='this_turn'&&n.target_scope?.mode==='single'&&typeof n.target==='string'&&!n.target.includes('ball')))host('persistent','protect_shape',at,'目前僅保存單一角色、本回合、全部參數下降保護');
   if(n.kind==='invalidate_skill')host('persistent','skill_invalidation',at,'host尚未保存／查詢此失效效果');
   if(['enter','enter_self'].includes(n.kind))host('movement','skill_entry',at,'需接新增角色slot／數值、技能登場與觸發流程');
   if(n.kind==='mill')host('selection','mill',at,'共用橋接尚未驗證mill數量與公開結果流程');
   if(n.kind==='choose_modes')host('selection','choose_modes',at,'共用橋接尚未實作mode選單');
   if(n.kind==='phase_jump'||n.kind==='keyword'&&n.keyword==='one_touch')host('keywords','phase_transition',at,'核心支援的跳階段仍需host回合控制器銜接');
  },rootAt);
  if(gate&&!gate.passed&&!reasons.some(r=>r.layer==='core'||r.layer==='review'))core('other','admission:'+gate.message,'profile',gate.message);
  const isApproved=admitted.has(p.profile_id);if(isApproved&&reasons.length)throw Error('Approved profile unexpectedly blocked: '+p.profile_id+' '+JSON.stringify(reasons));
  const category=!p.program?'no_skill':isApproved?'approved':reasons.some(r=>r.layer==='review')?'ruling_review':reasons.some(r=>r.layer==='core')?'core_gap':reasons.some(r=>r.layer==='host')?'host_gap':'reuse_candidate';
  const row={card_no:card.card_no,name:card.display_name,profile_id:p.profile_id,source_skill_sha256:p.source_skill_sha256,category,category_label:LABELS[category],in_runtime_catalog:runtimeCards.has(card.card_no),live_approved:isApproved,kernel_admission:gate,mechanisms:[...new Set(obs.map(n=>n.kind))].sort(),keyword_families:[...new Set(obs.flatMap(n=>n.keyword?[n.keyword]:[]))].sort(),reasons};profiles.push(row);return row;
 }
 const cards=catalog.cards.map(c=>{const ps=c.profiles.map(p=>inspect(c,p)),worst=ps.reduce((a,b)=>LEVEL[a.category]>=LEVEL[b.category]?a:b);return {card_no:c.card_no,name:c.display_name,profile_ids:ps.map(p=>p.profile_id),category:worst.category,category_label:LABELS[worst.category],in_runtime_catalog:runtimeCards.has(c.card_no),live_approved:ps.every(p=>p.live_approved),mechanisms:[...new Set(ps.flatMap(p=>p.mechanisms))].sort(),keyword_families:[...new Set(ps.flatMap(p=>p.keyword_families))].sort(),gap_groups:[...new Set(ps.flatMap(p=>p.reasons.map(r=>r.group)))].sort()};});
 const counts=rows=>Object.fromEntries(Object.keys(LEVEL).map(key=>[key,rows.filter(r=>r.category===key).length]));
 const gaps=Object.entries(GROUPS).map(([key,label])=>{const affected=cards.filter(c=>c.gap_groups.includes(key)),only=affected.filter(c=>c.gap_groups.length===1);return {key,label,affected_cards:affected.length,single_gap_group_cards:only.length,card_nos:affected.map(c=>c.card_no),single_gap_group_card_nos:only.map(c=>c.card_no)};}).filter(g=>g.affected_cards).sort((a,b)=>b.affected_cards-a.affected_cards||a.key.localeCompare(b.key));
 if(before!==digest({catalog,approvals,runtime}))throw Error('Coverage audit mutated execution data');
 return {schema_version:1,kind:'STATIC_MIGRATION_CANDIDATES_NOT_EXECUTION_APPROVAL',method:'Actual Kernel admission/preflight plus conservative current host mechanism checks; complete profiles including formal costs. All candidates require source/combination validation, runtime catalog/art import and exact-hash approval. Cross-group gap counts overlap.',sources:Object.fromEntries(['data/cards.json','data/shared-rules.json','core.js','legacy.js','build_runtime.py','coverage.js','approvals.json','runtime-data.json'].map(p=>[p,hash(p)])),totals:{cards:cards.length,profiles:profiles.length,skill_cards:cards.filter(c=>c.category!=='no_skill').length,runtime_cards:runtimeCards.size,admitted_profiles:admitted.size},card_categories:counts(cards),profile_categories:counts(profiles),common_import_gates:['runtime catalog currently contains only 47 cards','all-card DEF/assets/deck import not integrated','first-pass semantics and combination validation','explicit full-profile hash approval for each admitted skill'],mechanism_card_counts:Object.fromEntries([...mechanisms].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,v.size])),gap_groups:gaps,cards,profiles};
}
if(require.main===module){const result=buildCoverage();process.stdout.write(JSON.stringify(result,null,2)+'\n');}
module.exports={buildCoverage,LABELS};
