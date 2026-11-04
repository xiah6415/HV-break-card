"""Version changes must create new URLs and keep the old immutable files."""
import json
import tempfile
from pathlib import Path
from PIL import Image
from library.render_assets import build_render_assets, digest
with tempfile.TemporaryDirectory() as temp:
    root=Path(temp)
    (root/'library').mkdir();(root/'img').mkdir()
    source=root/'img/A.webp'
    Image.new('RGB',(744,1039),'red').save(source,'WEBP',quality=95)
    (root/'library/assets.json').write_text(json.dumps({'images':{'A':{'file':'img/A.webp'}}}))
    first=build_render_assets(root)['A']
    assert first['width']==320 and first['height']>first['width']
    assert first==build_render_assets(root)['A']
    assert source.read_bytes()==(root/first['full']).read_bytes()
    assert digest((root/first['thumb']).read_bytes())==first['thumb_sha256']
    Image.new('RGB',(744,1039),'blue').save(source,'WEBP',quality=95)
    second=build_render_assets(root)['A']
    assert first['full']!=second['full'] and first['thumb']!=second['thumb']
    assert (root/first['full']).exists() and (root/first['thumb']).exists()
    assert second['source_sha256'][:16] in second['full']
    assert second['thumb_sha256'][:16] in second['thumb']
print('render assets: stable builds, new art changes both URLs, old versions preserved, full byte identity and thumbnail dimensions passed')
