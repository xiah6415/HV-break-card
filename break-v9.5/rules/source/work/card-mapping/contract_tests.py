"""Golden source expectations plus malformed-data and choice regressions."""
import copy
import hashlib
import json
from pathlib import Path
from schema import ContractError, SCHEMA, NODES, ref, validate, validate_semantics, validate_profile, validate_mapping, walk
from model import SEL, PROTECT, SINGLE, MULTIPLE, ALL_TARGETS
from contract_reference import ChoiceError, UnresolvedMembership, payment_choice, projected_steps, target_ids

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'outputs'
data = json.loads((OUT / 'BREAK-card-rule-mapping.json').read_text())
cards = {c['card_no']: c for c in data['cards']}
checks = []
def check(title, condition):
    if not condition: raise AssertionError(title)
    checks.append(dict(title=title, passed=True))
def expect_error(title, fn, error=ValueError):
    try: fn()
    except error: checks.append(dict(title=title, passed=True)); return
    raise AssertionError(title)
def profile(number): return cards['HV-' + number]['profiles'][0]
def find(number, kind): return next(n for _, n in walk(profile(number)['program']) if n.get('kind') == kind)
def changed(record, **values): return dict(copy.deepcopy(record), **values)
def validate_node(node): validate(node, ref('node')); validate_semantics(node)

counts = validate_mapping(data)
check('545個卡文資料組全量結構與語意欄位檢查', counts['profiles'] == 545)
check('產出規格與驗證器使用相同定義', json.loads((OUT/'BREAK-card-program-schema.json').read_text()) == SCHEMA)
check('所有已使用節點種類都有封閉欄位定義',
      {n['kind'] for c in data['cards'] for p in c['profiles'] for root in [p['program'], p['formal_cost']] for _, n in walk(root) if 'kind' in n} <= set(NODES))
payment = find('PR-081', 'move')
tail = find('PR-081', 'payment_branch')['then']
check('PR-081數量是動作層可選精確1或2張', payment['allowed_counts'] == [1, 2] and payment['count_mode'] == 'one_of_exact' and 'count' not in payment and 'allowed_counts' not in payment['pool']['filters'])
for chosen, expected in [(['e1'], [('numeric','chosen',2)]),
                          (['e1','e2'], [('numeric','chosen',2), ('numeric','attack',1), ('keyword','blockout',2)])]:
    paid = payment_choice(payment, ['e1','e2'], chosen)
    effects = projected_steps(tail, {'paid.count': paid['count']})
    actual = [(n['kind'], n.get('parameter', n.get('keyword')), n.get('value', n.get('N'))) for n in effects]
    check(f'QA1957支付{len(chosen)}張的後段效果', actual == expected)
check('可以拒絕整個可選支付分支', not payment_choice(payment, ['e1','e2'], None)['performed'])
check('只剩1張時仍可完整支付1張', payment_choice(payment, ['e1'], ['e1'])['count'] == 1)
for title, pool, chosen in [('付0張不當作完成', ['e1'], []), ('不能付3張', ['e1','e2','e3'], ['e1','e2','e3']),
                             ('不可重複支付同一實體', ['e1','e2'], ['e1','e1']), ('數量不足不能支付不存在的卡', ['e1'], ['e1','e2']),
                             ('不可支付篩選池之外的牌', ['e1','e2'], ['wrong'])]:
    expect_error(title, lambda p=pool,c=chosen: payment_choice(payment,p,c), ChoiceError)
pool, selection = ['e1','e2'], ['e1']
action_before = copy.deepcopy(payment)
result = payment_choice(payment,pool,selection)
result['ids'].append('detached_result')
check('付款參考判定不移動牌池或污染來源選擇／資料', pool==['e1','e2'] and selection==['e1'] and payment==action_before)

single = SINGLE(SEL())
multi = MULTIPLE(2)
all_scope = ALL_TARGETS('snapshot_on_resolution')
check('單體只能選一個實體', target_ids(single, ['a','b'], ['b']) == ['b'])
expect_error('單體不可偷選兩人', lambda: target_ids(single,['a','b'],['a','b']), ChoiceError)
expect_error('單體不可選不在場的實體', lambda: target_ids(single,['a'],['missing']), ChoiceError)
check('多人至多可選零人', target_ids(multi,['a','b'],[]) == [])
check('多人至多可選兩個不同實體', target_ids(multi,['a','b','c'],['a','c']) == ['a','c'])
expect_error('多人不可超過張數', lambda: target_ids(multi,['a','b','c'],['a','b','c']), ChoiceError)
expect_error('多人不可重複同一實體', lambda: target_ids(multi,['a','b'],['a','a']), ChoiceError)
expect_error('多人精確數量不可少選', lambda: target_ids(MULTIPLE(2,'exact'),['a','b'],['a']), ChoiceError)
check('全體自動涵蓋所有符合候選實體', target_ids(all_scope,['a','b','c']) == ['a','b','c'])
check('全體空集合沒有虛構對象', target_ids(all_scope,[]) == [])
expect_error('全體不接受改成玩家選一人', lambda: target_ids(all_scope,['a','b'],['a']), ChoiceError)
check('依存參照固定同一實體', target_ids(SINGLE('$target'),['a','b'],reference_id='b') == ['b'])
expect_error('固定參照不能換另一個對象', lambda: target_ids(SINGLE('$target'),['a','b'],['a'],reference_id='b'), ChoiceError)
protection = find('P04-070', 'protect_numeric_decrease')
check('P04-070明示全體而非玩家選一人', protection['target_scope']['mode'] == 'all' and protection['target_scope']['binding'] == 'all_matches')
check('P04-070使用者選A：持續匹配、期限本回合且不限制登場來源',
      protection['target_scope']['membership']=='continuous_matching' and protection['duration']=='this_turn'
      and protection['target']['actor']=='self' and protection['target']['zone']=='court'
      and protection['target']['filters']==dict(role='character',tags=['稲荷崎']))
expect_error('任何未定範圍仍停止判定',lambda:target_ids(ALL_TARGETS('unresolved'),['a','b']),UnresolvedMembership)
bad_protection=copy.deepcopy(profile('P04-070'))
next(n for _,n in walk(bad_protection['program']) if n.get('kind')=='protect_numeric_decrease')['target_scope']['membership']='unresolved'
bad_protection['flags']=['TARGET_MEMBERSHIP_UNRESOLVED'];bad_protection['runtime_approved']=True
expect_error('任何未定範圍仍不得核准runtime',lambda:validate_profile(bad_protection),ContractError)
expect_error('保護的選取池必須由作者明示對象範圍', lambda: PROTECT(SEL()), ValueError)

# Mutation regressions: these must fail, rather than getting ignored by a future reader.
old = json.loads((ROOT/'work/card-mapping/baseline-before-contract-v2/mapping.json').read_text())
old_profiles = {p['profile_id']:p for c in old['cards'] for p in c['profiles']}
META_FIELDS = {'node_id','shared_rule_ids','category_tags','classification_role','polarity','target_scope'}
def semantic_body(value):
    if isinstance(value,dict): return {k:semantic_body(v) for k,v in value.items() if k not in META_FIELDS}
    if isinstance(value,list): return [semantic_body(v) for v in value]
    return value
check('除已審查資料補正外，其餘卡片效果內容保持一致',all(
    semantic_body(p['program'])==semantic_body(old_profiles[p['profile_id']]['program'])
    for c in data['cards'] if c['card_no'] not in ['HV-P02-004','HV-PR-081','HV-P04-070','HV-P01-003','HV-P02-077','HV-P02-078','HV-P03-077','HV-P02-064','HV-P04-072'] for p in c['profiles']))
expected004=semantic_body(old_profiles[profile('P02-004')['profile_id']]['program'])
expected004['steps'][0]['then']['steps'][0]['actor']='opponent'
check('P02-004僅補對手選擇權，不改移牌／監聽效果',semantic_body(profile('P02-004')['program'])==expected004)
old003=semantic_body(old_profiles[profile('P01-003')['profile_id']]['program'])
expected003=copy.deepcopy(old003)
tail003=expected003['steps'][0]['then']['steps']
expected003['steps'][0]['then']['steps']=[dict(kind='optional',then=dict(kind='sequence',steps=tail003),bind='optional')]
check('P01-003僅新增完整後段可選分支，不改條件／數值／限制',semantic_body(profile('P01-003')['program'])==expected003)
check('所有來源版本與原始卡文指紋保持一致',all(
    p['variants']==old_profiles[p['profile_id']]['variants'] and p['source_skill_sha256']==old_profiles[p['profile_id']]['source_skill_sha256']
    for c in data['cards'] for p in c['profiles']))
old_payment = next(n for c in old['cards'] if c['card_no']=='HV-PR-081' for _,n in walk(c['profiles'][0]['program']) if n.get('kind')=='move')
expect_error('原始PR-081欄位錯置會被攔截', lambda: validate_node(old_payment), ContractError)
bad = copy.deepcopy(payment);bad['pool']['filters']['allowed_counts']=[1,2]
expect_error('篩選器拒絕錯置數量欄位', lambda: validate_node(bad), ContractError)
mutations = [
    ('拒絕未知動作欄位',changed(payment,cunt=2)),
    ('拒絕未知節點種類',changed(payment,kind='magic_move')),
    ('拒絕數量與可選數量同時存在',changed(payment,count=1)),
    ('拒絕數量集合為字串',changed(payment,allowed_counts=['1','2'])),
    ('拒絕布林值冒充整數',changed(payment,allowed_counts=[True,2])),
    ('拒絕重複數量選項',changed(payment,allowed_counts=[1,1])),
    ('拒絕負數數量',changed(payment,allowed_counts=[-1,2])),
    ('拒絕零張視為已付費',changed(payment,allowed_counts=[0,1])),
    ('拒絕未排序的數量分支',changed(payment,allowed_counts=[2,1])),
    ('拒絕缺失可選數量',{k:v for k,v in payment.items() if k!='allowed_counts'}),
    ('精確模式不可搭配選項集合',changed(payment,count_mode='exact')),
    ('拒絕未知數量模式',changed(payment,count_mode='sometimes')),
]
for title, mutation in mutations: expect_error(title, lambda n=mutation: validate_node(n), ContractError)
numeric = copy.deepcopy(find('P03-087','numeric'))
for title, mutation in [
    ('拒絕數值加值為文字',changed(numeric,value='2')),
    ('拒絕未知固定目標參照',changed(numeric,target='soruce',target_scope=SINGLE('soruce'))),
    ('拒絕單體選取卻綁為固定參照',changed(numeric,target_scope=SINGLE('$target'))),
    ('拒絕對象範圍欄位缺失',{k:v for k,v in numeric.items() if k!='target_scope'}),
    ('拒絕對象範圍未知模式',changed(numeric,target_scope={'mode':'guess','binding':'choose','membership':'snapshot_on_resolution'})),
    ('拒絕角色篩選器漏字',changed(numeric,target=changed(numeric['target'],filters={'tgas':['烏野']}))),
]: expect_error(title, lambda n=mutation: validate_node(n), ContractError)
guard = dict(kind='compare',field='paid.count',op='gte',value='2',checkpoint='when_condition_reached')
expect_error('數量比較不可使用字串常數', lambda: validate_node(guard), ContractError)
expect_error('全體不可附帶選一人數量', lambda: validate(dict(all_scope,count=1),ref('target_scope')), ContractError)
expect_error('多人模式不可使用一人數量', lambda: validate(MULTIPLE(1),ref('target_scope')), ContractError)
bad_activation = copy.deepcopy(profile('P01-028'))
bad_activation['activation']['trigger']['filters']['names'] = ['灰羽 リエーフ']
expect_error('被動觸發名稱格式不一致會被攔截', lambda: validate_profile(bad_activation), ContractError)
check('原被動觸發名稱確實含未正規化值', any(c['card_no']=='HV-P01-028' and c['profiles'][0]['activation']['trigger']['filters']['names']==['灰羽 リエーフ'] for c in old['cards']))
check('被動觸發名稱已統一為精確識別值', profile('P01-028')['activation']['trigger']['filters']['names']==['灰羽リエーフ'])
expect_error('技能不可缺少發動資料',lambda: validate_profile(changed(profile('PR-081'),activation=None)),ContractError)
bad_event = copy.deepcopy(profile('P03-087'));bad_event['activation']['trigger']={'event':'self_entry'}
expect_error('事件不可混入角色被動觸發',lambda: validate_profile(bad_event),ContractError)
bad_window = copy.deepcopy(profile('PR-081'));bad_window['activation']['window']='free_step_after_required_draw_and_entry_checks'
expect_error('被動技能不可錯用自由步驟窗口',lambda: validate_profile(bad_window),ContractError)
check('P04-084保持在共同條件內', len(profile('P04-084')['program']['steps']) == 1 and len(profile('P04-084')['program']['steps'][0]['then']['steps']) == 3)

result = dict(status='CONTRACT_AND_SCOPED_REFERENCE_CHECKS_NOT_GAME_SIMULATION',passed=len(checks),failed=0,
              structure_counts=counts,checks=checks,
              mapping_sha256=hashlib.sha256((OUT/'BREAK-card-rule-mapping.json').read_bytes()).hexdigest(),
              limitations=['Candidate ID pools are prefiltered; this suite does not implement every card filter',
                           'No state movement, trigger queue, expiry, undo or multiplayer integration',
                           'P04-070 continuous matching is user-defined; this contract does not prove runtime protection'])
(OUT/'BREAK-card-contract-validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(dict(passed=len(checks),failed=0,**counts)))
