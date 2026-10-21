"""Existing baseline plus completed modules whose dependent card tests pass."""
import hashlib
import json
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# Already public before the node-level policy; do not revoke these during migration.
PREVIOUS_MODULE_CARDS = frozenset(['P01-086', 'P03-089'])
LEGACY_CODES = frozenset(['PR-022', 'PR-057', 'P01-006', 'P01-078', 'P03-086', 'PR-029', 'P03-087'])

def short(number):
    return number[3:] if number.startswith('HV-') else number[2:] if number.startswith('HVBP-') else number

def build_authority(catalog=None, approvals=None, legacy=None):
    catalog = catalog if catalog is not None else json.loads((ROOT / 'rules/data/cards.json').read_text())
    approvals = approvals if approvals is not None else json.loads((ROOT / 'rules/approvals.json').read_text())
    legacy = legacy if legacy is not None else json.loads((ROOT / 'rules/legacy-skills.json').read_text())
    assert approvals.get('version') == 1 and isinstance(approvals.get('profiles'), dict), 'Invalid approval manifest'
    assert legacy.get('version') == 1 and set(legacy.get('cards', {})) == LEGACY_CODES, 'Fixed legacy whitelist must contain exactly the seven reviewed skills'
    by_id, by_code = {}, {}
    for card in catalog['cards']:
        code = short(card['card_no'])
        assert code not in by_code and card['profiles'], 'Duplicate or empty card: ' + code
        by_code[code] = card
        for p in card['profiles']:
            assert p['profile_id'] not in by_id, 'Duplicate profile identity'
            by_id[p['profile_id']] = (code, p)
    grants = {}
    for source, records in [('shared', approvals['profiles']), ('legacy', legacy['cards'])]:
        for key, record in records.items():
            pid = key if source == 'shared' else record.get('profile_id')
            assert pid in by_id, 'Orphan approval: ' + str(pid)
            code, profile = by_id[pid]
            assert source != 'legacy' or code == key, 'Legacy profile belongs to another card'
            assert profile['program'] is not None and profile['activation'] is not None, 'A skill approval requires a skill program'
            assert len(by_code[code]['profiles']) == 1, 'Text variant needs explicit resolution: ' + code
            assert code not in grants, 'Conflicting shared/legacy approval: ' + code
            # Historical grants remain a baseline, not per-card SHA certificates.
            grants[code] = dict(kind=source, profileId=pid)
    for code in PREVIOUS_MODULE_CARDS:
        p = by_code[code]['profiles'][0]
        grants[code] = dict(kind='shared', profileId=p['profile_id'], baseline=True)
    # Every build runs the small card scenarios; no saved evidence/approval JSON.
    process = subprocess.run([shutil.which('node') or '/usr/local/bin/node', str(ROOT / 'rules/modules.js')],
                             input=json.dumps(catalog), text=True, capture_output=True)
    assert process.returncode == 0, 'Module card tests failed:\n' + process.stderr
    release = json.loads(process.stdout)
    for code, record in release['cards'].items():
        assert code in by_code and record['profileId'] in by_id, 'Unknown module card'
        assert code not in grants or grants[code]['kind'] == 'shared', 'Module conflicts with legacy controller'
        grants[code] = dict(kind='shared', **record)
    cards = {}
    for code, card in by_code.items():
        p = card['profiles'][0]
        basic = len(card['profiles']) == 1 and p['status'] == 'NO_SKILL_BASE_DATA' and p['program'] is None and p['activation'] is None and p['formal_cost'] is None and p['limit'] is None and all(v['printed']['type'] == 'character' for v in p['variants'])
        cards[code] = grants.get(code, dict(kind='basic' if basic else 'unapproved', profileId=p['profile_id']))
    counts = {kind: sum(p['kind'] == kind for p in cards.values()) for kind in ['basic', 'shared', 'legacy', 'unapproved']}
    return dict(version=2, cards=cards, counts=counts, modules=release['modules'],
                sources={name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in ['rules/data/cards.json', 'rules/approvals.json', 'rules/legacy-skills.json', 'rules/authority.py', 'rules/modules.js', 'rules/node-inventory.js', 'rules/node-module-tests.js', 'rules/frequent-node-tests.js', 'rules/card-scenarios.js', 'rules/batch-smoke.js', 'rules/batch-fixtures.js', 'rules/batch-branches.js', 'rules/batch-index.js', 'rules/coverage.js', 'rules/core.js', 'rules/data/shared-rules.json']})
