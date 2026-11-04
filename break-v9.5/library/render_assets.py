"""Content-addressed card art for immutable caching. Preserve all older URLs."""
import hashlib
import json
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageOps
ROOT = Path(__file__).resolve().parent.parent
TRANSFORM = 'webp-320-q76-m6-v1'
def digest(data):
    return hashlib.sha256(data).hexdigest()
def build_render_assets(root=ROOT):
    root = Path(root)
    assets = json.loads((root / 'library/assets.json').read_text())['images']
    manifest = root / 'library/render-assets.json'
    previous = json.loads(manifest.read_text()).get('images', {}) if manifest.exists() else {}
    output = {}
    for code, asset in assets.items():
        data = (root / asset['file']).read_bytes()
        source_hash = digest(data)
        full = f'img/render/full/{code}.{source_hash[:16]}.webp'
        full_path = root / full
        full_path.parent.mkdir(parents=True, exist_ok=True)
        if full_path.exists():
            assert full_path.read_bytes() == data, 'Immutable full image collision'
        else:
            full_path.write_bytes(data)
        old = previous.get(code, {})
        thumb = root / old.get('thumb', '__missing__')
        if (old.get('source_sha256') == source_hash and old.get('transform') == TRANSFORM
                and thumb.is_file() and digest(thumb.read_bytes()) == old.get('thumb_sha256')):
            output[code] = old
            continue
        with Image.open(BytesIO(data)) as original:
            image = ImageOps.exif_transpose(original).convert('RGB')
            image.thumbnail((320, 10000), Image.Resampling.LANCZOS)
            encoded = BytesIO()
            image.save(encoded, 'WEBP', quality=76, method=6)
            small = encoded.getvalue()
            # Never make a thumbnail more expensive than its original.
            if len(small) >= len(data) and original.width <= 320:
                small = data
            width, height = image.size
        thumb_hash = digest(small)
        thumb = f'img/render/thumb/{code}.{thumb_hash[:16]}.webp'
        target = root / thumb
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            assert target.read_bytes() == small, 'Immutable thumbnail collision'
        else:
            target.write_bytes(small)
        output[code] = dict(full=full, thumb=thumb, source_sha256=source_hash,
                            thumb_sha256=thumb_hash, transform=TRANSFORM,
                            full_bytes=len(data), thumb_bytes=len(small), width=width, height=height)
    manifest.write_text(json.dumps({'version': 1, 'images': output}, ensure_ascii=False, indent=2) + '\n')
    return output
if __name__ == '__main__':
    rows = build_render_assets()
    print('card assets', len(rows), 'full', sum(r['full_bytes'] for r in rows.values()),
          'thumb', sum(r['thumb_bytes'] for r in rows.values()))
