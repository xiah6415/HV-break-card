"""Validate emitted data and independent source-based mapping expectations."""
import collections
import hashlib
import json
import re
import unicodedata
from pathlib import Path
from schema import validate_mapping

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'outputs'
DATA_PATH=OUT/'BREAK-card-rule-mapping.json'
data=json.loads(DATA_PATH.read_text())
source=json.loads((ROOT/'work/card-taxonomy/database.json').read_text())['cards']
shared=json.loads((OUT/'BREAK-shared-rules.json').read_text())
rules={r['id'] for r in shared['rules']}
cards={c['card_no']:c for c in data['cards']}
checks=[]
def check(title,ok,qa=None):
    assert ok,title
    checks.append(dict(title=title,passed=True,qa_id=qa))
def walk(value):
    if isinstance(value,dict):
        yield value
        for child in value.values():yield from walk(child)
    elif isinstance(value,list):
        for child in value:yield from walk(child)
def prof(n,i=0):return cards['HV-'+n]['profiles'][i]
def nodes(n,kind):return [x for x in walk(prof(n)['program']) if x.get('kind')==kind]
def key(s):return re.sub(r'\s+','',unicodedata.normalize('NFKC',s))

profiles=[p for c in cards.values() for p in c['profiles']]
variants=[v for p in profiles for v in p['variants']]
check('541卡號與來源集合完全一致',set(cards)=={c['card_no'] for c in source} and len(cards)==541)
check('713筆來源紀錄逐筆保留且ID不重複',len(variants)==713 and len({v['record_id'] for v in variants})==713 and {v['record_id'] for v in variants}=={c['id'] for c in source})
check('實際707個卡圖檔名與來源相符',len({v['image_file'] for v in variants})==707==len({c['image_file'] for c in source}))
check('362個技能卡文版本均有結構資料',sum(bool(p['program']) for p in profiles)==362)
check('183無技能卡不建立虛構技能',sum(p['program'] is None and p['activation'] is None and p['formal_cost'] is None for p in profiles)==183)
structure=validate_mapping(data)
check('545個資料組通過嚴格技能欄位與組合檢查',structure['profiles']==545 and structure['nodes']>0)
payment=nodes('PR-081','move')[0]
check('PR-081可選1／2張數量位於支付動作，未混入篩選',payment.get('allowed_counts')==[1,2] and payment['count_mode']=='one_of_exact' and 'allowed_counts' not in payment['pool']['filters'],'1957')
protection=nodes('P04-070','protect_numeric_decrease')[0]
check('P04-070全體保護範圍明示且成員界線未定時不能放行',protection['target_scope']=={'mode':'all','binding':'all_matches','membership':'unresolved'} and 'TARGET_MEMBERSHIP_UNRESOLVED' in prof('P04-070')['flags'] and not prof('P04-070')['runtime_approved'])
check('全部直接作用目標明示單體／多人／全體',all(n.get('target_scope',{}).get('mode') in ['single','multiple','all'] for p in profiles for n in walk(p['program']) if n.get('kind') in ['numeric','protect_numeric_decrease','parameter_absent','rename_before_entry']))
check('被動觸發的精確名稱與卡片識別統一',all(name==key(name) for p in profiles for n in walk(p['activation']) for k in ['names','exclude_names','covered_names'] for name in n.get(k,[])))
check('未將任何初稿標為引擎可執行',not any(p['runtime_approved'] or p['game_integrated'] for p in profiles))
check('全部共用規則引用存在',all(set(p['shared_rule_ids'])<=rules for p in profiles))
check('分段節點ID在各技能內唯一',all(len([n['node_id'] for n in walk(p['program']) if 'node_id'in n])==len({n['node_id'] for n in walk(p['program']) if 'node_id'in n}) for p in profiles))
check('全部來源卡文SHA吻合',all(hashlib.sha256(c['skill_jp'].encode()).hexdigest() in {p['source_skill_sha256'] for p in cards[c['card_no']]['profiles']} for c in source))
check('15張正式費用卡保留16個印刷卡文版本',len({c['card_no'] for c in cards.values() if any(p['formal_cost'] for p in c['profiles'])})==15 and sum(bool(p['formal_cost']) for p in profiles)==16)
check('費用節點未誤標為負面效果',all(n.get('polarity') is None for p in profiles for root in [p['program'],p['formal_cost']] for n in walk(root) if n.get('classification_role')=='payment'))
check('每段數值依存對象不存在時只略過該段',all(n.get('if_result_has_no_target')=='skip_this_step_only' for p in profiles for n in walk(p['program']) if n.get('kind')=='numeric' and n.get('target') in ['$target','$entered']))

# Independently inspect normalization using original printed stat values.
source_by_id={c['id']:c for c in source}
for field,short in [('serve','srv'),('block','blk'),('receive','rcv'),('toss','tos'),('attack','atk')]:
    check(f'全部角色版本的{field}原始參數保留零與橫線',all(v['printed']['parameters'][field]==('dash' if source_by_id[v['record_id']][short] in [None,'-','－','—'] else source_by_id[v['record_id']][short]) for v in variants if v['printed']['type']=='character'))
check('事件卡不建立虛構的橫線角色參數',all(v['printed']['parameters'] is None for v in variants if v['printed']['type']=='event'))
check('P03-001橫線參數不被轉成零',all(n=='dash' for n in prof('P03-001')['variants'][0]['printed']['parameters'].values()),'1741')
check('音駒中不再當成音駒',prof('P01-081')['variants'][0]['printed']['affiliation_tags']==['音駒中'],'1798')
check('白鳥沢中不再當成白鳥沢',set(prof('P03-015')['variants'][0]['printed']['affiliation_tags'])=={'白鳥沢中','疑似ユース'},'1817')
check('多重所屬卡保留高中與中學兩個精確標籤',prof('P03-088')['variants'][0]['printed']['affiliation_tags']==['音駒','音駒中'])
check('無所屬橫線不變成可匹配標籤',prof('P01-092')['variants'][0]['printed']['affiliation_tags']==[])
check('搜尋用海外分組不冒充印刷俱樂部所屬',prof('PR-001')['variants'][0]['printed']['affiliation_tags']==['Asas São Paulo'])
check('PR-013官方卡圖核對二年及三年',prof('PR-013')['variants'][0]['printed']['year_tags']==[2,3] and prof('PR-013')['variants'][0]['printed']['affiliation_tags']==['梟谷'])
check('PR-013修正保存官方圖檔指紋',prof('PR-013')['source_corrections'][0]['image_sha256']==hashlib.sha256((ROOT/'work/card-mapping/official-PR-013-P.webp').read_bytes()).hexdigest())
check('所有同名限次資料以有效名稱而非卡號追蹤',all(p['limit']['name_basis']=='effective_name' for p in profiles if p['limit']),'1746')

# Equal normalized source text must not be transcribed into different programs.
same_text=collections.defaultdict(list)
for c in source:
    if c['skill_jp'].strip() in ['','-']:continue
    fingerprint=key(c['skill_jp'])
    p=next(p for p in cards[c['card_no']]['profiles'] if p['source_skill_sha256']==hashlib.sha256(c['skill_jp'].encode()).hexdigest())
    same_text[fingerprint].append(json.dumps(p['program'],ensure_ascii=False,sort_keys=True))
check('相同卡文跨卡號引用同一效果結構',all(len(set(v))==1 for v in same_text.values()))
check('四個官方卡文差異保留各自版本',{c['card_no'] for c in cards.values() if c['skill_text_variant_conflict']}=={'HV-P02-077','HV-P02-078','HV-P03-077','HV-P04-072'})
check('P04-072角色卡與一般卡目標差異未合併',sorted('type' in p['program']['steps'][1]['pool']['filters'] for p in cards['HV-P04-072']['profiles'])==[False,True])
check('P02-077缺少期限文字的印刷不擅自補期限',{p['program']['steps'][0]['duration'] for p in cards['HV-P02-077']['profiles']}=={'this_turn_or_role_exit','unspecified_in_this_print'})
check('P02-035所屬校正有官方問答依據',prof('P02-035')['source_corrections'][0]['basis_qa']=='1299','1299')

class UnknownFact(Exception):pass
def value(facts,path):
    if path not in facts:raise UnknownFact(path)
    return facts[path]
def predicate(node,facts):
    kind=node['kind']
    if kind=='all':return all(predicate(c,facts) for c in node['conditions'])
    if kind=='any':return any(predicate(c,facts) for c in node['conditions'])
    if kind=='equal_fields':return len({value(facts,f) for f in node['fields']})==1
    if kind=='compare':
        actual=value(facts,node['field']); wanted=node['value'];op=node['op']
        if op=='eq':return actual==wanted
        if op=='gte':return actual>=wanted
        if op=='lte':return actual<=wanted
        if op=='in':return actual in wanted
        if op=='contains':return wanted in actual
        if op=='odd':return (actual%2==1)==wanted
        if op=='lt_field':return actual<value(facts,wanted)
    raise ValueError('Reference predicate deliberately does not execute '+kind)
def condition_result(node,facts):
    try:return predicate(node,facts)
    except UnknownFact:return 'REQUIRES_REVIEW'
def enabled_leaves(node,facts):
    if node['kind']=='sequence':return [v for s in node['steps'] for v in enabled_leaves(s,facts)]
    if node['kind']=='conditional':
        test=condition_result(node['condition'],facts)
        if test=='REQUIRES_REVIEW':raise UnknownFact('unavailable guard')
        return enabled_leaves(node['then'],facts) if test else []
    # This projection reports enabled action records; it does not mutate a game state.
    return [node]

for ball,offense,expected in [('serve',2,[('draw',1)]),('serve',6,[('receive',2)]),('serve',9,[('receive',2)]),('serve',5,[]),('attack',6,[]),('block',6,[]),('attack',2,[])]:
    leaves=enabled_leaves(prof('P03-046')['program'],{'opponent_ball.kind':ball,'opponent_ball.offense':offense})
    actual=[('draw',n['count']) if n['kind']=='draw' else (n['parameter'],n['value']) for n in leaves]
    check(f'赤木：{ball}／{offense}的分段效果',actual==expected)
check('赤木缺少球種時回待釐清，不推定發球',condition_result(prof('P03-046')['program']['steps'][1]['condition'],{'opponent_ball.offense':6})=='REQUIRES_REVIEW')

check('抽牌階段事件可另套對練窗口，官方階段不改',prof('P01-076')['activation']['activation_phases']==['draw'] and prof('P01-076')['practice_override']['extra_window']=='before_receive_judgment','12')
check('抽牌階段手牌主動技能不自動取得事件延伸窗口',prof('P03-057')['activation']['activation_phases']==['draw'] and prof('P03-057')['practice_override'] is None)
check('登場區域不是使用階段門檻',prof('P01-002')['activation']['activation_phases']==[] and prof('P01-002')['activation']['trigger']['destination_any']==['attack'])
check('手牌主動技能宣告須公開來源卡',prof('PR-082')['activation']['reveal_source_on_declaration'] is True,'1958')
check('來源被覆蓋的技能讀覆蓋前角色資訊',prof('P01-023')['activation']['trigger']['source_role_checkpoint']=='before_coverage','1144')

check('P01-035只禁止技能加牌',nodes('P01-035','ban_action')[0]['scope']['origins']==['skill'],'1158')
ban=nodes('P04-087','ban_action')[0]
check('P04-087抽牌階段禁止含規則及技能',ban['scope']=={'origins':['rule','skill'],'phases':['draw']},'1933')
check('P03-063封鎖事件技能，沒有偷改成禁止放卡',len(nodes('P03-063','invalidate_skill'))==1 and len(nodes('P03-063','ban_action'))==0,'1814')
check('P01-006翻牌失敗不取消獨立日向監聽',prof('P01-006')['program']['steps'][0]['then']['steps'][0]['kind']=='deck_selection' and prof('P01-006')['program']['steps'][0]['then']['steps'][1]['kind']=='watch','1123')
check('P03-087可選任一角色攻擊加一',nodes('P03-087','numeric')[0]['target']['filters']=={'role':'character'},'1836')
check('P03-087六Guts從全場合計支付',nodes('P03-087','pay_guts')[0]['areas']=='court' and nodes('P03-087','pay_guts')[0]['count']==6)
check('P03-087後段仍是原角色任一參數加二',nodes('P03-087','numeric')[1]['parameter']=='chosen' and nodes('P03-087','numeric')[1]['target']=='$target')
check('P03-096日向可選任一參數而非固定當前階段',nodes('P03-096','numeric')[0]['parameter']=='chosen' and nodes('P03-096','numeric')[0]['target']['filters']['names']==['日向翔陽'])
check('P02-087兩角色登場成組且先完成原技能',len(nodes('P02-087','simultaneous_entry_group')[0]['entries'])==2 and nodes('P02-087','simultaneous_entry_group')[0]['complete_group_before_triggers'],'1368')
check('P02-041正式費用與送棄牌分段分離',prof('P02-041')['formal_cost'] is not None and prof('P02-041')['program']['steps'][0]['kind']=='mill','1312')
check('P02-066前段送三張與兩Guts是完整效果支付',len(nodes('P02-066','payment_branch')[0]['payment']['steps'])==2 and prof('P02-066')['formal_cost'] is None,'1335')
check('P04-100雙方各選抽兩張或不抽，之後才禁自己加牌',[n['kind'] for n in prof('P04-100')['program']['steps']]==['each_player_optional_draw','ban_action'] and prof('P04-100')['program']['steps'][0]['count_mode']=='exact_or_zero','1948')
check('P03-083交換保留雙向完整性要求',nodes('P03-083','exchange')[0]['requires_both'] and nodes('P03-083','exchange')[0]['atomic_movement'],'1828')
check('P04-064交換仍受加入手牌權限控制','move.exchange' in nodes('P04-064','exchange')[0]['shared_rule_ids'],'1908')
check('P04-088技能限次不壓縮未來監聽次數',prof('P04-088')['limit'] is not None and nodes('P04-088','watch')[0]['remaining_uses'] is None,'1934')
check('P02-082一次監聽按效果實例計次',nodes('P02-082','watch')[0]['remaining_uses']==1,'1359')
check('P03-028放上方不被編成明示登場',len(nodes('P03-028','enter'))==0 and len(nodes('P03-028','enter_self'))==0 and 'entry.placement_not_entry' in nodes('P03-028','cover_source_with_guts')[0]['shared_rule_ids'])
check('P03-047技能自己加值上限保留共用機制待補旗標','SHARED_MECHANISM_EXTENSION_NEEDS_CONFIRMATION' in prof('P03-047')['flags'] and nodes('P03-047','numeric')[0]['proposed_shared_rule_id']=='PROPOSED-NUMERIC-SOURCE-CAP')

def match_filters(card,filters):
    role=card.get('role')
    role_groups=data['selector_contract']['role_groups']
    for k,v in filters.items():
        if k=='role':
            if role not in role_groups.get(v,[v]):return False
        elif k=='tags' and not set(v)<=set(card['tags']):return False
        elif k=='tags_any' and not set(v)&set(card['tags']):return False
        elif k=='position_has_any_other_than' and not set(card['positions'])-set(v):return False
        elif k=='entry_origins':
            if card.get('entry_origin') not in v:return False
        elif k not in ['role','tags','tags_any','position_has_any_other_than']:
            raise ValueError('Unsupported reference filter: '+k)
    return True
trigger=prof('P04-011')['activation']['trigger']['filters']
check('雙位置Li+WS可符合Li以外的烏野攻擊角色',match_filters(dict(role='attack',tags=['烏野'],positions=['Li','WS'],entry_origin='hand'),trigger),'1862')
check('只有Li的位置不符合該觸發',not match_filters(dict(role='attack',tags=['烏野'],positions=['Li'],entry_origin='hand'),trigger),'1862')
check('該雙位置觸發仍須手牌來源',not match_filters(dict(role='attack',tags=['烏野'],positions=['Li','WS'],entry_origin='drop'),trigger),'1862')
check('任一角色選取涵蓋側攔',match_filters(dict(role='side_blocker',tags=[],positions=[]),{'role':'character'}))

def uniform(chars,options):return bool(chars) and any(all(tag in c for c in chars) for tag in options)
options=nodes('P03-087','uniform_affiliation')[0]['options']
check('全隊共同烏野或共同Youth：混隊不成立',not uniform([['烏野'],['ユース']],options),'1834')
check('全隊共同烏野：多所屬仍成立',uniform([['烏野','ユース'],['烏野']],options),'1834')
check('全隊條件不以空集合成立',not uniform([],options),'1834')
check('P03-087所屬以精確Youth而非疑似Youth',not uniform([['疑似ユース']],options),'1835')
check('P01-092空翻牌不因沒有重複所屬反而獲額外加值',not predicate(prof('P01-092')['program']['steps'][3]['condition'],{'revealed.count':0,'revealed.affiliation_intersects_self_court':False}))
check('P01-092翻到不同所屬才加值',predicate(prof('P01-092')['program']['steps'][3]['condition'],{'revealed.count':1,'revealed.affiliation_intersects_self_court':False}))
check('P01-093空翻牌不獲限制對手打牌效果',not predicate(prof('P01-093')['program']['steps'][2]['condition'],{'revealed.count':0,'revealed.affiliation_intersects_self_court':False}))

result=dict(status='DATA_MAPPING_CHECKS_NOT_FULL_GAME_SIMULATION',passed=len(checks),failed=0,
            cards=541,skill_profiles=362,source_records=713,checks=checks,
            limitations=['Program structure and selected independent source expectations checked; not all full card scenarios executed',
                         'All skill profiles remain runtime_approved=false; new numeric source-cap mechanism remains pending'])
(OUT/'BREAK-card-mapping-validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
data['validation']=dict(artifact='BREAK-card-mapping-validation.json',checks=len(checks),failed=0,
                        scope='data integrity, source expectations, selected condition projections; no game engine integration')
DATA_PATH.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
md=[f'''# BREAK 全卡映射驗證結果

日期：2026-10-20。**{len(checks)}項資料完整性、來源情境與條件邊界檢查通過。**

驗證的是產出資料、規則引用、關鍵參數與部分條件投影，沒有把整份技能資料接入遊戲，也未自動重現全卡完整效果。所有技能仍保留runtime_approved=false。

| 檢查 | 官方QA（如適用） | 結果 |
|---|---|---|''']
for c in checks:md.append(f"| {c['title']} | {c['qa_id'] or '資料／來源／總合規則'} | 通過 |")
md+=['\n## 仍未完成的驗證\n',
     '- 全部技能在完整引擎局面中的執行、公開資訊、玩家選擇及Undo還原。',
     '- P03-047只限制本技能加值的共用上限機制；四個印刷差異與事件完全無變化的宣告界線。',
     '- P04-070全體保護的固定當下／持續匹配成員界線；未定時拒絕runtime核准。',
     '- 詳見[資料規格補正與反例驗證](BREAK-card-contract-update.md)，獨立契約情境不等於完整引擎測試。',
     '- 本批僅整理資料與參考檢查，沒有遊戲建置、部署或Safari真機測試。',
     '\n[全卡映射索引](BREAK-card-rule-mapping.md) · [結構資料](BREAK-card-rule-mapping.json) · [異常清單](BREAK-card-mapping-exceptions.md)']
(OUT/'BREAK-card-mapping-validation.md').write_text('\n'.join(md)+'\n')
print(json.dumps(dict(passed=len(checks),failed=0),ensure_ascii=False))
