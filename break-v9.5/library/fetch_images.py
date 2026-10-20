"""Fetch missing art from a pinned public source; never replace existing art."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import time
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
SOURCE = json.loads((ROOT / 'library/source-images.json').read_text())

def blob(data):
    return hashlib.sha1(('blob ' + str(len(data)) + '\0').encode() + data).hexdigest()

def fetch(item):
    code, entry = item
    target = ROOT / entry['file']
    if entry['origin'] == 'legacy_preserved':
        data = target.read_bytes()
    else:
        if target.exists():
            data = target.read_bytes()
        else:
            url = 'https://raw.githubusercontent.com/weilun2022/haikyuu-cards/' + SOURCE['commit'] + '/' + entry['source_path']
            for attempt in range(3):
                try:
                    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'BREAK-library-import'}), timeout=35) as response:
                        data = response.read()
                    break
                except Exception:
                    if attempt == 2:
                        raise
                    time.sleep(1)
        assert blob(data) == entry['source_blob_sha1'], 'Source art mismatch: ' + code
        assert len(data) == entry['source_bytes'], 'Source art size mismatch: ' + code
    assert data[:4] == b'RIFF' and data[8:12] == b'WEBP', 'Not WebP: ' + code
    if not target.exists():
        temporary = target.with_suffix('.webp.part')
        temporary.write_bytes(data)
        temporary.replace(target)
    return code, dict(entry, sha256=hashlib.sha256(data).hexdigest(), bytes=len(data))

if __name__ == '__main__':
    entries = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        for i, (code, entry) in enumerate(pool.map(fetch, SOURCE['images'].items()), 1):
            entries[code] = entry
            if i % 50 == 0:
                print('Verified art', i, flush=True)
    result = dict(source_repository=SOURCE['repository'], source_commit=SOURCE['commit'], images=entries)
    (ROOT / 'library/assets.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print('Verified art', len(entries), 'bytes', sum(e['bytes'] for e in entries.values()), flush=True)
