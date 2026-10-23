"""Compile once-transcribed card programs into rule-linked data; no game mutation."""
import collections
import copy
import hashlib
import json
import re
import unicodedata
from pathlib import Path
import programs
from model import PROGRAMS, TRIGGERS, NOTES, seq, SINGLE
from schema import SCHEMA, validate_mapping

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'outputs'
WORK=ROOT/'work/card-mapping'
source_path=ROOT/'work/card-taxonomy/database.json'
source=json.loads(source_path.read_text())
shared=json.loads((OUT/'BREAK-shared-rules.json').read_text())
rule_index={r['id']:r for r in shared['rules']}
categories=['數值','資源與移動','角色與身分','行動權限','技能權限','流程與觸發']
qa_rules={r['qa_id']:r['rule_ids'] for r in shared['qa_rule_map']}
PHASES={'サーブ':'serve','ブロック':'block','ドロー':'draw','レシーブ':'receive','トス':'toss','アタック':'attack'}
AREAS={k+'エリア':v for k,v in PHASES.items() if k!='ドロー'}|{'コート':'court','手札':'hand'}
def sha(text): return hashlib.sha256(text.encode()).hexdigest()
def namekey(text): return re.sub(r'\s+','',unicodedata.normalize('NFKC',text))
def normalize_program_names(value,parent_key=''):
    if isinstance(value,list): return [normalize_program_names(v,parent_key) for v in value]
    if not isinstance(value,dict):
        return namekey(value) if isinstance(value,str) and parent_key in ['names','exclude_names','covered_names'] else value
    result={k:normalize_program_names(v,k) for k,v in value.items()}
    if result.get('kind')=='compare' and any(t in result.get('field','') for t in ['effective_name','entry_skill_name']):
        if isinstance(result['value'],str): result['value']=namekey(result['value'])
    return result

def printed(c):
    tokens=[t.strip() for t in re.split(r'[/,·・]',unicodedata.normalize('NFKC',c['affiliation'])) if t.strip() and t.strip()!='-']
    pos=set(p for p in c['position'].split(',') if p and p!='-')
    years=sorted({int(m.group(1)) for t in tokens if (m:=re.fullmatch(r'(\d)年',t))})
    tags=sorted({t for t in tokens if not re.fullmatch(r'\d年',t) and t not in pos})
    if c['card_no']=='HV-PR-013':
        # Official JSON itself has 梟谷2·年; official card image visibly reads 梟谷・2年.
        tags=['梟谷'];years=[2,3]
    stats={full:('dash' if c[k] in [None,'-','－','—'] else c[k]) for k,full in [('srv','serve'),('blk','block'),('rcv','receive'),('tos','toss'),('atk','attack')]}
    assert all(isinstance(n,int) or n=='dash' for n in stats.values()),(c['card_no'],stats)
    return dict(name=namekey(c['name']),display_name=c['name'],type=c['category'].lower(),
                affiliation_tags=tags,year_tags=years,position_tags=sorted(pos),parameters=stats if c['category']=='CHARACTER' else None)

NODE_RULES={
 'sequence':['effect.order'], 'conditional':['condition.checkpoint','condition.snapshot'],
 'compare':['condition.checkpoint'], 'all':['condition.checkpoint'], 'any':['condition.checkpoint'],
 'equal_fields':['condition.checkpoint'], 'selector':['target.explicit_selector'],
 'uniform_affiliation':['condition.uniform'], 'count_compare':['condition.checkpoint'],
 'all_result_cards_match':['condition.nonempty_results'],
 'numeric':['numeric.accumulate','numeric.negative','duration.target_instance'],
 'draw':['resource.shortfall','hand.draw_subset','hand.restriction','trigger.actual_event'],
 'draw_to_hand_size':['resource.shortfall','hand.draw_subset'],
 'move':['move.owner','resource.shortfall'], 'move_self':['move.owner'],
 'pay_guts':['cost.guts_source','cost.guts_side'],
 'payment_branch':['cost.effect_branch'], 'retrieve':['resource.shortfall','hand.draw_subset','hand.restriction'],
 'retrieve_slots':['resource.shortfall'], 'enter':['trigger.entry','entry.limit','entry.parameter','entry.name_roles'],
 'enter_self':['trigger.entry','entry.limit','entry.parameter','entry.name_roles'],
 'deck_selection':['selection.upto','move.reveal_hidden','reveal.remainder','resource.shortfall'],
 'mill':['resource.shortfall'], 'reveal_top':['effect.mandatory','resource.shortfall'],
 'move_result':['move.owner','reveal.remainder'],
 'keyword':[], 'watch':['trigger.actual_event','duration.generated','trigger.players','trigger.own_order'],
 'ban_action':['permission.deny'], 'invalidate_skill':['skill.invalidate','skill.selector','permission.layers'],
 'protect_numeric_decrease':['numeric.protection'], 'exchange':['move.exchange','selection.upto'],
 'phase_jump':['flow.draw_start','duration.same_turn','trigger.skipped_window','flow.current_skill_after_skip'],
 'external_action':['external.action'], 'optional':['effect.independent'],
 'choose_modes':['selection.exact_modes'], 'parameter_absent':['numeric.absent'],
 'force_judgment_failure':['judge.checkpoint'],
 'cover_source_with_guts':['entry.placement_not_entry','move.owner'],
 'simultaneous_entry_group':['trigger.own_order','effect.order'],
 'shuffle':['effect.mandatory'], 'reveal_and_retrieve':['reveal.remainder','move.reveal_hidden'],
 'each_player_optional_draw':['selection.chooser','selection.optional_exact','resource.shortfall'],
 'rename_before_entry':['identity.pre_entry_name','identity.name_scope','entry.name_roles'],
 'printed_parameter':['identity.printed'], 'sum_result_parameter':['cost.paid_predicate'],
 'result_count':['condition.checkpoint'],
 'source_skill_maximum':[],
}
KEYWORD_RULES={k:'keyword.'+k for k in ['doshat','one_touch','feint','blockout','a_pass','two_attack','back_attack','multi_attack']}
KIND_CATEGORIES={
 'numeric':['數值'],'draw':['資源與移動'],'draw_to_hand_size':['資源與移動'],
 'move':['資源與移動'],'move_self':['資源與移動'],'pay_guts':['資源與移動'],
 'retrieve':['資源與移動'],'retrieve_slots':['資源與移動'],'enter':['角色與身分'],
 'enter_self':['角色與身分'],'deck_selection':['資源與移動'],'mill':['資源與移動'],
 'reveal_top':['資源與移動'],'move_result':['資源與移動'],'keyword':['流程與觸發'],
 'watch':['流程與觸發'],'ban_action':['行動權限'],'invalidate_skill':['技能權限'],
 'protect_numeric_decrease':['數值'],'exchange':['資源與移動'],'phase_jump':['流程與觸發'],
 'external_action':['流程與觸發'],'parameter_absent':['數值'],'force_judgment_failure':['流程與觸發'],
 'cover_source_with_guts':['角色與身分','資源與移動'],'simultaneous_entry_group':['角色與身分','流程與觸發'],
 'shuffle':['資源與移動'],'reveal_and_retrieve':['資源與移動'],'each_player_optional_draw':['資源與移動'],
 'rename_before_entry':['角色與身分'],
}

def annotate(value,path='program',in_payment=False):
    if isinstance(value,list): return [annotate(v,f'{path}[{i}]',in_payment) for i,v in enumerate(value)]
    if not isinstance(value,dict): return value
    result={k:annotate(v,f'{path}.{k}',in_payment or k=='payment') for k,v in value.items()}
    kind=value.get('kind')
    if not kind: return result
    assert kind in NODE_RULES,(path,kind)
    refs=list(NODE_RULES[kind]); cats=list(KIND_CATEGORIES.get(kind,[]))
    if kind in ['numeric','protect_numeric_decrease','parameter_absent','rename_before_entry']:
        result.setdefault('target_scope',SINGLE(value['target']))
        if result['target_scope']['binding']=='choose': refs.append('selection.chooser')
    if kind in ['move','retrieve','enter','pay_guts','cover_source_with_guts']:
        refs.append('selection.chooser')
        if value.get('count_mode')=='one_of_exact': refs.append('cost.amount_branch')
    if kind=='keyword': refs.append(KEYWORD_RULES[value['keyword']])
    if kind=='numeric':
        if value['operation']=='set': refs.append('numeric.fixed_order')
        if value['parameter']=='chosen' or isinstance(value['parameter'],dict): refs.append('numeric.choose_parameter')
        if value['parameter'] in ['offense','attack_offense','defense']: refs+=['numeric.ball_kind','numeric.total_independent']
        result.setdefault('duration','current_turn_cleanup_or_role_exit')
        result['evaluation_order']=['resolve_target','bind_target','evaluate_value_and_guard','apply']
        if isinstance(value['target'],str) and value['target'] in ['$target','$entered']:
            refs.append('effect.dependent_target')
            result['depends_on_result']=value['target'][1:]+'.selected_target'
            result['if_result_has_no_target']='skip_this_step_only'
    if kind=='uniform_affiliation':
        if len(value['options'])>1: refs.append('condition.uniform_or')
        if 'pools' in value: refs.append('condition.uniform_union')
    if kind=='count_compare':
        if value.get('distinct_by'): refs.append('count.distinct_names')
        filters=value['pool']['filters']
        if 'play_icons_any' in filters: refs.append('count.cards_not_icons')
        if value['pool']['zone']=='event' and not filters.get('type'): refs.append('zone.event_count_all_types')
    if kind=='selector':
        if value['zone']=='event': refs.append('zone.event_pool')
        if any('tags' in k for k in value['filters']): refs+=['identity.exact_tags','identity.multi']
        if 'positions' in value['filters'] or 'positions_any' in value['filters']: refs.append('identity.multi')
        if 'role' in value['filters']: refs.append('zone.not_guts')
    if kind=='compare':
        field=value['field']
        if field.startswith('paid.'): refs.append('condition.after_payment')
        if 'printed_' in field: refs.append('identity.printed')
        if 'entry_origin' in field: refs.append('entry.origin')
        if 'entry_skill_name' in field: refs.append('entry.origin')
        if field.startswith('target.'): refs.append('target.explicit_selector')
        if field=='phase': refs.append('condition.phase_scope')
        if field=='opponent_ball.kind': refs.append('numeric.ball_kind')
        if field=='self.court.distinct_affiliation_assignment_count': refs.append('condition.distinct_affiliations')
        if field=='paid.names_are_distinct': refs.append('condition.related_selection')
        if field.startswith('source.covered_character.'): refs.append('identity.current_name')
    if kind=='all_result_cards_match' and value['result']=='paid': refs+=['cost.paid_predicate','condition.after_payment']
    if kind=='pay_guts':
        if value.get('areas')!='source_area': refs.append('cost.guts_sum')
        if value.get('allowed_counts'): refs.append('cost.amount_branch')
    if kind in ['move','retrieve']:
        if value.get('count_mode')=='upto': refs.append('selection.upto')
        if value.get('group_constraints'): refs.append('condition.related_selection')
        if value.get('destination','').endswith('.guts'): refs.append('zone.guts_requires_character')
        if value.get('reason')=='effect_placement_not_play': refs.append('event.place_not_play')
    if kind=='watch':
        refs.append('trigger.per_object')
        if value['event']=='character_entry': refs+=['trigger.each_entry','limit.activation_not_watch']
        if value.get('remaining_uses') is not None: refs.append('limit.effect_instance')
        if value['event']=='loss': refs+=['loss.before_interval','duration.no_turn']
        if value['filters'].get('exclude_operations')==['draw']: refs.append('hand.draw_vs_add')
    if kind=='ban_action':
        if value['action']=='add_hand': refs+=['hand.restriction','hand.draw_subset']
        if value['action']=='enter_character':
            refs.append('entry.limit')
            if any(k.startswith('printed_') for k in value['scope']): refs.append('entry.printed_limit')
        if value['action']=='play_event': refs.append('event.place_not_play')
    if kind in ['enter','enter_self'] and value.get('as_side_blocker'): refs.append('entry.side_capacity')
    if kind=='phase_jump': assert value['destination']=='draw'
    result['node_id']=path
    result['shared_rule_ids']=sorted(set(refs))
    assert set(refs)<=set(rule_index),set(refs)-set(rule_index)
    if cats:
        result['category_tags']=cats
        result['classification_role']='payment' if in_payment else 'effect'
        result['polarity']=polarity(value) if not in_payment else None
    return result

def polarity(node):
    kind=node['kind']
    if kind=='numeric':
        n=node['value']
        return 'beneficial' if node['operation']=='add' and isinstance(n,int) and n>0 else 'adverse' if node['operation']=='add' and isinstance(n,int) and n<0 else 'contextual'
    if kind in ['draw','draw_to_hand_size','retrieve','retrieve_slots','protect_numeric_decrease','each_player_optional_draw']: return 'beneficial'
    if kind in ['ban_action','invalidate_skill','parameter_absent','force_judgment_failure']: return 'adverse'
    if kind in ['reveal_top','external_action']: return 'neutral'
    return 'contextual'

def walk(obj):
    if isinstance(obj,dict):
        yield obj
        for v in obj.values(): yield from walk(v)
    elif isinstance(obj,list):
        for v in obj: yield from walk(v)

def parse_activation(card,text):
    normal=text.replace('［=','[=').replace('］',']')
    m=re.match(r'^\s*(?:\[=[^\]]+\]\s*)+',normal)
    icons=re.findall(r'\[=([^\]]+)\]',m.group(0)) if m else []
    phases=[PHASES[x.removesuffix('フェイズ')] for x in icons if x.removesuffix('フェイズ') in PHASES]
    areas=[AREAS[x] for x in icons if x in AREAS]
    if card['category']=='EVENT': kind='event'; trigger=None; source_zone=['hand']
    elif 'このカードを登場させる際' in text: kind='permanent_entry_name'; trigger=dict(event='before_entry'); source_zone=['entering_card']
    elif '登場' in icons: kind='passive';trigger=dict(event='self_entry',destination_any=areas);source_zone=areas
    elif phases: kind='active';trigger=None;source_zone=areas
    else:
        kind='passive';trigger=copy.deepcopy(TRIGGERS.get(card['card_no']))
        assert trigger,(card['card_no'],'missing explicit trigger')
        source_zone=['court']
    return dict(skill_type=kind,activation_phases=phases,source_zones=source_zone,trigger=trigger,
                window='free_step_after_required_draw_and_entry_checks' if kind in ['active','event'] else 'trigger_check_process',
                reveal_source_on_declaration=kind=='active' and 'hand' in source_zone,
                explicit_phase_gate_only=True)

def formal_cost(text):
    found=re.findall(r'〔([^〕]+)〕\s*[:：]',text)
    if not found: return None
    assert len(found)==1
    cost=found[0]
    if 'ガッツ' in cost:
        n=int(re.search(r'(\d+)ガッツ',cost).group(1))
        from model import G
        step=G(n,['attack'])
    elif 'イベントエリア' in cost: step=dict(kind='move_self',destination='self.event',reason='declaration_cost')
    elif 'ドロップ' in cost: step=dict(kind='move_self',destination='owner.drop',reason='declaration_cost')
    else: raise ValueError(cost)
    return dict(kind='formal_declaration_cost',steps=[annotate(step,'formal_cost',True)],must_be_complete=True,
                performed_for_this_skill_only=True,shared_rule_ids=['cost.declaration'])

def rename(text,number):
    m=re.search(r'カード名を「([^」]+)」の代わりに「([^」]+)」か「([^」]+)」にする',text)
    assert m,text
    return seq(dict(kind='rename_before_entry',target='source',original_name=namekey(m[1]),
                    choose_name=[namekey(m[2]),namekey(m[3])],
                    duration='this_turn' if number in ['HV-P02-077','HV-P02-078','HV-P03-077'] else ('this_turn_or_role_exit' if 'そのターン終了時' in text else 'unspecified_in_this_print'),
                    character_count=1))

# These text corrections were already adopted in SCRIPT-REVIEW section 2.
# Equivalence is a consistency check, never a substitute for a ruling or tests.
TEXT_RESOLUTIONS={
 'HV-P02-077':dict(ruling='rename_until_turn_end',basis='accepted SCRIPT-REVIEW section 2 / general end-phase rule'),
 'HV-P02-078':dict(ruling='rename_until_turn_end',basis='accepted SCRIPT-REVIEW section 2 / general end-phase rule'),
 'HV-P03-077':dict(ruling='rename_until_turn_end',basis='accepted SCRIPT-REVIEW section 2 / general end-phase rule'),
 'HV-P04-072':dict(ruling='character_cards_only',basis='official QA1911 / accepted SCRIPT-REVIEW section 2'),
}
def rule_body(value):
    if isinstance(value,dict): return {k:rule_body(v) for k,v in value.items() if k not in ['node_id','shared_rule_ids','category_tags','classification_role','polarity']}
    if isinstance(value,list): return [rule_body(v) for v in value]
    return value
def mechanics(p):
    return json.dumps(rule_body(dict(program=p['program'],activation=p['activation'],formal_cost=p['formal_cost'],limit=p['limit'],practice_override=p['practice_override'],printed=sorted({json.dumps(v['printed'],ensure_ascii=False,sort_keys=True) for v in p['variants']}))),ensure_ascii=False,sort_keys=True)

by_number=collections.defaultdict(list)
for c in source['cards']: by_number[c['card_no']].append(c)
cards=[];anomalies=[];profile_counts=collections.Counter();node_counts=collections.Counter()
all_variant_ids=set();all_used_programs=set();all_names={namekey(c['name']) for c in source['cards']}
exact_tags=set(t for c in source['cards'] for t in printed(c)['affiliation_tags'])
for number,records in by_number.items():
    skill_groups=collections.defaultdict(list)
    for c in records: skill_groups[c['skill_jp'] or ''].append(c)
    profiles=[]
    for text,variants in skill_groups.items():
        c=variants[0]; blank=text.strip() in ['','-']; flags=[]
        if blank:
            activation=None;program=None;cost=None;status='NO_SKILL_BASE_DATA'
        else:
            activation=normalize_program_names(parse_activation(c,text));cost=formal_cost(text)
            if activation['skill_type']=='permanent_entry_name': program=rename(text,number)
            else:
                assert number in PROGRAMS,number
                all_used_programs.add(number);program=copy.deepcopy(PROGRAMS[number])
            program=annotate(normalize_program_names(program))
            status='STRUCTURED_FIRST_PASS_NOT_ENGINE_VALIDATED'
            if len(skill_groups)>1: flags.append('OFFICIAL_TEXT_VARIANTS_PRESERVED')
            if any(n.get('target_scope',{}).get('membership')=='unresolved' for n in walk(program)):
                flags.append('TARGET_MEMBERSHIP_UNRESOLVED')
        base_profiles=[]
        for variant in variants:
            identity=printed(variant)
            legacy=sorted(variant.get('school_tags',[]))
            if identity['affiliation_tags']!=legacy:
                anomaly=dict(kind='DERIVED_AFFILIATION_TAG_MISMATCH',card_no=number,record_id=variant['id'],
                             legacy=legacy,exact=identity['affiliation_tags'],
                             handling='以完整所屬欄位精確分割，不以子字串標籤覆蓋',qa_ids=['1798','1817'])
                anomalies.append(anomaly)
            vid=f"{number}:record:{variant['id']}"
            assert vid not in all_variant_ids;all_variant_ids.add(vid)
            base_profiles.append(dict(variant_id=vid,record_id=variant['id'],image_file=variant['image_file'],rarity=variant['rarity_code'],
                                      printed=identity,raw_affiliation=variant['affiliation'],legacy_school_tags=legacy))
        refs=set(['entry.parameter','entry.name_roles','identity.multi','identity.exact_tags','identity.printed']) if c['category']=='CHARACTER' else {'event.normal_play','event.phase','permission.layers','event.place_not_play'}
        for node in walk(program):
            refs.update(node.get('shared_rule_ids',[]))
            if 'kind' in node: node_counts[node['kind']]+=1
        if cost:refs.add('cost.declaration')
        named_lock='[=ターン1]' in text or 'このターン中、自分は' in text and 'スキルを使えない' in text
        limit=dict(kind='same_name_turn_lock',owner='controller',name_basis='effective_name',
                   apply_after='last_step_if_any_skill_effect_performed',scope='this_turn',shared_rule_ids=['limit.same_name']) if named_lock else None
        if limit:refs.add('limit.same_name')
        phase_override=dict(id='practice.draw_event_before_receive',extra_window='before_receive_judgment',default_current_game=True) if activation and activation['skill_type']=='event' and 'draw' in activation['activation_phases'] else None
        qas=sorted({str(q['id']) for variant in variants for q in variant.get('qa',[])},key=int)
        assert all(q in qa_rules for q in qas)
        p=dict(profile_id=number+':'+sha(text)[:16],source_skill_sha256=sha(text),status=status,
               game_integrated=False,runtime_approved=False,activation=activation,formal_cost=cost,
               limit=limit,program=program,shared_rule_ids=sorted(refs),
               official_qa_ids_for_trace_only=qas,qa_not_used_as_automatic_effect_binding=True,
               variants=base_profiles,flags=flags,practice_override=phase_override)
        if number in NOTES:p['transcription_note']=NOTES[number]
        if number=='HV-P02-035':
            p['source_corrections']=[dict(field='numeric.target.affiliation',database_value='稲荷埼',mapped_value='稲荷崎',basis_qa='1299')]
        if number=='HV-PR-013':
            p['source_corrections']=[dict(field='printed.affiliation_and_years',database_and_official_json_value='梟谷·3年/梟谷2·年',
                                         mapped_affiliations=['梟谷'],mapped_years=[2,3],
                                         basis='official_card_image_visually_checked',
                                         image_url='https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card/HV-PR-013-P.webp',
                                         image_sha256=hashlib.sha256((WORK/'official-PR-013-P.webp').read_bytes()).hexdigest())]
        profiles.append(p);profile_counts[status]+=1
    resolution=TEXT_RESOLUTIONS.get(number) if len(profiles)>1 and len({mechanics(p) for p in profiles})==1 else None
    if resolution:
        for p in profiles:p['flags']=[f for f in p['flags'] if f!='OFFICIAL_TEXT_VARIANTS_PRESERVED']
    raw_bases={json.dumps({k:c[k] for k in ['name','category','affiliation','position','srv','blk','rcv','tos','atk']},ensure_ascii=False,sort_keys=True) for c in records}
    normalized_bases={json.dumps(printed(c),ensure_ascii=False,sort_keys=True) for c in records}
    if len(raw_bases)>1:
        anomalies.append(dict(kind='RAW_BASE_VARIANTS',card_no=number,raw_count=len(raw_bases),normalized_count=len(normalized_bases),
                              handling='原欄位保留；本批位置重複附在所屬文字者標準化後相同' if len(normalized_bases)==1 else '真正身分差異須依版本處理'))
    if len(skill_groups)>1:
        anomalies.append(dict(kind='OFFICIAL_SKILL_TEXT_VARIANTS',card_no=number,profile_ids=[p['profile_id'] for p in profiles],
                              handling='沿用已採納裁定，保留各版原文；執行開放仍需逐資料組情境測試' if resolution else '保留各版本，不選定單一規範文字；相同效果結構也不等於已裁定印刷差異'))
    cards.append(dict(card_no=number,display_name=records[0]['name'],type=records[0]['category'].lower(),profiles=profiles,
                      record_count=len(records),skill_text_variant_conflict=len(skill_groups)>1,**({'skill_text_variant_resolution':resolution} if resolution else {})))

assert all_used_programs==set(PROGRAMS),set(PROGRAMS)-all_used_programs
assert len(cards)==541 and len(all_variant_ids)==713
skill_profiles=[p for c in cards for p in c['profiles'] if p['program']]
assert len(skill_profiles)==362
assert len({c['card_no'] for c in cards if any(p['formal_cost'] for p in c['profiles'])})==15

# These are proposed shared extensions, never silently added to the verified 130-rule library.
extensions=[dict(id='PROPOSED-NUMERIC-SOURCE-CAP',card_nos=['HV-P03-047'],
                 kind='numeric_source_contribution_limit',category='數值',
                 requirement='只限制本技能造成的舉球加值，其他來源的數值不能被此技能下修',
                 status='SOURCE_TRANSCRIBED_SHARED_RULE_EXTENSION_NOT_VERIFIED')]
for e in extensions: anomalies.append(dict(kind='SHARED_RULE_EXTENSION',extension_kind=e['kind'],**{k:v for k,v in e.items() if k!='kind'}))
anomalies.append(dict(kind='SOURCE_BOUNDARY',id='OPEN-EVENT-NO-CHANGE',
                     handling='繼承共用規則庫的完全無變化事件宣告待釐清點；不在本批推定一般允許'))
for c in cards:
    for p in c['profiles']:
        for node in walk(p['program']):
            if 'increase_guard' in node: node['proposed_shared_rule_id']='PROPOSED-NUMERIC-SOURCE-CAP'

counts=dict(cards=len(cards),source_records=len(source['cards']),unique_image_files=len({c['image_file'] for c in source['cards']}),
            total_skill_text_profiles=sum(len(c['profiles']) for c in cards),skill_profiles=len(skill_profiles),
            skill_cards=sum(bool(c['profiles'][0]['program']) for c in cards),
            no_skill_cards=sum(not c['profiles'][0]['program'] for c in cards),
            manual_card_programs=len(PROGRAMS),rename_skill_profiles=sum(bool(p['activation']) and p['activation']['skill_type']=='permanent_entry_name' for c in cards for p in c['profiles']),
            formal_cost_cards=15,formal_cost_profiles=sum(bool(p['formal_cost']) for p in skill_profiles),variant_conflict_cards=sum(c['skill_text_variant_conflict'] for c in cards),
            derived_tag_correction_cards=len({a['card_no'] for a in anomalies if a['kind']=='DERIVED_AFFILIATION_TAG_MISMATCH'}),
            normalized_equivalent_base_variant_cards=sum(a['kind']=='RAW_BASE_VARIANTS' and a['normalized_count']==1 for a in anomalies),
            proposed_shared_extensions=len(extensions),
            unresolved_target_membership_profiles=sum('TARGET_MEMBERSHIP_UNRESOLVED' in p['flags'] for p in skill_profiles),
            program_node_counts=dict(node_counts),profile_status_counts=dict(profile_counts))
payload=dict(schema_version=2,status='ALL_CARD_STRUCTURED_MAPPING_FIRST_PASS_NOT_GAME_INTEGRATED',checked_on='2026-10-20',
             source=dict(database_sha256=sha(source_path.read_text()),database_url='https://weilun2022.github.io/haikyuu-cards/cards_data.js',
                         shared_rules_sha256=sha((OUT/'BREAK-shared-rules.json').read_text())),
             counts=counts,
             interpretation=dict(program='Typed declarative data, built once; no runtime Japanese or per-card QA reading',
                                 source_data='Community card text with recorded official clarifications; not all physical printings individually verified',
                                 polarity='beneficial/adverse relative to affected object; payment nodes carry no effect polarity',
                                 result_scope='fresh local invocation frame; watcher carries its own event context',
                                 execution_status='Transcribed data is not a claim that the game can execute every node'),
             selector_contract=dict(combine_filter_keys='all',names='any exact normalized name',tags='all exact tags',
                                    tags_any='any exact tag',positions='all exact position tags',positions_any='any exact position',
                                    position_has_any_other_than='at least one position outside the listed set; dual Li+WS satisfies non-Li',
                                    role_groups=dict(character=['serve','receive','toss','attack','center_blocker','side_blocker'],block=['center_blocker','side_blocker']),
                                    covered_character_fields='snapshot immediately before coverage, not the later guts name',
                                    no_target_result='skip only explicitly dependent steps; distinct from missing rule data',
                                    selection_cardinality='selector only describes a pool; target_scope or action count_mode determines selection',
                                    target_scope_modes=['single','multiple','all'],
                                    unresolved_membership='explicit flag; never eligible for runtime approval'),
             card_data_contract=dict(shared['card_data_contract'],mapping_status='ALL_CARD_STRUCTURED_FIRST_PASS',
                                     program_schema_version=2,program_schema_artifact='BREAK-card-program-schema.json',
                                     field_list_role='Reference design fields; actual serialized program fields are defined by the linked schema'),
             cards=cards,anomalies=anomalies,
             proposed_shared_extensions=extensions)
structure_counts=validate_mapping(payload)
payload['structure_validation']=dict(status='STRICT_PROGRAM_CONTRACT_PASSED_NOT_GAME_VALIDATED',
                                    schema_artifact='BREAK-card-program-schema.json',**structure_counts)
(OUT/'BREAK-card-program-schema.json').write_text(json.dumps(SCHEMA,ensure_ascii=False,indent=2)+'\n')
(OUT/'BREAK-card-rule-mapping.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n')
(WORK/'counts.json').write_text(json.dumps(counts,ensure_ascii=False,indent=2)+'\n')

report=[f'''# BREAK 全卡共用規則映射 v1

日期：2026-10-20。**541卡已完成第一輪結構化建檔：358張有技能（362個卡文版本）、183張無技能。** 技能拆成條件、支付分支、目標、分段效果、監聽、期限與限次，引用既有共用規則。329張非改名技能用資料建檔，29張改名卡依固定選名機制轉換；對戰時不需要重讀卡文或問答。

資料規格v2修正PR-081可選精確支付數量，明示單體／多人／全體目標，並統一被動觸發名稱識別格式。全量545個資料組通過嚴格技能結構檢查；[結構規格](BREAK-card-program-schema.json)。P04-070依使用者裁定採本回合持續匹配，包含之後正常及事件效果登場；保護節點完成前仍未開放。

這是資料轉譯第一輪，**不是全卡技能已可在遊戲執行**。目前遊戲未讀取這份資料；所有技能仍標記未經引擎情境驗證，四卡印刷差異與一個共用機制擴充保留待處理。

## 資料範圍與重要修正

| 項目 | 結果 |
|---|---:|
| 卡號 | 541 |
| 來源紀錄／不重複卡圖檔名 | {counts['source_records']}／{counts['unique_image_files']} |
| 有技能卡／無技能卡 | 358／183 |
| 有技能卡文版本 | 362 |
| 正式宣告費用 | 15 |
| 官方卡文差異卡號 | 4 |
| 衍生所屬標籤修正卡號 | {counts['derived_tag_correction_cards']} |

之前713的統計是來源紀錄數，包含六組同卡圖的重複紀錄；本批保留全部紀錄ID，同時標出真正不重複卡圖數，避免當成713張不同卡圖。其中五組有重複附位置的文字差異，另一組PR-078原資料相同。

- 階段圖示只作明示的使用門檻；登場區域與後續監聽分開。
- 正式宣告費用獨立於效果中的選擇支付；支付節點不標成負面效果。
- 數值、來球種類、原始資料／目前資料、登場來源、動作來源、玩家及角色實例分開保存。
- 官方QA關聯只作追溯，不因某張卡的問答提到另一張卡，就替來源卡自動加上對方技能。
- 完整所屬精確分割保留音駒中、白鳥沢中；資料庫舊衍生標籤的子字串誤歸類沒有沿用。
- 早流川工業及海外俱樂部保存完整所屬名稱，舊的簡稱／海外分類僅保留為搜尋分組，不能當作卡面所屬。
- 五組所屬欄位重複附位置的差異，轉成分開的所屬／學年／位置後相同；原始紀錄仍保留。
- P02-035的技能所屬「稲荷埼」按官方QA1299映射為「稲荷崎」，只記這筆來源修正，不新增全域模糊別名。
- PR-013官方文字欄位本身有學年錯字，已讀取官方卡圖核對為梟谷3年與梟谷2年，保留修正來源與圖檔指紋。
- 「只放在角色上」的機制已依總合1-4-5／8-3補成共用規則，與明示登場分開，不需為P03-028另寫特製判斷。

## 全卡覆蓋索引

表中「結構化」表示已轉成資料節點，仍未經遊戲引擎驗證；「無技能」只表示基礎資料沒有技能，不代表免除一般規則。

| 卡號／名稱 | 卡文版本／來源紀錄 | 狀態 | 分類與規則數 |
|---|---|---|---|''']
for c in cards:
    ps=c['profiles']; active=bool(ps[0]['program'])
    cats={tag for p in ps for n in walk(p['program']) for tag in n.get('category_tags',[])}
    refs={r for p in ps for r in p['shared_rule_ids']}
    flags=sorted({f for p in ps for f in p['flags']})
    status='結構化初稿' if active else '無技能基礎資料'
    if flags:status+='；'+', '.join(flags)
    report.append(f"| {c['card_no']} {c['display_name']} | {len(ps)}／{c['record_count']} | {status} | {'、'.join(x for x in categories if x in cats) or '一般登場規則'}；{len(refs)}條 |")
report+=['\n## 待處理與驗證\n',
         '- [異常與例外清單](BREAK-card-mapping-exceptions.md)',
         '- [結構化全卡資料](BREAK-card-rule-mapping.json)',
         '- [本批驗證結果](BREAK-card-mapping-validation.md)',
         '- [共用規則庫](BREAK-shared-rules.md)及[權限矩陣](BREAK-permission-matrix.md)',
         '\n本批不修改遊戲引擎、UI或公開頁，未建置、提交、推送或部署。']
(OUT/'BREAK-card-rule-mapping.md').write_text('\n'.join(report)+'\n')

exceptions=['# BREAK 全卡映射異常與例外\n','日期：2026-10-20。以下明確保留，不以猜測補上。\n',
            '## 版本差異\n','| 卡號 | 處理 |','|---|---|']
for a in anomalies:
    if a['kind']=='OFFICIAL_SKILL_TEXT_VARIANTS':exceptions.append(f"| {a['card_no']} | {a['handling']} |")
exceptions+=['\n## 共用機制擴充\n','| 建議共用規則 | 涉及卡號 | 需要釐清 |','|---|---|---|']
for e in extensions:exceptions.append(f"| {e['id']} | {','.join(e['card_nos'])} | {e['requirement']} |")
exceptions+=['\n## 已處理的資料品質差異\n','| 卡號 | 舊標籤 | 精確標籤 |','|---|---|---|']
seen=set()
for a in anomalies:
    if a['kind']=='DERIVED_AFFILIATION_TAG_MISMATCH' and a['card_no'] not in seen:
        seen.add(a['card_no']);exceptions.append(f"| {a['card_no']} | {'、'.join(a['legacy'])} | {'、'.join(a['exact'])} |")
exceptions+=['\n- PR-074／075／076／077／079的重複所屬文字標準化後一致，保留來源兩筆，不當成兩種規則。',
             '- P02-035的所屬字形差異依官方QA1299校正，來源修正另存。',
             '- PR-013官方JSON的梟谷2·年經官方卡圖核對為梟谷2年，學年標籤保留2與3；沒有把錯字當所屬標籤。',
             '- P02-064保留可選精確支付分支的情境覆核標記，禁止把只付一張當成完整付兩張。',
             '\n## 既有官方來源界線\n',
             'OPEN-EVENT-NO-CHANGE：沿用規則庫的完全無變化事件宣告待釐清點；本批不新增泛用允許結論。',
             '\n## 全體保護的生效對象\n',
             '- P04-070依使用者裁定為all／all_matches／continuous_matching，不限制登場來源；移除待裁定旗標，仍須完成保護節點與卡片測試才開放。',
             '\n## 本批已修正\n',
             '- PR-081數量改為動作層的allowed_counts=[1,2]／one_of_exact，從篩選條件移除錯置欄位。',
             '- 被動觸發中的names／covered_names與卡面身分使用相同正規化，避免空白及全形字元造成不匹配。',
             '\n## 執行狀態\n',
             '全卡資料是首次轉譯，尚未逐一在引擎重現判例。沒有缺失節點被默認成功，沒有把未完成機制改寫成單張卡的特製判定。']
(OUT/'BREAK-card-mapping-exceptions.md').write_text('\n'.join(exceptions)+'\n')
print(json.dumps({k:v for k,v in counts.items() if k!='program_node_counts'},ensure_ascii=False))
