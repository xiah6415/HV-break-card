"""Module releases run real card tests; historical SHA certificates are inactive."""
import copy
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from rules import authority as A
from rules import build_runtime as R
from library import build as L
catalog=json.loads((A.ROOT/'rules/data/cards.json').read_text())
approvals=json.loads((A.ROOT/'rules/approvals.json').read_text())
legacy=json.loads((A.ROOT/'rules/legacy-skills.json').read_text())
base=A.build_authority(catalog,approvals,legacy)
assert base['counts']==dict(basic=183,shared=358,legacy=0,unapproved=0)
assert [(m['id'],m['parameterForms']) for m in base['modules']]==[('sequence',1),('deck_selection',16),('numeric',78),('selector',156),('conditional',1),('payment_branch',1),('pay_guts',16),('compare',98),('draw',5),('move',20),('count_compare',13),('retrieve',7),('watch',27),('uniform_affiliation',19),('all',1),('keyword',15),('rename_before_entry',26),('all_result_cards_match',18),('move_self',6),('mill',6),('enter',7),('formal_declaration_cost',1),('ban_action',14),('invalidate_skill',11),('choose_modes',1),('optional',2),('any',1),('equal_fields',1),('result_count',1),('sum_result_parameter',1),('draw_to_hand_size',2),('exchange',1),('each_player_optional_draw',1),('protect_numeric_decrease',5),('phase_jump',1),('enter_self',3),('external_action',5),('shuffle',2),('move_result',1),('reveal_top',1),('simultaneous_entry_group',1),('cover_source_with_guts',1),('force_judgment_failure',1),('parameter_absent',1),('printed_parameter',1),('retrieve_slots',1),('reveal_and_retrieve',1),('source_skill_maximum',1)]
# Old per-card SHA/evidence fields no longer decide whether a card can run.
a=copy.deepcopy(approvals);l=copy.deepcopy(legacy)
for r in a['profiles'].values():r.pop('profile_sha256',None)
for r in l['cards'].values():r['profile_sha256']='unused'
assert A.build_authority(catalog,a,l)['cards']==base['cards']
# Removing a historical baseline still revokes that grant; support text grants nothing.
pid=next(iter(a['profiles']));del a['profiles'][pid]
assert A.build_authority(catalog,a,l)['counts']['shared']==base['counts']['shared']-1
# The historical migration baseline cannot expand or change identity.
# No accidentally expanded legacy whitelist or cross-controller duplicate grants.
for change in ['missing','extra','duplicate']:
 a=copy.deepcopy(approvals);l=copy.deepcopy(legacy)
 if change=='missing':del l['cards']['PR-022']
 if change=='extra':l['cards']['P04-093']=l['cards']['PR-022']
 if change=='duplicate':a['profiles'][l['cards']['PR-022']['profile_id']]={}
 try:A.build_authority(catalog,a,l)
 except AssertionError:pass
 else:raise AssertionError(change+' accepted')
# Every module-dependent card is released automatically, no per-card manifest edit.
c=copy.deepcopy(catalog);p=next(c for c in c['cards'] if c['card_no']=='HV-P01-089')['profiles'][0]
p['program']['steps'].append(dict(kind='unimplemented-node'))
assert A.build_authority(c,approvals,legacy)['cards']['P01-089']['kind']=='unapproved'
c=copy.deepcopy(catalog);p=next(c for c in c['cards'] if c['card_no']=='HV-P01-089')['profiles'][0]
p['program']['shared_rule_ids']=['unimplemented-rule']
try:A.build_authority(c,approvals,legacy)
except AssertionError as e:assert 'Module card tests failed' in str(e)
else:raise AssertionError('Failing card test was released')
lib=L.library_data();rt=R.runtime_data()
assert lib['counts']['playable']==541 and lib['authority']==rt['authority']==base
assert len(rt['approved'])==362
for code in ['P01-089','P03-078','P03-079','P04-085']:
 assert lib['cards'][code]['playable']
 p=next(c for c in rt['catalog']['cards'] if c['card_no']=='HV-'+code)['profiles'][0]
 assert p['program'] and p['runtime_approved']
print('authority: baseline without SHA + module tests / 541 strict / 358 shared cards / 362 profiles passed')

# Every historical card now executes through tested modules, never its fallback.
assert all(base['cards'][code]['kind']=='shared' for code in legacy['cards'])

c=copy.deepcopy(catalog);p=next(c for c in c['cards'] if c['card_no']=='HV-PR-022')['profiles'][0]
p['program']['steps'].append(dict(kind='unimplemented-node'))
assert A.build_authority(c,approvals,legacy)['cards']['PR-022']['kind']=='unapproved', 'A broken migrated skill cannot return to its retired controller'
