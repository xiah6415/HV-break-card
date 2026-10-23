"""Build playable scripts from the baseline and passing completed modules."""
import copy
import hashlib
import json
from pathlib import Path
if __package__ in (None, ''):
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from rules.authority import build_authority, short


def runtime_data():
    root = Path(__file__).parent
    catalog = json.loads((root / 'data/cards.json').read_text())
    approvals = json.loads((root / 'approvals.json').read_text())
    library_data = json.loads((root.parent / 'card-library.json').read_text())
    for path, digest in library_data['sources'].items():
        assert hashlib.sha256((root.parent / path).read_bytes()).hexdigest() == digest, 'Rebuild card library before runtime: ' + path
    authority = build_authority(catalog=catalog, approvals=approvals)
    assert library_data['authority'] == authority, 'Library authority differs from runtime authority'
    cards = []
    for original in catalog['cards']:
        card = copy.deepcopy(original)
        profile = card['profiles'][0]
        if authority['cards'][short(card['card_no'])]['kind'] == 'shared':
            ids=authority['cards'][short(card['card_no'])].get('profileIds', [profile['profile_id']])
            for variant_profile in card['profiles']:
                assert variant_profile['profile_id'] in ids, 'Unverified printed profile'
                variant_profile['runtime_approved'] = True
        else:
            # Printed identity is available; no other first-pass skill is executable.
            profile = {'profile_id': profile['profile_id'], 'variants': profile['variants'], 'program': None,
                       'printed_play_icons': (profile.get('activation') or {}).get('activation_phases', []),
                       'printed_has_skill': bool(profile.get('program'))}
            card['profiles'] = [profile]
        cards.append(card)
    result = {'catalog': {'cards': cards}, 'authority': authority,
              'approved': [pid for p in authority['cards'].values() if p['kind'] == 'shared' for pid in p.get('profileIds', [p['profileId']])],
              'ruleIds': [r['id'] for r in json.loads((root / 'data/shared-rules.json').read_text())['rules']]}
    result['fingerprint'] = hashlib.sha256(json.dumps(result, sort_keys=True).encode()).hexdigest()
    return result


def write_runtime():
    data = runtime_data()
    (Path(__file__).parent / 'runtime-data.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
    return data
