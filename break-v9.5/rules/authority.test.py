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
assert base['counts']==dict(basic=183,shared=176,legacy=7,unapproved=175)
assert [(m['id'],m['parameterForms']) for m in base['modules']]==[('sequence',1),('deck_selection',15),('numeric',77),('selector',152),('conditional',1),('payment_branch',1),('pay_guts',16),('compare',97),('draw',5),('move',20),('count_compare',13),('retrieve',7),('watch',26),('uniform_affiliation',18),('all',1)]
# Old per-card SHA/evidence fields no longer decide whether a card can run.
a=copy.deepcopy(approvals);l=copy.deepcopy(legacy)
for r in a['profiles'].values():r.pop('profile_sha256',None)
for r in l['cards'].values():r['profile_sha256']='unused'
assert A.build_authority(catalog,a,l)['cards']==base['cards']
# Removing a historical baseline still revokes that grant; support text grants nothing.
pid=next(iter(a['profiles']));del a['profiles'][pid]
assert A.build_authority(catalog,a,l)['counts']['shared']==base['counts']['shared']-1
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
assert lib['counts']['playable']==366 and lib['authority']==rt['authority']==base
assert len(rt['approved'])==176
for code in ['P01-089','P03-078','P03-079','P04-085']:
 assert lib['cards'][code]['playable']
 p=next(c for c in rt['catalog']['cards'] if c['card_no']=='HV-'+code)['profiles'][0]
 assert p['program'] and p['runtime_approved']
print('authority: baseline without SHA + module tests / 366 strict / 176 shared passed')
