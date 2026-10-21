/* Offline planning only. Reads frozen scripts; never changes admission or runtime. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {buildCoverage}=require('./coverage');
const {profileHash}=require('./batch-index');
const ROOT=path.join(__dirname,'..');
const read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,f))).digest('hex');
const META=new Set(['node_id','shared_rule_ids','category_tags','classification_role','polarity']);
const FAMILIES={
 flow:['流程組合',['sequence','conditional','optional','payment_branch']],
 condition:['條件與事實查詢',['compare','all','any','equal_fields','count_compare','uniform_affiliation','all_result_cards_match']],
 selection:['對象／選項選擇',['selector','choose_modes','retrieve_slots','each_player_optional_draw']],
 guts:['Guts付款',['pay_guts']],
 movement:['移牌與回收',['move','move_self','retrieve','move_result','exchange']],
 draw:['抽牌與補手牌',['draw','draw_to_hand_size']],
 deck:['翻牌／檢索／洗牌／牌頂棄牌',['deck_selection','reveal_top','reveal_and_retrieve','shuffle','mill']],
 numeric:['數值與計算式',['numeric','printed_parameter','sum_result_parameter','result_count','source_skill_maximum','parameter_absent']],
 entry:['技能登場與覆蓋',['enter','enter_self','simultaneous_entry_group','cover_source_with_guts']],
 rename:['登場前改名',['rename_before_entry']],
 trigger:['生成式監聽',['watch']],
 permission:['禁止／失效／保護',['ban_action','invalidate_skill','protect_numeric_decrease']],
 phase:['階段切換',['phase_jump']],
 keyword:['關鍵字',['keyword']],
 external:['實體動作與隨機結果',['external_action']],
 judgment:['判定覆寫',['force_judgment_failure']]
};
const KIND_FAMILY=Object.fromEntries(Object.entries(FAMILIES).flatMap(([f,[,ks]])=>ks.map(k=>[k,f])));
const uniq=a=>[...new Set(a)].sort();
function walk(x,fn,at='program') {
 if(Array.isArray(x))x.forEach((v,i)=>walk(v,fn,at+'['+i+']'));
 else if(x&&typeof x==='object'){if(x.kind)fn(x,at);for(const[k,v]of Object.entries(x))if(!META.has(k))walk(v,fn,at+'.'+k);}
}
function short(c){return c.replace(/^HV-?/,'');}
function gapFor(r){
 const k=r.key;
 if(r.layer==='review')return ['review.source','卡文版本／語意待確認'];
 if(k==='activation:permanent_entry_name'||k.includes('mechanism rename_before_entry')||k.startsWith('duration:unspecified'))return ['core.rename','登場前改名、身分與期限'];
 if(k.startsWith('trigger:'))return ['core.passive_trigger','非自身登場的角色被動觸發'];
 if(/mechanism (deck_selection|reveal_top|move_result|shuffle|reveal_and_retrieve)/.test(k)||/revealed\./.test(k)||/Destination mechanism|choose_deck/.test(k))return ['core.deck','翻牌／檢索／剩餘牌排序／洗牌'];
 if(k.includes('Keyword not implemented:'))return ['core.keyword.'+k.split('Keyword not implemented: ')[1],'關鍵字：'+k.split('Keyword not implemented: ')[1]];
 if(k.includes('Keyword invalidation')||k.includes('filter entry_keyword_family'))return ['core.keyword_selector','關鍵字技能篩選與失效'];
 if(k.includes('mechanism external_action')||k.includes('random.result'))return ['core.external','實體動作／擲幣結果與確認'];
 if(/mechanism (simultaneous_entry_group|cover_source_with_guts)/.test(k))return ['core.entry_group','同時登場／Guts覆蓋'];
 if(k.includes('mechanism retrieve_slots')||k.includes('mechanism exchange')||k==='group_constraints')return ['core.selection_constraints','多槽／配對／交換的選牌約束'];
 if(k.includes('mechanism each_player_optional_draw'))return ['core.each_player_choice','雙方分別選擇是否抽牌'];
 if(k.includes('Per-area payment'))return ['core.guts_each','每區各付指定Guts'];
 if(/mechanism (parameter_absent|force_judgment_failure)/.test(k))return ['core.judgment','參數不存在／強制判定失敗'];
 if(/source_skill_maximum|contribution cap/.test(k))return ['core.numeric_cap','單一技能加值上限'];
 if(k.includes('Target membership'))return ['core.target_membership','持續對象集合的取樣時點'];
 if(k.startsWith('selector_zone:'))return ['core.zone_union','複合來源區域'];
 if(/Fact is not implemented|^fact:|distinct_assignment/.test(k))return ['core.facts','新增事實查詢／覆蓋前角色資訊'];
 if(k.startsWith('preflight:')||k.startsWith('admission:'))throw Error('Unmapped core capability: '+k);
 if(k.startsWith('guts_areas:'))return ['host.guts_area','跨區／指定區Guts選擇'];
 if(k.startsWith('guts_count:exact_each'))return ['host.guts_each','每區付款選牌介面'];
 if(k.startsWith('guts_count:')||k.startsWith('move_quantity:one_of_exact'))return ['host.payment_count','付款數量選單'];
 if(k.startsWith('move_quantity:')||k==='move_count_non_hand'||k==='multiple_numeric_targets')return ['host.multi_selection','多張選牌／數量／多目標介面'];
 if(k==='choose_modes')return ['host.mode_choice','效果模式選單'];
 if(k==='mill')return ['host.mill','牌頂棄牌數量與公開結果'];
 if(k==='skill_entry'||k==='numeric_target:$entered')return ['host.skill_entry','技能登場的球場／數值／觸發投影'];
 if(k.startsWith('destination:')||k.startsWith('self_destination:')||k.startsWith('hand_recipient:'))return ['host.destination','新目的區域／牌序／收牌者投影'];
 if(k.startsWith('numeric_operation:'))return ['host.numeric_set','固定數值投影'];
 if(k.startsWith('numeric_duration:')||k.startsWith('numeric_target:')||k.startsWith('numeric_domain:'))return ['host.numeric_scope','數值目標／期限／領域投影'];
 if(k==='opponent_target_viewpoint')return ['host.opponent_target','對手目標的視角與名稱'];
 if(k.startsWith('watch:'))return ['host.watch_event','其他監聽事件通知與保存'];
 if(k.startsWith('ban:'))return ['host.permission','新禁止範圍／期限接入動作入口'];
 if(k==='skill_invalidation')return ['host.invalidation','技能失效保存與查詢'];
 if(k==='protect_shape')return ['host.protection','多角色／球／跨回合保護'];
 if(k==='phase_transition')return ['host.phase','關鍵字／跳階段與回合控制銜接'];
 if(k==='active_source_zone')return ['host.active_zone','非手牌主動技能入口'];
 throw Error('Unmapped capability: '+r.layer+' '+k);
}
function extraChecks(p){
 const out=[];
 for(const [base,root]of [['program',p.program],...((p.formal_cost?.steps||[]).map((n,i)=>['formal_cost.steps['+i+']',n]))])walk(root,(n,at)=>{
  // Kernel._moveSelected never reads group_constraints. For one card, single_area
  // is vacuous, so PR-078 does not incorrectly become a new core gap.
  if(n.group_constraints&&(n.count>1||n.count_mode==='all'))out.push({layer:'core',group:'selection',key:'group_constraints',path:at,detail:'核心未執行多張回收的同區／不同名／共同所屬約束'});
  if(n.kind==='count_compare'&&n.distinct_by&&typeof n.distinct_by==='object')out.push({layer:'core',group:'numeric',key:'distinct_assignment',path:at,detail:'核心目前以有效名去重，未實作複合分配去重'});
 },base);
 return out;
}
function buildAudit(){
 const catalog=read('rules/data/cards.json'),library=read('card-library.json');
 const authority=library.authority;
 if(!authority)throw Error('Build authority required');
 if(JSON.stringify(authority)!==JSON.stringify(read('rules/runtime-data.json').authority))throw Error('Library/runtime authority mismatch');
 const coverage=buildCoverage(),byId=new Map(coverage.profiles.map(p=>[p.profile_id,p]));
 const database=read('rules/source/work/card-taxonomy/database.json');
 const rawById=new Map(database.cards.map(c=>[String(c.id),c]));
 const rows=[];
 for(const c of catalog.cards){
  if(authority.cards[short(c.card_no)]?.kind!=='unapproved')continue;
  const ps=c.profiles.map(p=>{
   const cov=byId.get(p.profile_id),nodes=[],durations=[],targetScopes=[];
   for(const [base,root]of [['program',p.program],...((p.formal_cost?.steps||[]).map((n,i)=>['formal_cost.steps['+i+']',n]))])walk(root,(n,at)=>{if(!KIND_FAMILY[n.kind])throw Error('Unknown opcode '+n.kind);nodes.push({kind:n.kind,path:at,primitive:n.kind==='keyword'?'keyword:'+n.keyword:n.kind,family:KIND_FAMILY[n.kind]});if(n.duration)durations.push({path:at+'.duration',value:n.duration});if(n.target_scope)targetScopes.push({path:at+'.target_scope',target:n.target,scope:n.target_scope});},base);
   const reasons=[...cov.reasons,...extraChecks(p)],gaps=new Map();
   for(const r of reasons){const [id,label]=gapFor(r);if(!gaps.has(id))gaps.set(id,{id,label,layer:r.layer,reasons:[]});gaps.get(id).reasons.push(r);}
   const raw=p.variants.map(v=>{const r=rawById.get(String(v.record_id));if(!r||r.card_no!==c.card_no)throw Error('Missing original card record');return {record_id:v.record_id,image_file:v.image_file,skill_jp:r.skill_jp,skill_zh:r.skill_zh,annotation_jp:r.annotation_jp,annotation_zh:r.annotation_zh};});
   return {profile_id:p.profile_id,profile_sha256:profileHash(p),source_skill_sha256:p.source_skill_sha256,old_category:cov.category,kernel_admission:cov.kernel_admission,
    script_present:!!p.activation&&!!p.program,primitive_families:uniq(nodes.map(n=>n.family)),primitives:uniq(nodes.map(n=>n.primitive)),nodes,
    gaps:[...gaps.values()].sort((a,b)=>a.id.localeCompare(b.id)),flags:p.flags,qa_trace_ids:p.official_qa_ids_for_trace_only,shared_rule_ids:p.shared_rule_ids,original_texts:raw,
    script:{trigger:p.activation,condition_paths:nodes.filter(n=>n.kind==='conditional').map(n=>n.path+'.condition'),
     cost:{formal:p.formal_cost,effect_payment_paths:nodes.filter(n=>n.kind==='payment_branch').map(n=>n.path+'.payment')},
     target_selection:{selector_paths:nodes.filter(n=>n.kind==='selector').map(n=>n.path),target_scopes:targetScopes},
     effect:p.program,durations,limit:p.limit,practice_override:p.practice_override}};
  });
  const gapIds=uniq(ps.flatMap(p=>p.gaps.map(g=>g.id)));
  const review=gapIds.some(g=>g.startsWith('review.')),core=gapIds.some(g=>g.startsWith('core.')),host=gapIds.some(g=>g.startsWith('host.'));
  rows.push({card_no:c.card_no,name:c.display_name,schools:uniq(c.profiles.flatMap(p=>p.variants.flatMap(v=>v.printed.affiliation_tags))),
   status:review?'review':core?'core_gap':host?'host_gap':'batch_candidate',gap_ids:gapIds,
   primitive_families:uniq(ps.flatMap(p=>p.primitive_families)),primitives:uniq(ps.flatMap(p=>p.primitives)),profiles:ps});
 }
 const count=k=>rows.filter(c=>c.status===k).length;
 const ids=uniq(rows.flatMap(c=>c.gap_ids));
 const gaps=ids.map(id=>{const affected=rows.filter(c=>c.gap_ids.includes(id)),ref=affected[0].profiles.flatMap(p=>p.gaps).find(g=>g.id===id);return {id,label:ref.label,layer:ref.layer,affected_cards:affected.length,sole_gap_cards:affected.filter(c=>c.gap_ids.length===1).length,card_nos:affected.map(c=>c.card_no),sole_gap_card_nos:affected.filter(c=>c.gap_ids.length===1).map(c=>c.card_no)};}).sort((a,b)=>b.affected_cards-a.affected_cards||a.id.localeCompare(b.id));
 const families=Object.entries(FAMILIES).map(([id,[label,kinds]])=>{const affected=rows.filter(c=>c.primitive_families.includes(id));return {id,label,node_kinds:kinds,affected_cards:affected.length,batch_candidate_cards:affected.filter(c=>c.status==='batch_candidate').length,card_nos:affected.map(c=>c.card_no)};});
 const opcodes=uniq(rows.flatMap(c=>c.primitives)).map(id=>{const affected=rows.filter(c=>c.primitives.includes(id));return {id,affected_cards:affected.length,batch_candidate_cards:affected.filter(c=>c.status==='batch_candidate').length,card_nos:affected.map(c=>c.card_no)};});
 const packets=new Map();for(const c of rows.filter(c=>c.status==='batch_candidate')){
  const key=c.primitives.join('|');if(!packets.has(key))packets.set(key,{primitives:c.primitives,cards:[]});packets.get(key).cards.push(c.card_no);
 }
 const batches=[...packets.values()].map(p=>({...p,count:p.cards.length})).sort((a,b)=>b.count-a.count||a.cards[0].localeCompare(b.cards[0]));
 // Independent technical-axis cross-tab, not mutually exclusive status labels.
 const technical={core_and_host_clear:rows.filter(c=>!c.gap_ids.some(g=>!g.startsWith('review.'))).length,
  no_core_gap:rows.filter(c=>!c.gap_ids.some(g=>g.startsWith('core.'))).length,
  raw_kernel_admission_all_profiles:rows.filter(c=>c.profiles.every(p=>p.kernel_admission?.passed)).length,
  any_core_gap:rows.filter(c=>c.gap_ids.some(g=>g.startsWith('core.'))).length,
  any_host_gap:rows.filter(c=>c.gap_ids.some(g=>g.startsWith('host.'))).length,
  any_review:rows.filter(c=>c.gap_ids.some(g=>g.startsWith('review.'))).length};
 const packages={selection:['host.multi_selection','host.mode_choice','host.payment_count','host.guts_area','host.guts_each','core.guts_each','core.selection_constraints'],
  rename:['core.rename'],passives:['core.passive_trigger','core.facts'],deck:['core.deck','host.mill'],
  all_host:gaps.filter(g=>g.layer==='host').map(g=>g.id)};
 const packageImpact=Object.entries(packages).map(([id,fixes])=>{const touched=rows.filter(c=>c.gap_ids.some(g=>fixes.includes(g))),clear=touched.filter(c=>c.gap_ids.every(g=>fixes.includes(g)));return {id,fixes,affected_cards:touched.length,new_static_candidates:clear.length,card_nos:clear.map(c=>c.card_no)};});
 const excludedLegacy=coverage.cards.filter(c=>c.category==='reuse_candidate'&&authority.cards[short(c.card_no)]?.kind==='legacy').map(c=>c.card_no);
 const activationTypes=uniq(rows.flatMap(c=>c.profiles.map(p=>p.script.trigger.skill_type+(p.script.trigger.trigger?':'+p.script.trigger.trigger.event:''))));
 const activations=activationTypes.map(id=>{const cards=rows.filter(c=>c.profiles.some(p=>p.script.trigger.skill_type+(p.script.trigger.trigger?':'+p.script.trigger.trigger.event:'')===id));return {id,affected_cards:cards.length,card_nos:cards.map(c=>c.card_no)};});
 const definition=fs.readFileSync(path.join(__dirname,'core.js'),'utf8').match(/const KINDS = new Set\(\[([\s\S]*?)\]\);/);
 if(!definition)throw Error('Interpreter opcode declaration changed; review audit');
 const implementedKinds=[...definition[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
 return {version:1,kind:'STATIC_PRIMITIVE_PLANNING_NOT_APPROVAL',scope:'authority.kind=unapproved; card number is counting unit; variants all retained; gap counts overlap',
  sources:Object.fromEntries(['rules/data/cards.json','rules/data/schema.json','rules/core.js','rules/legacy.js','rules/coverage.js','rules/primitive-audit.js','rules/authority.py','rules/approvals.json','rules/legacy-skills.json','card-library.json','rules/runtime-data.json','rules/source/work/card-taxonomy/database.json','rules/source/work/card-rulings/official-rulings.json'].map(f=>[f,sha(f)])),
  totals:{authority:authority.counts,cards:rows.length,profiles:rows.reduce((n,c)=>n+c.profiles.length,0),scripted_cards:rows.filter(c=>c.profiles.every(p=>p.script_present)).length,
   batch_candidate:count('batch_candidate'),host_gap:count('host_gap'),core_gap:count('core_gap'),review:count('review'),primitive_families:families.length,opcode_variants:opcodes.length,interpreter_action_kinds:implementedKinds.length,technical},
  implemented_action_kinds:implementedKinds,
  reconciliation:{old_reuse_candidates:coverage.card_categories.reuse_candidate,excluded_legacy_candidates:excludedLegacy,excluded_legacy_cards:coverage.cards.filter(c=>authority.cards[short(c.card_no)]?.kind==='legacy').map(c=>({card_no:c.card_no,old_category:c.category})),notes:'The old whole-library coverage includes fixed legacy skills across blocked categories; this audit excludes all seven through authority. Source remains first-pass, not verified semantics.'},
  policy:{admissions_changed:0,game_changed:false,source_retranslated:false,batch_plan_only:true,validation:'Existing-opcode cards: independent per-card expected outcomes + generated boundaries, then shared host/Undo/mobile regressions per opcode composition. New/changed opcode: full deep mechanism suite + all dependent-card regressions. Every profile still gets complete SHA only after passing; no approval by tags alone.'},
  activations,families,opcodes,gaps,package_impact:packageImpact,candidate_packets:batches,cards:rows};
}
function markdown(r){
 const t=r.totals,esc=s=>String(s).replace(/\|/g,'\\|').replace(/\n/g,' ');
 const packageNames={selection:'選牌／數量／跨區付款與組合約束',rename:'登場前改名與身分期限',passives:'非自身登場被動＋新增事實查詢',deck:'翻牌／檢索／排序／洗牌＋牌頂棄牌橋接',all_host:'全部既有核心能力的遊戲橋接'};
 const lines=['# BREAK 效果腳本與動作原語盤點','',`盤點基準：2026-10-21；297張未自動化技能，排除183無技能、54共用核准與7固定舊流程。這是規劃表，沒有新增核准或更改遊戲。`,'',
 '## 先看結論','',`- ${t.scripted_cards}/${t.cards}張已有觸發／條件／費用／選擇／效果／期間的第一版資料，不必重做轉譯；共${t.profiles}個profile，多卡文版本保留。`,
 `- ${t.batch_candidate}張沒有已知core／host／review靜態阻塞，可排「沿用現有原語」批次驗證；仍非直接開放。`,
 `- ${t.host_gap}張只缺host橋接或尚未驗證的操作形態；${t.core_gap}張有核心能力缺口；${t.review}張先處理卡文／語意疑義（以上互斥）。`,
 `- 93張現有能力候選與舊索引一致。先前全庫缺口分類仍包含7張固定舊流程，本次已全部排除，不能把舊host／core數字直接當297張的分組。`,
 `- 核心目前有${t.interpreter_action_kinds}種動作節點。本報告把需求整理成${t.primitive_families}個能力家族，仍保留${t.opcode_variants}個底層節點／關鍵字變體（含條件與selector）；16是工作分類，不是宣稱16個已實作原語覆蓋全庫。`,'',
 '## 互斥工作分類','','core＝共用效果結算；host＝選牌介面、球場數值及回合流程的串接。所有分類都仍需核對腳本語意。','','| 分類 | 卡數 | 下一步 |','|---|---:|---|',
 `| 現有原語＋橋接候選 | ${t.batch_candidate} | 分批語意／邊界驗證，批次host／Undo／手機回歸 |`,
 `| 只缺橋接／形態驗證 | ${t.host_gap} | 補共用選牌、數值投影或回合接點 |`,
 `| 有核心能力缺口 | ${t.core_gap} | 新原語／參數能力深度測試後，重跑依賴卡 |`,
 `| 卡文／判例／資料語意待確認 | ${t.review} | 先確認規範版本及規則邊界 |`,'',
 '## 觸發入口','','階段、觸發事件、來源區域均保留在每個腳本；以下按卡號去重。','','| 入口 | 卡數 |','|---|---:|',...r.activations.map(a=>`| ${a.id} | ${a.affected_cards} |`),'',
 '## 原語家族（卡數可重疊）','','被動觸發入口在上表；本表按實際程序節點分組，watch指效果生成的監聽。','','| 家族 | 涉及卡數 | 其中現有能力候選 | 底層節點 |','|---|---:|---:|---|',
 ...r.families.map(f=>`| ${esc(f.label)} | ${f.affected_cards} | ${f.batch_candidate_cards} | ${f.node_kinds.join('、')} |`),'',
 '## 能力缺口（卡數可重疊）','','「單缺口卡」表示只補這一項便清除已列靜態阻塞，仍需語意／組合驗證。不是預估工作量。','','| 層 | 能力 | 影響卡數 | 單缺口卡 |','|---|---|---:|---:|',
 ...r.gaps.map(g=>`| ${g.layer} | ${esc(g.label)} | ${g.affected_cards} | ${g.sole_gap_cards} |`),'',
 '## 若補一組能力，可新增多少靜態候選','','這是相依分析，並非建議一次實作所有能力；有其他缺口或疑義的卡不算解鎖。','','| 能力工作包 | 觸及卡數 | 可新增靜態候選 |','|---|---:|---:|',
 ...r.package_impact.map(p=>`| ${packageNames[p.id]} | ${p.affected_cards} | ${p.new_static_candidates} |`),'',
 '## 現有能力候選的原語組合','','按原語集合分組，不再按完整腳本雜湊或學校拆成近百家族；相同原語集合的順序／條件仍各自保留。','','| 卡數 | 原語組合 | 卡號 |','|---:|---|---|',
 ...r.candidate_packets.map(p=>`| ${p.count} | ${p.primitives.join('、')} | ${p.cards.map(short).join('、')} |`),'',
 '## 分級驗證與建議順序','',
 `1. 先從${t.batch_candidate}張挑30–50張只用已核准原語及橋接形態的卡；依付款／抽牌／數值／單張回收組合分層，家族內優先四校。這是提案，尚未選定或開工。`,
 '2. 每張保留獨立卡文預期與完整profile SHA，跑條件真假、錯階段、費用不足／拒絕、無目標／禁止、精確實體等生成反例；同組共用host／Undo／Loss／手機回歸，避免逐卡重建整套工具。',
 '3. 新原語、新參數形態及已知判例例外才走完整深測；原語修改後重跑所有依賴卡，包含已核准卡。批次失敗可拆出問題卡，其他通過的卡按SHA成批核准。',
 '4. 牌庫公開／私看、非抽牌加牌、Event放置≠打出、角色代次、觸發排序、持續期限等差異保留，不能因標籤同族而抹掉。',
 '5. 每批完成仍提交／推送／部署並回報數值／嚴格可組牌、自動化技能數；本輪僅盤點，遊戲版本保持。','',
 '## 表達能力的界線','',
 `全profile的Kernel admission通過：${t.technical.raw_kernel_admission_all_profiles}張；沒有已列core缺口：${t.technical.no_core_gap}張；沒有core／host缺口：${t.technical.core_and_host_clear}張。這些是不同層次，不能把preflight通過稱為整卡可用。`,
 '掃描完整program與formal_cost.steps，沿用coverage逐節點阻塞檢查，另檢查多張回收group_constraints（核心目前未讀取）。P01-021、P01-076、P03-088、P03-097四張因此從舊host分類移至core分類；本輪僅列出缺口，尚未修正結算。單張PR-078的single_area約束自然成立，不誤列為核心缺口。原語存在但某些參數／約束未執行也算缺口。未窮舉所有局面，仍可能發現新的語意／橋接問題。',
 '效果腳本JSON保留原始日文／譯文、完整profile指紋、觸發、費用、程序、期間、規則ID及QA追溯ID；QA不是直接綁定卡號的程式分支。尚未將本輪資料標記為已驗證。','',
 '## 重現','', '`node rules/primitive-audit.js /absolute/output-directory`', '', '輸出primitive-audit.json（逐卡＋腳本＋缺口）、primitive-audit.md（本報告）、primitive-cards.md（逐卡工作表）。來源指紋保存在JSON；腳本不修改卡庫／權限／runtime。',''];
 return lines.join('\n');
}
function cardMarkdown(r){return ['# 297張未自動化技能逐卡盤點','', '卡號為計數單位，多版本在JSON中完整保留；下表不授予執行核准。','', '| 卡號 | 名稱 | 分類 | 原語家族 | 全部能力缺口 |','|---|---|---|---|---|',...r.cards.map(c=>`| ${short(c.card_no)} | ${c.name.replace(/\|/g,'\\|')} | ${c.status} | ${c.primitive_families.join('、')} | ${c.gap_ids.join('、')||'無已列靜態阻塞；待驗證'} |`),''].join('\n');}
if(require.main===module){const r=buildAudit();if(process.argv[2]){const out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'primitive-audit.json'),JSON.stringify(r,null,2)+'\n');fs.writeFileSync(path.join(out,'primitive-audit.md'),markdown(r));fs.writeFileSync(path.join(out,'primitive-cards.md'),cardMarkdown(r));}else process.stdout.write(JSON.stringify(r.totals,null,2)+'\n');}
module.exports={buildAudit,markdown,cardMarkdown,gapFor,extraChecks,FAMILIES};
