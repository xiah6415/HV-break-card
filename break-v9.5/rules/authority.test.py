"""Mutate isolated input copies; never edits the checked-in approval sources."""
import copy
import json
import shutil
import sys
import tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from rules import authority as A
from library import build as L
from rules import build_runtime as R

catalog=json.loads((A.ROOT/'rules/data/cards.json').read_text())
approvals=json.loads((A.ROOT/'rules/approvals.json').read_text())
legacy=json.loads((A.ROOT/'rules/legacy-skills.json').read_text())
base=A.build_authority(catalog,approvals,legacy)
assert base['counts']==dict(basic=183,shared=36,legacy=7,unapproved=315)
checks=1

def reject(c=catalog,a=approvals,l=legacy):
    global checks
    try:A.build_authority(c,a,l)
    except AssertionError:checks+=1;return
    raise AssertionError('Invalid authority was accepted')

pid=next(iter(approvals['profiles']))
for value in ['abc','0'*64,approvals['profiles'][pid]['profile_sha256'].upper(),None]:
    a=copy.deepcopy(approvals);a['profiles'][pid]['profile_sha256']=value;reject(a=a)
a=copy.deepcopy(approvals);a['profiles']['unknown-profile']=a['profiles'][pid];reject(a=a)
c=copy.deepcopy(catalog);next(p for x in c['cards'] for p in x['profiles'] if p['profile_id']==pid)['limit']={'modified':True};reject(c=c)
for code in A.LEGACY_CODES:
    l=copy.deepcopy(legacy);l['cards'][code]['profile_sha256']='0'*64;reject(l=l)
l=copy.deepcopy(legacy);del l['cards']['PR-022'];reject(l=l)
l=copy.deepcopy(legacy);l['cards']['P04-093']=l['cards']['PR-022'];reject(l=l)
l=copy.deepcopy(legacy);l['cards']['PR-022']=copy.deepcopy(l['cards']['PR-057']);reject(l=l)
a=copy.deepcopy(approvals);p=legacy['cards']['PR-022'];a['profiles'][p['profile_id']]={'profile_sha256':p['profile_sha256']};reject(a=a)
c=copy.deepcopy(catalog);c['cards'][1]['profiles'][0]['profile_id']=c['cards'][0]['profiles'][0]['profile_id'];reject(c=c)
# A lost translation cannot turn a skill into a no-skill card.
c=copy.deepcopy(catalog);p=next(x for x in c['cards'] if x['card_no']=='HV-P04-093')['profiles'][0];p.update(program=None,activation=None,formal_cost=None,limit=None);assert A.build_authority(c,approvals,legacy)['cards']['P04-093']['kind']=='unapproved';checks+=1
# Revoking a full-SHA approval removes the exact card even if support calls it playable.
a=copy.deepcopy(approvals);del a['profiles'][pid];changed=A.build_authority(catalog,a,legacy);assert changed['counts']['shared']==35 and changed['counts']['unapproved']==316;checks+=1
# Full library/runtime builds with forged explanation entries, then a revoked approval.
original_a,original_l=A.ROOT,L.ROOT
with tempfile.TemporaryDirectory(prefix='break-authority-') as d:
    root=Path(d)
    names=['rules/data/cards.json','rules/approvals.json','rules/legacy-skills.json','rules/authority.py','rules/source/work/card-taxonomy/database.json','library/assets.json','card-support.json','rules/data/shared-rules.json']
    for name in names:
        dest=root/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(original_a/name,dest)
    (root/'img').symlink_to(original_a/'img',target_is_directory=True)
    support=json.loads((root/'card-support.json').read_text());support['cards']['P04-093']={'status':'basic','number':'HV-P04-093'};support['cards']['P03-004']={'status':'locked'};del support['cards']['PR-022'];(root/'card-support.json').write_text(json.dumps(support))
    original_path=R.Path
    try:
        A.ROOT=L.ROOT=root
        lib=L.write_library();assert lib['counts']['playable']==226 and not lib['cards']['P04-093']['playable'] and lib['cards']['P04-093']['status']=='locked';assert lib['cards']['P03-004']['playable'] and lib['cards']['PR-022']['playable'];checks+=1
        # runtime_data uses its module path; redirect only its Path constructor for this isolated fixture.
        R.Path=lambda value:root/'rules/build_runtime.py'
        rt=R.runtime_data();assert rt['authority']==lib['authority'] and len(rt['approved'])==36;checks+=1
        (root/'rules/approvals.json').write_text(json.dumps(a));lib=L.write_library();rt=R.runtime_data();assert lib['counts']['playable']==225 and len(rt['approved'])==35;assert all(p['program'] is None for x in rt['catalog']['cards'] for p in x['profiles'] if p['profile_id']==pid);checks+=1
        # Missing one metadata rebuild is rejected before emitting a mismatched runtime.
        (root/'rules/approvals.json').write_text(json.dumps(approvals))
        try:R.runtime_data()
        except AssertionError:checks+=1
        else:raise AssertionError('Stale authority build accepted')
    finally:A.ROOT,L.ROOT=original_a,original_l;R.Path=original_path
print(json.dumps({'passed':True,'authorityChecks':checks,'counts':base['counts'],'isolatedSupportForgery':True,'revocationChangesStrictGate':True}))
