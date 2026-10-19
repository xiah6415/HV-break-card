"""Build a source-linked, non-game-integrated shared-rule reference."""
import collections
import hashlib
import json
import re
import urllib.parse
from pathlib import Path

BASE = Path(__file__).resolve().parents[2]
WORK = BASE / 'work/shared-rules'
OUT = BASE / 'outputs'
snapshot_path = BASE / 'work/card-rulings/official-rulings.json'
snapshot = json.loads(snapshot_path.read_text())
official = {str(r['id']): r for r in snapshot['rulings']}
assert len(official) == len(snapshot['rulings']) == snapshot['official_count'] == 602
categories = ['數值', '資源與移動', '角色與身分', '行動權限', '技能權限', '流程與觸發']
general_url = 'https://www.takaratomy.co.jp/products/haikyuvobacabreak/rules/pdf/rules_general_v1.06.pdf'
rules = []
qa_map = collections.defaultdict(list)
for line in (WORK / 'catalog.tsv').read_text().splitlines():
    if not line or line.startswith('#'):
        continue
    key, category, title, when, result, params, ids, sections = line.split('|')
    assert category in categories
    qa_ids = sorted(set(filter(None, ids.split(','))), key=int)
    assert all(q in official for q in qa_ids), key
    rule = dict(id=key, category=category, title=title,
                applies_when=when, decision_contract=result,
                parameter_names=params.split(','), qa_ids=qa_ids,
                general_sections=list(filter(None, sections.split(','))),
                review_status='FIRST_PASS_SCOPED_RULE',
                executable=False, game_integrated=False)
    assert qa_ids or rule['general_sections'], key
    rules.append(rule)
    for q in qa_ids:
        qa_map[q].append(key)
assert len({r['id'] for r in rules}) == len(rules)
assert set(qa_map) == set(official), set(official) - set(qa_map)

def qa_url(r):
    suffix = urllib.parse.urlencode({'cn': r['card_no']} if r['card_no'] else {'cat': r['category']})
    return 'https://www.takaratomy.co.jp/products/haikyuvobacabreak/rules/?' + suffix

qa_links = []
for q in sorted(official, key=int):
    r = official[q]
    qa_links.append(dict(qa_id=q, card_no=r['card_no'] or None,
                         date=r['sdate'].split()[0], source=qa_url(r),
                         rule_ids=qa_map[q], mapping_status='MECHANISM_ASSIGNED_FROM_READING',
                         full_card_parameters_bound=False,
                         source_text_sha256=hashlib.sha256((r['que'] + '\n' + r['ans']).encode()).hexdigest()))

duplicates = collections.defaultdict(list)
for q,r in official.items():
    text = re.sub(r'\s+', '', r['que'] + '\n' + r['ans'])
    duplicates[text].append(q)
duplicate_groups = [sorted(v, key=int) for v in duplicates.values() if len(v) > 1]
for group in duplicate_groups:
    assert len({tuple(sorted(qa_map[q])) for q in group}) == 1, group
counts = dict(rules=len(rules), official_qa=len(official), mapped_qa=len(qa_map),
              card_qa=sum(bool(r['card_no']) for r in official.values()),
              general_qa=sum(not r['card_no'] for r in official.values()),
              source_links=sum(len(x) for x in qa_map.values()),
              category_counts=dict(collections.Counter(r['category'] for r in rules)),
              exact_duplicate_qa_groups=len(duplicate_groups),
              qa_supported_rules=sum(bool(r['qa_ids']) for r in rules),
              general_only_rules=sum(not r['qa_ids'] for r in rules))
open_items = [dict(
    id='OPEN-EVENT-NO-CHANGE', severity='BEFORE_EVENT_DECLARATION_INTEGRATION',
    rule_ids=['permission.layers'], qa_ids=['14','1814','1837','1942'],
    general_sections=['6-7-1','6-8-1'],
    issue='問答允許適當時點放入條件不足／技能無效事件；總合規則另列技能完全無變化時不可宣告。',
    handling='保留兩項來源及各自範圍；先分離放卡與技能權限。涉及完全無變化的事件宣告返回待釐清，不以總是可打或總是不可打概括。',
)]
payload = dict(schema_version=1, status='SHARED_RULE_REFERENCE_V1_NOT_GAME_INTEGRATED',
               checked_on='2026-10-19',
               source=dict(qa_snapshot_sha256=hashlib.sha256(snapshot_path.read_bytes()).hexdigest(),
                           qa=snapshot['source'], general_rules=general_url,
                           general_version='1.06'),
               counts=counts,
               runtime_contract=dict(raw_japanese_parsing=False, per_card_qa_lookup=False,
                                     card_data='tags + shared_rule_ids + typed parameters + narrowly scoped exceptions',
                                     no_numeric_global_priority=True,
                                     unknown_policy='REQUIRES_REVIEW; never infer ALLOW'),
               rules=rules, qa_rule_map=qa_links,
               exact_duplicate_qa_groups=duplicate_groups, open_items=open_items,
               practice_overrides=[dict(id='practice.draw_event_before_receive',
                                        enabled_in_current_game=True,
                                        meaning='官方階段資料不改；對練設定另允許抽牌事件在接球判定前使用',
                                        official_rule='event.phase')],
               coverage_note='602則已閱讀並映射共用機制；不代表541卡已綁定全部參數，亦不代表所有規則已可執行。')
payload['card_data_contract'] = dict(
    mapping_status='NEXT_STAGE_NOT_ALL_CARDS_BOUND',
    identity_fields=['card_no','variant_profile_id','source_version'],
    skill_fields=['skill_type','activation_phases','trigger','source_zone','conditions','cost','limits','effects'],
    effect_fields=['effect_id','category_tags','polarity','operation','target_selector','parameters','depends_on','scope','duration','shared_rule_ids','exception_ids'],
    polarity_values=['beneficial','adverse','neutral','contextual'],
    permission_layers=['play_card','use_skill','resolve_step'],
    operation_values=['draw','add_hand','discard','move','reveal','look','shuffle','modify_numeric','set_numeric','name_change','enter_character','place_event_by_skill','exchange','ban_action','invalidate_skill','protect_numeric','register_trigger','phase_jump','loss','keyword'],
    distinction=dict(origin='行動由rule或skill造成',entry_origin='角色從hand/drop/guts/court等處登場',
                     card_type='character/event',card_role='character/guts/side_blocker等局面身分',
                     target_instance='角色實例，與卡號及限次名稱鍵不同'),
    unknown_mapping='unresolved mechanism/variant/parameter must remain explicit; never silently allow',
    runtime_source_lookup=False)
payload['card_data_contract']['parameter_types'] = dict(
    phase=dict(type='enum',values=['serve','block','draw','receive','toss','attack','end','interval']),
    origin=dict(type='enum',values=['rule','skill']),
    entry_origin=dict(type='zone_reference',examples=['hand','drop','guts','court']),
    actor=dict(type='player_reference',relative_values=['self','opponent','owner','controller','affected_player'],perspective='effect controller; resolve to actual player ID before matching'),
    count=dict(type='integer',minimum=0),
    numeric_value=dict(type='integer',negative_allowed=True,dash='separate sentinel, never numeric zero'),
    target_instance=dict(type='stable game-object reference',not_equivalent_to=['card_no','name']),
    name=dict(type='exact identifier',basis='printed/effective explicitly specified'),
    identity_tags=dict(type='set of exact identifiers',substring_matching=False),
    duration=dict(type='structured interval',fields=['starts','expires_at','turn_owner','turn_offset']),
    condition=dict(type='predicate tree',operators=['all','any','not','eq','lt','lte','gt','gte','contains_exact','count','distinct_count']),
    depends_on=dict(type='effect result references',completion_values=['performed','fully_completed','selected_target','revealed_result']),
    exception_ids=dict(type='array of narrowly scoped rule IDs'))
payload['binding_examples'] = [
    dict(id='example.hand-ban-all-origins',status='RESOLVED_EFFECT_FRAGMENT_ONLY_NOT_FULL_CARD',
         source_card='HV-P04-087',category_tags=['行動權限','資源與移動'],operation='ban_action',
         scope=dict(actor='opponent',operations=['draw','add_hand'],origins=['rule','skill'],phases=['draw']),
         duration=dict(starts='next_opponent_turn',ends='that_turn_cleanup_or_before_interval'),
         shared_rule_ids=['hand.draw_subset','hand.restriction','permission.deny']),
    dict(id='example.hand-ban-skill-only',status='RESOLVED_EFFECT_FRAGMENT_ONLY_NOT_FULL_CARD',
         source_card='HV-P01-035',category_tags=['行動權限','資源與移動'],operation='ban_action',
         scope=dict(actor='opponent',operations=['draw','add_hand'],origins=['skill'],phases='all'),
         duration=dict(starts='next_opponent_turn',ends='that_turn_cleanup_or_before_interval'),
         shared_rule_ids=['hand.draw_subset','hand.restriction','permission.deny']),
    dict(id='example.one-touch',status='KEYWORD_FRAGMENT_ONLY_NOT_FULL_CARD',
         category_tags=['數值','流程與觸發'],keyword='one_touch',parameters=dict(N='from card data'),
         ordered_steps=[dict(operation='modify_numeric',target='opponent_ball',numeric_domain='attack_offense',delta='-N'),
                        dict(operation='phase_jump',destination='own_draw_start',depends_on_reduction_success=False)],
         shared_rule_ids=['keyword.one_touch','numeric.protection','effect.order'])]
for binding in payload['binding_examples']:
    assert set(binding['shared_rule_ids']) <= {r['id'] for r in rules}
(OUT / 'BREAK-shared-rules.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2)+'\n')
(WORK / 'counts.json').write_text(json.dumps(counts, ensure_ascii=False, indent=2)+'\n')

intro = f'''# BREAK 共用規則分類表 v1

核對日：2026-10-19。從全部 {len(official)} 則官方問答逐批閱讀、按機制歸納成 {len(rules)} 條共用規則條目；條目包括權限、資料辨識、效果操作及流程。另補總合規則所需的共用規則。這些是六類底下的子規則，不是卡片強弱或全域優先級。

**使用方式：官方問答／總合規則 → 共用規則與標籤 → 卡片只提供標籤、規則ID與差異參數 → 引擎統一判定。** 正負方向只供效果分類；真正權限使用具體動作、來源、目標、範圍與期限。來源判例集中於規則庫保存，執行時不讀日文或逐卡查問答。

目前是第一版範圍已整理的規則契約；尚未接入遊戲、尚未完成全卡參數映射。所有條目保留第一輪覆核狀態；獨立參考判定器的情境測試只覆蓋矩陣標明的部分，不能當作全部遊戲規則驗證。

來源：[官方Q&A](https://www.takaratomy.co.jp/products/haikyuvobacabreak/rules/)、[總合規則v1.06]({general_url})。原始問答快照保存在工作資料中；此處不重製全文。

## 標準欄位

每條規則保存固定ID、上層類別、適用條件、判定結果、卡片需提供的參數、問答／總合規則來源與驗證狀態。以下「參數」欄是必須在卡片／局面資料明確提供的欄位名稱，不由引擎臨場猜原文。

### 判定的分工

- 打出卡、使用技能、執行分段效果，各自判定權限。
- 限制只在動作、玩家、來源、階段、目標與期限匹配時生效。
- 正式宣告費用、效果中的選擇支付、可不選與最多數量分開。
- 先完成當前技能，再進入觸發檢查；處理順序依所屬規則，不用單一優先數字。
- 卡片特例用額外條件表示；無法確認的匹配結果回報待釐清。

'''
md = [intro]
for cat in categories:
    selected = [r for r in rules if r['category'] == cat]
    md += [f'## {cat}（{len(selected)} 條）\n', '| 規則 ID／名稱 | 適用時與共用判定 | 參數 | 依據 |', '|---|---|---|---|']
    for r in selected:
        refs = ('QA '+','.join(r['qa_ids'])) if r['qa_ids'] else ''
        if r['general_sections']:
            refs += ('；' if refs else '')+'總合 '+','.join(r['general_sections'])
        md.append(f"| {r['id']}<br>{r['title']} | {r['applies_when']}：{r['decision_contract']} | {', '.join(r['parameter_names'])} | {refs} |")
    md.append('')
md += ['## 需要保留的界線\n',
       '- 事件完全無變化時的宣告門檻：QA14／1814／1837／1942與總合6-8-1需保留情境差異；本版標為OPEN-EVENT-NO-CHANGE，尚不給通用允許／禁止結論。',
       '- 四個已發現的官方卡文版本差異仍保留，屬下一步卡片參數映射的異常清單，不因同卡號自動合併。',
       '- 抽牌事件於接球判定前使用保留為使用者指定的對練設定，官方事件階段資料不改。',
       '- 本批沒有改引擎、UI、卡牌規則或公開遊戲，沒有建置、提交或部署。\n',
       '## 附件\n',
       '- [權限矩陣與情境驗證](BREAK-permission-matrix.md)',
       '- [完整結構資料與602則映射](BREAK-shared-rules.json)',
       '- [覆蓋與檢查報告](BREAK-shared-rule-coverage.md)',
       '- [官方問答來源索引](BREAK-card-rulings-index.md)']
(OUT / 'BREAK-shared-rules.md').write_text('\n'.join(md)+'\n')

coverage = [f'''# BREAK 共用規則覆蓋報告

日期：2026-10-19。

| 項目 | 結果 |
|---|---:|
| 官方問答／已映射機制 | {counts['official_qa']}／{counts['mapped_qa']} |
| 卡片問答／一般問答 | {counts['card_qa']}／{counts['general_qa']} |
| 共用規則條目 | {counts['rules']} |
| 有問答依據／僅總合規則依據 | {counts['qa_supported_rules']}／{counts['general_only_rules']} |
| 問答與規則關聯數（可多對多） | {counts['source_links']} |
| 問題及回答去空白完全相同的群組 | {counts['exact_duplicate_qa_groups']} |

每則問答已讀取並指定至少一個共用機制。不同問答即使內容相似仍保留其來源與卡號；這不是把所有限定結論擴張成通則。卡片只需建檔一次；未來對戰直接讀標籤及參數。

分類覆蓋不等於執行覆蓋：全卡效果參數尚未完成映射，規則條目仍是第一版契約。獨立參考判定器的執行情境結果另列於[權限矩陣](BREAK-permission-matrix.md)，沒有使用這些測試宣稱602則問答的所有結果已自動重現。

## 完整問答到共用規則的映射

| 官方 QA | 卡號／一般分類 | 共用規則 ID |
|---|---|---|''']
for link in qa_links:
    q = link['qa_id']
    r = official[q]
    coverage.append(f"| [QA{q}]({link['source']}) | {r['card_no'] or r['category']} | {', '.join(link['rule_ids'])} |")
(OUT / 'BREAK-shared-rule-coverage.md').write_text('\n'.join(coverage)+'\n')
if (OUT/'BREAK-card-rule-mapping.json').exists():
    for filename in ['BREAK-shared-rules.md','BREAK-shared-rule-coverage.md']:
        target=OUT/filename
        target.write_text(target.read_text()+'''\n## 後續全卡映射進度

541卡／362個有技能卡文版本已完成[第一輪結構化映射](BREAK-card-rule-mapping.md)，74項資料與條件檢查通過。這項進度取代上文初版「尚未映射全卡」的描述；仍未接入遊戲引擎，不能當作全卡技能已可執行。卡文差異與待補共用機制見[例外清單](BREAK-card-mapping-exceptions.md)。
''')
print(json.dumps(counts, ensure_ascii=False))
