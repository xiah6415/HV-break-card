"""Independent reference checks of shared contracts, never imported by the game."""
import collections
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'outputs'
data = json.loads((OUT / 'BREAK-shared-rules.json').read_text())
known_rules = {r['id'] for r in data['rules']}
known_qa = {r['qa_id'] for r in data['qa_rule_map']}
policies = []
cases = []

def policy(key, stage, title, refs, inputs, contract):
    assert set(refs.split(',')) <= known_rules
    policies.append(dict(id=key, stage=stage, title=title, shared_rule_ids=refs.split(','),
                         required_inputs=inputs.split(','), contract=contract,
                         implementation='work/shared-rules/verify.py:evaluate',
                         status='REFERENCE_ONLY_NOT_GAME_INTEGRATED'))

def case(key, title, qa, facts, expected):
    refs = list(filter(None, str(qa).split(',')))
    assert set(refs) <= known_qa
    cases.append(dict(id=f'{key}-{sum(c["policy"] == key for c in cases)+1:02}',
                      policy=key, title=title, qa_ids=refs, facts=facts, expected=expected))

def result(verdict, **kwargs):
    return dict(verdict=verdict, **kwargs)

class MissingInput(Exception):
    pass

def field(facts, key):
    if key not in facts:
        raise MissingInput(key)
    return facts[key]

def scope_match(f):
    restriction = field(f, 'restriction')
    if field(restriction, 'active') is not True:
        return False
    for k, allowed in field(restriction, 'scope').items():
        actual = field(f, k)
        if k.endswith('_tags'):
            if not set(allowed) <= set(actual):
                return False
        elif actual not in allowed:
            return False
    return True

def evaluate(key, f):
    """Return only this gate's answer. NO_DECISION never means globally legal."""
    try:
        if key == 'P01':
            if field(f, 'operation') not in ['draw', 'add_hand']:
                return result('NO_DECISION')
            return result('DENY_STEP' if scope_match(f) else 'NO_DECISION')
        if key == 'P02':
            if field(f, 'operation') != 'play_event':
                return result('NO_DECISION')
            allowed = set(field(f, 'allowed_phases')) | set(field(f, 'profile_extra_phases'))
            return result('PHASE_VALID' if field(f, 'phase') in allowed else 'DENY_PLAY')
        if key == 'P03':
            if field(f, 'operation') != 'use_skill':
                return result('NO_DECISION')
            return result('DENY_SKILL' if scope_match(f) else 'NO_DECISION')
        if key == 'P04':
            if field(f, 'operation') != 'modify_numeric' or field(f, 'delta') >= 0:
                return result('NO_DECISION')
            return result('SKIP_STEP' if scope_match(f) else 'NO_DECISION')
        if key == 'P05':
            paid = field(f, 'paid_cards')
            if len(set(paid)) != len(paid):
                return result('DENY_DECLARATION')
            met = len(paid) == field(f, 'required_count') and field(f, 'paid_for') == field(f, 'declared_skill')
            return result('COST_VALID' if met else 'DENY_DECLARATION')
        if key == 'P06':
            val = field(f, 'parameter')
            if val == 'dash':
                return result('DENY_ENTRY')
            if isinstance(val, bool) or not isinstance(val, int):
                return result('REQUIRES_REVIEW')
            return result('PARAMETER_VALID')
        if key == 'P07':
            match = field(f, 'entry_origin') in field(f, 'required_origins')
            return result('ORIGIN_VALID' if match else 'NOT_TRIGGERED')
        if key == 'P08':
            used = field(f, 'locks')
            current = [field(f, 'player'), field(f, 'name'), field(f, 'turn')]
            return result('DENY_SKILL' if current in used else 'NO_DECISION')
        if key == 'P09':
            n, chosen, available = field(f, 'requested'), field(f, 'chosen'), field(f, 'available')
            if chosen not in [0, n]:
                return result('INVALID_CHOICE')
            return result('RESOLVE_COUNT', count=min(chosen, available))
        if key == 'P10':
            chosen = field(f, 'chosen')
            good = isinstance(chosen, int) and not isinstance(chosen, bool) and 0 <= chosen <= min(field(f, 'maximum'), field(f, 'available'))
            return result('CHOICE_VALID' if good else 'INVALID_CHOICE')
        if key == 'P11':
            ready = field(f, 'selected_count') == field(f, 'required_targets') and all(field(f, 'direction_permissions'))
            if len(field(f, 'direction_permissions')) != field(f, 'required_targets'):
                return result('REQUIRES_REVIEW')
            return result('EXCHANGE_VALID' if ready else 'DENY_EXCHANGE')
        if key == 'P12':
            chars = [c for c in field(f, 'cards') if field(c, 'role') == 'character']
            options = field(f, 'affiliation_options')
            matched = bool(chars) and any(all(tag in field(c, 'tags') for c in chars) for tag in options)
            return result('CONDITION_TRUE' if matched else 'CONDITION_FALSE')
        if key == 'P13':
            names = {field(c, 'name') for c in field(f, 'cards') if field(c, 'type') == 'character' and field(f, 'required_tag') in field(c, 'tags')}
            return result('COUNT', count=len(names))
        if key == 'P14':
            return result('TAG_MATCH' if field(f, 'required_tag') in field(f, 'tags') else 'TAG_MISMATCH')
        if key == 'P15':
            reason = field(f, 'reason')
            if reason not in ['normal_entry', 'skill_entry']:
                return result('NOT_TRIGGERED')
            return result('TRIGGERED' if field(f, 'origin') in field(f, 'required_origins') else 'NOT_TRIGGERED')
        if key == 'P16':
            if field(f, 'resolving_current_skill'):
                return result('CONTINUE_CURRENT_SKILL')
            match = field(f, 'pending_phase') == field(f, 'skipped_phase')
            return result('CANCEL_PENDING' if match else 'KEEP_PENDING')
        if key == 'P17':
            event, trigger = field(f, 'event'), field(f, 'trigger')
            if event == 'loss' and trigger == 'turn_end':
                return result('NOT_TRIGGERED')
            if event == 'loss' and trigger == 'loss':
                return result('SCHEDULE', checkpoint='after_loss_before_interval')
            return result('TRIGGERED' if event == trigger else 'NOT_TRIGGERED')
        if key == 'P18':
            checkpoint = field(f, 'checkpoint')
            if field(f, 'duration') != 'this_turn':
                return result('REQUIRES_REVIEW')
            return result('EXPIRE' if checkpoint in ['turn_cleanup', 'before_interval'] else 'KEEP')
        if key == 'P19':
            n = field(f, 'base')
            for e in field(f, 'effects'):
                if field(e, 'type') != 'nonpermanent':
                    return result('REQUIRES_REVIEW')
                if field(e, 'op') == 'set':
                    n = field(e, 'value')
                elif e['op'] == 'add':
                    n += field(e, 'value')
                else:
                    return result('REQUIRES_REVIEW')
            return result('VALUE', value=n)
        if key == 'P20':
            if not field(f, 'entered_judgment'):
                return result('NO_JUDGMENT')
            return result('SUCCESS' if field(f, 'defense') >= field(f, 'offense') else 'FAILURE')
        if key == 'P21':
            values = field(f, 'matched_results')
            return result('CONDITION_TRUE' if values and all(v is True for v in values) else 'CONDITION_FALSE')
        if key == 'P22':
            if field(f, 'target_instance') != field(f, 'active_instance'):
                return result('NO_DECISION')
            return result('VALUE', value=field(f, 'base')+field(f, 'delta'))
        if key == 'P23':
            if not field(f, 'watcher_active'):
                return result('COUNT', count=0)
            matches = sum(e['origin'] in field(f, 'origins') for e in field(f, 'events'))
            limit = field(f, 'watcher_remaining')
            return result('COUNT', count=matches if limit is None else min(matches, limit))
        if key == 'P24':
            return result('DENY_ACTION' if scope_match(f) else 'NO_DECISION')
        if key == 'P25':
            if not field(f, 'immunity_active'):
                return result('NO_DECISION')
            direct = field(f, 'effect_target') == field(f, 'immune_target')
            return result('SKIP_DIRECT_EFFECT' if direct else 'NO_DECISION')
        if key == 'P26':
            if not field(f, 'opt_in'):
                return result('SKIP_BRANCH')
            complete = all(field(step, 'actual') == field(step, 'required') for step in field(f, 'payment_steps'))
            if not field(f, 'payment_steps'):
                return result('REQUIRES_REVIEW')
            return result('EXECUTE_DEPENDENT_STEPS' if complete else 'SKIP_BRANCH')
        raise ValueError(key)
    except MissingInput as e:
        return result('REQUIRES_REVIEW', missing=str(e))

# Expected outcomes below are independent golden scenarios from the cited sources,
# plus explicit counterexamples that test the boundary of each shared contract.
policy('P01','分段執行','加手牌禁止的範圍','permission.deny,hand.draw_subset,hand.restriction','operation,actor,origin,phase,restriction','命中範圍才禁止該段；來源與階段不符不處理')
ban = dict(active=True,scope=dict(actor=['opponent'],origin=['rule','skill'],phase=['draw']))
base = dict(operation='draw',actor='opponent',origin='rule',phase='draw',restriction=ban)
case('P01','抽牌階段規則抽牌亦被禁止','1933',base,result('DENY_STEP'))
case('P01','抽牌階段技能回收亦被禁止','1933',dict(base,operation='add_hand',origin='skill'),result('DENY_STEP'))
case('P01','限制只在抽牌階段，不擋接球階段','1933',dict(base,phase='receive'),result('NO_DECISION'))
case('P01','限制對手，不擋自己','1933',dict(base,actor='self'),result('NO_DECISION'))
case('P01','只禁技能加牌時不擋規則抽牌','1158',dict(base,restriction=dict(active=True,scope=dict(actor=['opponent'],origin=['skill']))),result('NO_DECISION'))
case('P01','到期的限制不生效','1933',dict(base,restriction=dict(active=False,scope=ban['scope'])),result('NO_DECISION'))
case('P01','缺少來源資料不能推定允許','1933',{k:v for k,v in base.items() if k != 'origin'},result('REQUIRES_REVIEW',missing='origin'))

policy('P02','打出卡','正常事件階段與對練覆寫','event.phase,event.place_not_play','operation,phase,allowed_phases,profile_extra_phases','只檢查正常打出；效果放置分流；覆寫有明確設定')
base = dict(operation='play_event',phase='receive',allowed_phases=['attack'],profile_extra_phases=[])
case('P02','攻擊事件不能正常在接球打出','12',base,result('DENY_PLAY'))
case('P02','正確攻擊階段通過此門檻','12',dict(base,phase='attack'),result('PHASE_VALID'))
case('P02','技能放置不是正常打出','1178,1372',dict(base,operation='place_event_by_skill'),result('NO_DECISION'))
case('P02','對練設定允許抽牌事件接球前使用','',dict(base,allowed_phases=['draw'],profile_extra_phases=['receive']),result('PHASE_VALID'))

policy('P03','使用技能','無效化按技能標籤交集','permission.layers,skill.selector,skill.invalidate','operation,skill_tags,restriction','技能階段與來源標籤全命中才封鎖，打出卡另判')
base = dict(operation='use_skill',skill_tags=['receive','hand'],restriction=dict(active=True,scope=dict(skill_tags=['receive','hand'])))
case('P03','接球加手牌來源技能被封鎖','1274,1875',base,result('DENY_SKILL'))
case('P03','場上登場技能不命中手牌來源','1274',dict(base,skill_tags=['receive','entry']),result('NO_DECISION'))
case('P03','技能封鎖本身不當成放卡禁止','1814',dict(base,operation='play_event'),result('NO_DECISION'))

policy('P04','分段執行','減值保護只阻擋命中段落','numeric.protection,keyword.one_touch','operation,delta,target,numeric_domain,restriction','目標及數值域精準匹配；階段移行段不被連帶取消')
base = dict(operation='modify_numeric',delta=-2,target='ball-1',numeric_domain='offense',restriction=dict(active=True,scope=dict(target=['ball-1'],numeric_domain=['offense'])))
case('P04','受保護的球進攻值不減','1437',base,result('SKIP_STEP'))
case('P04','同技能下一段移行仍繼續','1437',dict(base,operation='phase_jump'),result('NO_DECISION'))
case('P04','球總值保護不擋角色攻擊參數減值','1779',dict(base,target='character-1',numeric_domain='attack_parameter'),result('NO_DECISION'))
case('P04','側攔自己的保護不保護中攔','1815',dict(base,target='center-1',numeric_domain='block_parameter',restriction=dict(active=True,scope=dict(target=['side-1'],numeric_domain=['block_parameter']))),result('NO_DECISION'))
case('P04','減值保護不阻擋加值','1437',dict(base,delta=1),result('NO_DECISION'))

policy('P05','宣告費用','費用完整且屬於該次技能','cost.declaration','paid_cards,required_count,paid_for,declared_skill','不足、重複卡或其他技能已付的牌不當成已付款')
base = dict(paid_cards=['cost-card-1'],required_count=1,paid_for='declared',declared_skill='declared')
case('P05','為本技能付完整費用','1130',base,result('COST_VALID'))
case('P05','其他技能棄牌不能替付','1152',dict(base,paid_for='other'),result('DENY_DECLARATION'))
case('P05','不足指定量不能宣告','1130',dict(base,required_count=2),result('DENY_DECLARATION'))
case('P05','同張牌不能重複計作兩份費用','1130',dict(base,paid_cards=['x','x'],required_count=2),result('DENY_DECLARATION'))

policy('P06','登場門檻','數字零與橫線分離','entry.parameter,numeric.negative','parameter','橫線無該參數；零與負數是數字')
case('P06','數字零可通過參數門檻','7',dict(parameter=0),result('PARAMETER_VALID'))
case('P06','橫線不能登場對應區','8,1741',dict(parameter='dash'),result('DENY_ENTRY'))
case('P06','負數不冒充橫線','9',dict(parameter=-1),result('PARAMETER_VALID'))

policy('P07','觸發條件','登場來源匹配','entry.origin','entry_origin,required_origins','要求手牌來源的觸發不接受棄牌或Guts來源')
base = dict(entry_origin='hand',required_origins=['hand'])
case('P07','手牌登場命中','1119',base,result('ORIGIN_VALID'))
case('P07','棄牌登場不冒用手牌','1119,1854',dict(base,entry_origin='drop'),result('NOT_TRIGGERED'))
case('P07','Guts登場不吃只限手牌的減值','1855',dict(base,entry_origin='guts'),result('NOT_TRIGGERED'))

policy('P08','使用技能','同名限次跨卡號','limit.same_name','locks,player,name,turn','玩家、名稱、回合相同才封鎖，卡號不參與鍵值')
base = dict(locks=[['P1','日向翔陽',7]],player='P1',name='日向翔陽',turn=7,card_no='another-number')
case('P08','另一卡號同名技能仍被封鎖','1746',base,result('DENY_SKILL'))
case('P08','不同名稱不命中','1746',dict(base,name='影山飛雄'),result('NO_DECISION'))
case('P08','不同玩家不命中','1746',dict(base,player='P2'),result('NO_DECISION'))
case('P08','下一回合不命中','1746',dict(base,turn=8),result('NO_DECISION'))

policy('P09','玩家選擇','可抽精確N或不抽','selection.optional_exact,resource.shortfall','requested,chosen,available','選0或N；選N後不足則盡可能執行')
case('P09','抽兩張或不抽不能選一張','1949,1954',dict(requested=2,chosen=1,available=5),result('INVALID_CHOICE'))
case('P09','可以選不抽','1949',dict(requested=2,chosen=0,available=5),result('RESOLVE_COUNT',count=0))
case('P09','選抽兩張但牌庫僅一張仍抽一張','1950,1955',dict(requested=2,chosen=2,available=1),result('RESOLVE_COUNT',count=1))
case('P09','兩張俱足就抽兩張','1949',dict(requested=2,chosen=2,available=5),result('RESOLVE_COUNT',count=2))

policy('P10','玩家選擇','最多N張','selection.upto','chosen,maximum,available','實際選0至可用上限，與精確N或不做分離')
case('P10','最多兩張可選一張','37',dict(chosen=1,maximum=2,available=5),result('CHOICE_VALID'))
case('P10','最多兩張可選零','37',dict(chosen=0,maximum=2,available=5),result('CHOICE_VALID'))
case('P10','不可超過上限','37',dict(chosen=3,maximum=2,available=5),result('INVALID_CHOICE'))
case('P10','不可選不存在的第二張','37',dict(chosen=2,maximum=2,available=1),result('INVALID_CHOICE'))

policy('P11','分段執行','交換須兩向完整合法','move.exchange','selected_count,required_targets,direction_permissions','缺目標或任一移動方向受阻則整個交換失敗；不取消技能其他獨立段')
case('P11','完整合法交換','1828',dict(selected_count=2,required_targets=2,direction_permissions=[True,True]),result('EXCHANGE_VALID'))
case('P11','缺一方不可單向放牌','1828,1906',dict(selected_count=1,required_targets=2,direction_permissions=[True,True]),result('DENY_EXCHANGE'))
case('P11','加入手牌方向被禁則不交換','1908',dict(selected_count=2,required_targets=2,direction_permissions=[True,False]),result('DENY_EXCHANGE'))

policy('P12','條件','全體A或全體B','condition.uniform,condition.uniform_or','cards,affiliation_options','只看角色；至少一人；全體須共同持有其中一個所屬')
def char(tags, role='character'): return dict(role=role,tags=tags)
case('P12','全烏野含雙所屬可成立','1834',dict(cards=[char(['烏野']),char(['烏野','ユース'])],affiliation_options=['烏野','ユース']),result('CONDITION_TRUE'))
case('P12','各自一種所屬的混隊不成立','1834',dict(cards=[char(['烏野']),char(['ユース'])],affiliation_options=['烏野','ユース']),result('CONDITION_FALSE'))
case('P12','空場不以空集合成立','1834',dict(cards=[],affiliation_options=['烏野']),result('CONDITION_FALSE'))
case('P12','Guts不參與全隊所屬','1321',dict(cards=[char(['烏野']),char(['音駒'],'guts')],affiliation_options=['烏野']),result('CONDITION_TRUE'))

policy('P13','條件計數','名稱種類與卡型','count.distinct_names,identity.name_scope','cards,required_tag','先篩角色卡與所屬，再以當區名稱去重；不拆雙人卡名')
base = dict(cards=[dict(name='宮侑',type='character',tags=['稲荷崎']),dict(name='宮侑',type='character',tags=['稲荷崎']),dict(name='宮兄弟',type='character',tags=['稲荷崎']),dict(name='黒須法宗',type='event',tags=['稲荷崎'])],required_tag='稲荷崎')
case('P13','重複角色與教練事件不增加種類','1276,1277',base,result('COUNT',count=2))
case('P13','換卡號仍同名不增加種類','1858',dict(cards=[dict(name='月島・山口',type='character',tags=['烏野'])]*3,required_tag='烏野'),result('COUNT',count=1))

policy('P14','對象條件','所屬精確標籤','identity.exact_tags','required_tag,tags','不使用子字串匹配')
case('P14','疑似Youth不等於Youth','1835',dict(required_tag='ユース',tags=['疑似ユース']),result('TAG_MISMATCH'))
case('P14','多所屬包含精確Youth則成立','1835',dict(required_tag='ユース',tags=['ユース','烏野']),result('TAG_MATCH'))
case('P14','音駒中不當成音駒','1798',dict(required_tag='音駒',tags=['音駒中']),result('TAG_MISMATCH'))

policy('P15','觸發','新登場與自然露出','trigger.entry,zone.exposed_not_entry','reason,origin,required_origins','明示登場才產生登場事件，底牌自然露出不產生')
base = dict(reason='skill_entry',origin='guts',required_origins=['hand','guts','drop'])
case('P15','技能讓Guts登場會觸發','34,1147',base,result('TRIGGERED'))
case('P15','頂牌移除自然露出不觸發','1925',dict(base,reason='exposed'),result('NOT_TRIGGERED'))
case('P15','自然露出不吃登場減值','1926',dict(base,reason='exposed'),result('NOT_TRIGGERED'))
case('P15','自然露出不吃A通','1927',dict(base,reason='exposed'),result('NOT_TRIGGERED'))

policy('P16','觸發排程','跳階段與當前技能後段','trigger.skipped_window,flow.current_skill_after_skip','resolving_current_skill,pending_phase,skipped_phase','取消被跳過窗口的待處理技能；當前正在解決技能的後段繼續')
base = dict(resolving_current_skill=False,pending_phase='block',skipped_phase='block')
case('P16','一觸移行後待處理Blockout消失','1195,1752',base,result('CANCEL_PENDING'))
case('P16','其他未被跳過窗口不受此規則取消','1162',dict(base,pending_phase='end'),result('KEEP_PENDING'))
case('P16','當前技能移行後的後段繼續','',dict(base,resolving_current_skill=True),result('CONTINUE_CURRENT_SKILL'))

policy('P17','流程觸發','Loss不是一般結束事件','loss.not_turn_end,loss.before_interval','event,trigger','Loss不滿足一般結束觸發；Loss觸發排在間隔前')
case('P17','Loss不觸發回合結束','22',dict(event='loss',trigger='turn_end'),result('NOT_TRIGGERED'))
case('P17','Loss觸發於間隔前處理','23,1921',dict(event='loss',trigger='loss'),result('SCHEDULE',checkpoint='after_loss_before_interval'))
case('P17','一般回合結束正常觸發','22',dict(event='turn_end',trigger='turn_end'),result('TRIGGERED'))

policy('P18','到期','本回合效果的清理點','loss.cleanup,duration.same_turn','checkpoint,duration','跳到抽牌及Loss後尚未間隔時保留，清理點才到期')
case('P18','同回合移行抽牌不清除','1161',dict(checkpoint='phase_jump',duration='this_turn'),result('KEEP'))
case('P18','Loss後、間隔前效果仍在','24',dict(checkpoint='after_loss',duration='this_turn'),result('KEEP'))
case('P18','間隔前清理時到期','24',dict(checkpoint='before_interval',duration='this_turn'),result('EXPIRE'))
case('P18','一般回合清理到期','32',dict(checkpoint='turn_cleanup',duration='this_turn'),result('EXPIRE'))

policy('P19','數值','非永久數值按解決順序','numeric.fixed_order,keyword.back_attack','base,effects','僅處理已排序的非永久加減與設值；永久固定另規則')
def effect(op, value): return dict(op=op,value=value,type='nonpermanent')
case('P19','先加1再BackAttack設4不保留原加值','1778',dict(base=1,effects=[effect('add',1),effect('set',4)]),result('VALUE',value=4))
case('P19','技能先設4後登場觸發減2','1874',dict(base=3,effects=[effect('set',4),effect('add',-2)]),result('VALUE',value=2))
case('P19','先減值後事件重設原值','1944',dict(base=5,effects=[effect('add',-2),effect('set',5)]),result('VALUE',value=5))
case('P19','重設原值後仍可加1','1358',dict(base=2,effects=[effect('set',5),effect('add',1)]),result('VALUE',value=6))
case('P19','永久固定值不能混入此簡化運算','',dict(base=2,effects=[dict(op='set',value=3,type='permanent')]),result('REQUIRES_REVIEW'))

policy('P20','成功判定','比較必須在判定步驟','judge.compare,judge.checkpoint','entered_judgment,defense,offense','大於等於成功；未進判定不當成失敗')
case('P20','零對零成功','19',dict(entered_judgment=True,defense=0,offense=0),result('SUCCESS'))
case('P20','負一防禦對零進攻失敗','1222',dict(entered_judgment=True,defense=-1,offense=0),result('FAILURE'))
case('P20','一觸先移行不視為攔網失敗','1311',dict(entered_judgment=False,defense=0,offense=5),result('NO_JUDGMENT'))

policy('P21','條件','處理結果的全體條件須非空','condition.nonempty_results','matched_results','翻／棄零張不滿足那些卡全符合；不足但非空可成立')
case('P21','空牌庫結果不成立','1312,1429,1813',dict(matched_results=[]),result('CONDITION_FALSE'))
case('P21','僅剩一張但符合條件可成立','1313,1430',dict(matched_results=[True]),result('CONDITION_TRUE'))
case('P21','包含一張不符合則不成立','1313',dict(matched_results=[True,False]),result('CONDITION_FALSE'))

policy('P22','數值期限','加值綁定角色實例','duration.target_instance','target_instance,active_instance,base,delta','同名或同卡號也不能繼承另一角色實例修正')
case('P22','第一次角色的加值不轉給第二次登場者','1124,1371',dict(target_instance='old',active_instance='new',base=3,delta=2),result('NO_DECISION'))
case('P22','同一角色實例正常加值','1124',dict(target_instance='old',active_instance='old',base=3,delta=2),result('VALUE',value=5))

policy('P23','期間監聽','來源限次與已產生效果分離','limit.activation_not_watch,trigger.each_entry,limit.effect_instance','watcher_active,origins,events,watcher_remaining','來源已封鎖不取消既成監聽；監聽自身一度僅一次另計')
base = dict(watcher_active=True,origins=['hand','guts'],events=[dict(origin='hand'),dict(origin='guts')],watcher_remaining=None,source_skill_locked=True)
case('P23','Turn1已使用但下回合兩次登場皆減值','1934',base,result('COUNT',count=2))
case('P23','只限手牌監聽不吃Guts登場','1855',dict(base,origins=['hand']),result('COUNT',count=1))
case('P23','一次效果實例只作用一次','1359,1360',dict(base,watcher_remaining=1),result('COUNT',count=1))
case('P23','監聽到期不觸發','1934',dict(base,watcher_active=False),result('COUNT',count=0))

policy('P24','具體動作','禁止打出與禁止放置分離','permission.deny,event.place_not_play,entry.limit','operation,actor,origin,phase,restriction','匹配被禁動作才擋；正常打出與技能放置是不同操作')
base = dict(operation='play_event',actor='opponent',origin='hand',phase='attack',restriction=dict(active=True,scope=dict(operation=['play_event'],actor=['opponent'])))
case('P24','禁止打出事件時不能正常打出','14,1372',base,result('DENY_ACTION'))
case('P24','同一限制不擋技能把事件放入區域','1372',dict(base,operation='place_event_by_skill'),result('NO_DECISION'))
case('P24','手牌登場禁止不擋其他區域登場','1383,1384',dict(base,operation='enter_character',origin='court',restriction=dict(active=True,scope=dict(operation=['enter_character'],origin=['hand']))),result('NO_DECISION'))

policy('P25','直接目標','角色耐性不解除玩家限制','permission.target_immunity','immunity_active,effect_target,immune_target','耐性只保護其直接目標，玩家受到的限制仍由玩家權限處理')
case('P25','角色耐性不豁免限制玩家的登場禁止','',dict(immunity_active=True,effect_target='player-1',immune_target='character-1'),result('NO_DECISION'))
case('P25','直接針對有耐性角色的技能被擋','',dict(immunity_active=True,effect_target='character-1',immune_target='character-1'),result('SKIP_DIRECT_EFFECT'))
case('P25','耐性到期則此規則不處理','',dict(immunity_active=False,effect_target='character-1',immune_target='character-1'),result('NO_DECISION'))

policy('P26','效果支付分支','前段全部完成才做依存後段','cost.effect_branch,effect.independent','opt_in,payment_steps','只控制該依存分支，不自動禁止技能或取消其他獨立段')
base = dict(opt_in=True,payment_steps=[dict(required=3,actual=3),dict(required=2,actual=2)])
case('P26','棄三張及付兩Guts完整後執行後段','30,31,1335',base,result('EXECUTE_DEPENDENT_STEPS'))
case('P26','牌庫僅兩張未完成棄三張的前段','1335',dict(base,payment_steps=[dict(required=3,actual=2),dict(required=2,actual=2)]),result('SKIP_BRANCH'))
case('P26','未選支付就略過該分支','30',dict(base,opt_in=False),result('SKIP_BRANCH'))
case('P26','只有部分支付資料不足以確認','30',dict(base,payment_steps=[]),result('REQUIRES_REVIEW'))

assert len({p['id'] for p in policies}) == len(policies)
assert len({c['id'] for c in cases}) == len(cases)
outcomes = []
for c in cases:
    actual = evaluate(c['policy'], c['facts'])
    assert actual == c['expected'], (c['id'], c['title'], c['expected'], actual)
    outcomes.append(dict(id=c['id'], passed=True, actual=actual))
covered_rules = set(r for p in policies for r in p['shared_rule_ids'])
summary = dict(reference_policies=len(policies), cases=len(cases), passed=len(outcomes),
               catalog_rules_with_reference_policy=len(covered_rules),
               catalog_rules_without_reference_policy=len(known_rules-covered_rules),
               official_qa_cited_by_cases=len({q for c in cases for q in c['qa_ids']}),
               test_scope='Scoped reference decisions; not game replay, not all 602 full scenarios')
bundle = dict(status='REFERENCE_VALIDATION_NOT_GAME_INTEGRATED',
              no_card_number_branches=True, no_runtime_qa_parsing=True,
              no_decision_is_not_global_allow=True, unknown_result='REQUIRES_REVIEW',
              summary=summary, policies=policies, golden_cases=cases, outcomes=outcomes)
(OUT / 'BREAK-permission-reference.json').write_text(json.dumps(bundle,ensure_ascii=False,indent=2)+'\n')
data['reference_validation'] = dict(summary=summary, artifact='BREAK-permission-reference.json')
for r in data['rules']:
    r['reference_policy_ids'] = [p['id'] for p in policies if r['id'] in p['shared_rule_ids']]
(OUT / 'BREAK-shared-rules.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
(ROOT / 'work/shared-rules/validation.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')

md = [f'''# BREAK 權限矩陣與參考驗證 v1

日期：2026-10-19。{len(policies)} 組共用判定契約，{len(cases)} 組正反情境全部通過。涵蓋 {len(covered_rules)} 條規則條目的部分契約；其他條目尚未有可執行參考驗證。這是獨立規則參考檢查，沒有接入遊戲，也不代表已自動重現全部602則完整問答或全卡技能。

矩陣按「打出 → 使用 → 費用 → 效果段 → 觸發 → 到期」分工。沒有全域數字優先級。各門檻只回答自身範圍：NO_DECISION不是整體合法；缺資料回REQUIRES_REVIEW。

## 共用權限矩陣

| ID／檢查 | 判定層 | 共用條件與結果 | 規則引用 |
|---|---|---|''']
for p in policies:
    md.append(f"| {p['id']} {p['title']} | {p['stage']} | {p['contract']} | {', '.join(p['shared_rule_ids'])} |")
md += ['\n## 正反情境與檢查結果\n','| 情境 | 官方QA | 預期結果 | 結果 |','|---|---|---|---|']
for c in cases:
    expected = c['expected']['verdict']
    for k,v in c['expected'].items():
        if k != 'verdict': expected += f'；{k}={v}'
    md.append(f"| {c['id']} {c['title']} | {','.join(c['qa_ids']) or '總合規則／對練設定邊界'} | {expected} | 通過 |")
md += ['\n## 使用時的參數與例外\n',
       '加入手牌限制範例：`actor=opponent`、`origin=rule/skill`、`phase=draw`、`active=true`；同一P01可用於任何提供這些參數的卡。技能無效化另用P03，兩者不混為禁止打牌。',
       '\n角色加值以角色實例綁定；同名限次依玩家、名稱、回合綁定；兩者使用不同鍵。來源技能限次和其生成監聽的次數亦分開。',
       '\n事件完全無變化的宣告邊界仍在共用規則庫列為待釐清，本參考判定器不擅自補上通用允許結論。',
       '\n[規則分類表](BREAK-shared-rules.md) · [結構化判定契約、輸入、情境與結果](BREAK-permission-reference.json) · [完整規則資料](BREAK-shared-rules.json)']
(OUT / 'BREAK-permission-matrix.md').write_text('\n'.join(md)+'\n')
coverage_path = OUT / 'BREAK-shared-rule-coverage.md'
coverage_text = coverage_path.read_text().split('\n<!--reference-validation-->')[0]
coverage_text += f'''\n<!--reference-validation-->
## 本批驗證結果

- {len(policies)}組獨立參考判定、{len(cases)}組來源情境及邊界案例全部通過。
- 涵蓋{len(covered_rules)}條規則的部分契約；另外{len(known_rules-covered_rules)}條目前仍為整理後的規則契約，尚未有可執行參考驗證。
- 全602則來源編號、614個多對多關聯與所有總合章節引用已檢查；58組問答全文去空白重複群組的共用機制映射一致。
- 結構資料附三個片段範例：禁止所有來源加手牌、只禁止技能加手牌、ワンタッチ分段。均非整張卡完成映射。
- 沒有遊戲整合或完整對戰重播；本批不宣稱全部602則問答結果已自動重現。
'''
coverage_path.write_text(coverage_text)
print(json.dumps(summary,ensure_ascii=False))
