"""Single build-time authority; support labels never grant execution permission."""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEGACY_CODES = frozenset(['PR-022', 'PR-057', 'P01-006', 'P01-078', 'P03-086', 'PR-029', 'P03-087'])

def profile_sha(profile):
    return hashlib.sha256(json.dumps(profile, ensure_ascii=False, sort_keys=True).encode()).hexdigest()

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
            digest = record.get('profile_sha256')
            assert isinstance(digest, str) and re.fullmatch('[0-9a-f]{64}', digest), 'Full SHA256 required: ' + str(pid)
            assert profile_sha(profile) == digest, 'Approved profile changed: ' + code
            assert profile['program'] is not None and profile['activation'] is not None, 'A skill approval requires a skill program'
            assert len(by_code[code]['profiles']) == 1, 'Text variant needs explicit resolution: ' + code
            assert code not in grants, 'Conflicting shared/legacy approval: ' + code
            grants[code] = dict(kind=source, profileId=pid, profileSha256=digest)
    cards = {}
    for code, card in by_code.items():
        p = card['profiles'][0]
        basic = len(card['profiles']) == 1 and p['status'] == 'NO_SKILL_BASE_DATA' and p['program'] is None and p['activation'] is None and p['formal_cost'] is None and p['limit'] is None and all(v['printed']['type'] == 'character' for v in p['variants'])
        cards[code] = grants.get(code, dict(kind='basic' if basic else 'unapproved', profileId=p['profile_id']))
    counts = {kind: sum(p['kind'] == kind for p in cards.values()) for kind in ['basic', 'shared', 'legacy', 'unapproved']}
    return dict(version=1, cards=cards, counts=counts,
                sources={name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in ['rules/data/cards.json', 'rules/approvals.json', 'rules/legacy-skills.json', 'rules/authority.py']})
