"""Compile library browsing data and playable basic cards from frozen sources."""
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import quote
if __package__ in (None, ''):
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from rules.authority import build_authority

ROOT = Path(__file__).resolve().parent.parent
PARAMS = ['serve', 'block', 'receive', 'toss', 'attack']

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def normal(value):
    value = value.strip().upper()
    if value.endswith('.WEBP'):
        value = value[:-5]
    return value.replace('HVBP-', 'BP-', 1) if value.startswith('HVBP-') else value[3:] if value.startswith('HV-') else value

def library_data():
    catalog = json.loads((ROOT / 'rules/data/cards.json').read_text())
    database = json.loads((ROOT / 'rules/source/work/card-taxonomy/database.json').read_text())
    records = {str(r['id']): r for r in database['cards']}
    support = json.loads((ROOT / 'card-support.json').read_text())['cards']
    assets = json.loads((ROOT / 'library/assets.json').read_text())
    authority = build_authority(catalog=catalog)
    cards, aliases = {}, {}
    for card in catalog['cards']:
        code = normal(card['card_no'])
        profile = card['profiles'][0]
        printed = profile['variants'][0]['printed']
        record = records[profile['variants'][0]['record_id']]
        permission = authority['cards'][code]['kind']
        basic = permission == 'basic'
        playable = permission != 'unapproved'
        if len(card['profiles']) > 1:
            assert all(p['variants'][0]['printed']['parameters'] == printed['parameters'] for p in card['profiles']), 'Numerical variant must be selected explicitly'
        stats = [None if printed['parameters'][p] == 'dash' else printed['parameters'][p] for p in PARAMS] if printed['type'] == 'character' else [0] * 5
        assert all(n is None or type(n) is int for n in stats)
        value = max(1, round(max([v or 0 for v in stats]) * .8 + 1))
        status = 'basic' if basic else 'locked' if not playable else support.get(code, {}).get('status', 'partial')
        if playable and not basic and status not in ['partial', 'scenario-tested']:
            status = 'partial'
        variants = []
        for p in card['profiles']:
            raw = records[p['variants'][0]['record_id']]
            variants.append(dict(profileId=p['profile_id'], printed=p['variants'][0]['printed'], skill=raw.get('skill_zh') or raw.get('skill_jp') or '', images=[v['image_file'] for v in p['variants']]))
        entry = dict(code=code, number=card['card_no'], name=re.sub(r'\s+', ' ', printed['display_name']).strip(), nameZh=record.get('name_zh') or '',
                     printedName=printed['name'], kind='C' if printed['type'] == 'character' else 'E', stats=stats,
                     schoolTags=printed['affiliation_tags'], yearTags=printed['year_tags'], positionTags=printed['position_tags'],
                     affiliation=profile['variants'][0]['raw_affiliation'], hasSkill=not basic, playable=playable,
                     status=status, versions=variants, activationPhases=(profile.get('activation') or {}).get('activation_phases', []), source='https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=' + quote(card['card_no']) + '&voba=' + quote(profile['variants'][0]['rarity']),
                     image=assets['images'][code]['file'], skill='' if basic else record.get('skill_zh') or record.get('skill_jp') or '')
        entry['definition'] = [entry['name'], entry['kind'], *stats, value, '/'.join(entry['schoolTags']), entry['yearTags'][0] if entry['yearTags'] else 0, entry['skill']]
        cards[code] = entry
        for alias in [code, card['card_no'], *[v['image_file'] for p in card['profiles'] for v in p['variants']]]:
            key = normal(alias)
            assert key not in aliases or aliases[key] == code, 'Ambiguous card alias'
            aliases[key] = code
    assert len(cards) == len(catalog['cards']) == 541
    assert sum(c['playable'] for c in cards.values()) == sum(authority['counts'][k] for k in ['basic', 'shared', 'legacy'])
    assert sum(c['status'] == 'basic' for c in cards.values()) == 183
    for code, asset in assets['images'].items():
        assert sha(ROOT / asset['file']) == asset['sha256'], 'Art changed: ' + code
    return dict(schemaVersion=2, authority=authority, counts=dict(cards=len(cards), profiles=sum(len(c['profiles']) for c in catalog['cards']), playable=sum(c['playable'] for c in cards.values()), basic=183, locked=sum(not c['playable'] for c in cards.values())),
                sources={p: sha(ROOT / p) for p in ['rules/data/cards.json', 'rules/source/work/card-taxonomy/database.json', 'card-support.json', 'library/assets.json', 'rules/approvals.json', 'rules/legacy-skills.json', 'rules/authority.py', 'rules/modules.js', 'rules/node-inventory.js', 'rules/node-module-tests.js', 'rules/frequent-node-tests.js', 'rules/card-scenarios.js', 'rules/batch-smoke.js', 'rules/batch-fixtures.js', 'rules/batch-branches.js', 'rules/batch-index.js', 'rules/coverage.js', 'rules/core.js', 'rules/data/shared-rules.json']}, cards=cards, aliases=aliases)

def write_library():
    data = library_data()
    (ROOT / 'card-library.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
    return data

if __name__ == '__main__':
    print(json.dumps(write_library()['counts']))
