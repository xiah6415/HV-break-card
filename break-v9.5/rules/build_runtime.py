"""Small, hash-pinned migration overlay; the frozen first-pass catalog stays intact."""
import copy
import hashlib
import json
from pathlib import Path


def runtime_data():
    root = Path(__file__).parent
    catalog = json.loads((root / 'data/cards.json').read_text())
    approvals = json.loads((root / 'approvals.json').read_text())
    support = json.loads((root.parent / 'card-support.json').read_text())['cards']
    library_data = json.loads((root.parent / 'card-library.json').read_text())
    for path in ['rules/data/cards.json', 'card-support.json']:
        assert hashlib.sha256((root.parent / path).read_bytes()).hexdigest() == library_data['sources'][path], 'Rebuild card library before runtime: ' + path
    library = library_data['cards']
    selected = dict(support)
    selected.update({c: entry for c, entry in library.items() if entry['playable'] and c not in selected})
    cards = []
    for short, legacy in selected.items():
        card = copy.deepcopy(next(c for c in catalog['cards'] if c['card_no'] == legacy['number']))
        assert len(card['profiles']) == 1, 'Legacy text variant must be selected explicitly'
        profile = card['profiles'][0]
        if short not in support:
            assert profile['program'] is None, 'New skill needs explicit admission: ' + short
        approval = approvals['profiles'].get(profile['profile_id'])
        if approval:
            digest = hashlib.sha256(json.dumps(profile, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
            assert digest == approval['profile_sha256'], 'Approved profile changed: ' + short
            profile['runtime_approved'] = True
        else:
            # Printed identity is available; no other first-pass skill is executable.
            profile = {'profile_id': profile['profile_id'], 'variants': profile['variants'], 'program': None,
                       'printed_play_icons': (profile.get('activation') or {}).get('activation_phases', []),
                       'printed_has_skill': bool(profile.get('program'))}
            card['profiles'] = [profile]
        cards.append(card)
    result = {'catalog': {'cards': cards}, 'approved': list(approvals['profiles']),
              'ruleIds': [r['id'] for r in json.loads((root / 'data/shared-rules.json').read_text())['rules']]}
    result['fingerprint'] = hashlib.sha256(json.dumps(result, sort_keys=True).encode()).hexdigest()
    return result


def write_runtime():
    data = runtime_data()
    (Path(__file__).parent / 'runtime-data.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
    return data
