import base64, json
from library.build import write_library
from rules.build_runtime import write_runtime
library = write_library()
runtime = write_runtime()
ui = open('ui.html').read(); eng = open('engine.js').read(); decktools = open('deck-tools.js').read(); undotools = open('undo-tools.js').read()
rules = '\n'.join(open('rules/' + f).read() for f in ['core.js', 'decisions.js', 'identity.js', 'lifecycle.js']) + '\nwindow.BreakRulesData=' + json.dumps(runtime, ensure_ascii=False).replace('<', '\\u003c') + ';\n' + open('rules/legacy.js').read()
assets = json.load(open('library/assets.json'))['images']
imgs = {code: ('data:image/webp;base64,' + base64.b64encode(open(a['file'], 'rb').read()).decode() if a['origin'] == 'legacy_preserved' else a['file']) for code, a in assets.items()}
library_script = 'window.BREAK_LIBRARY=' + json.dumps(library, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c') + ';\n' + open('card-library.js').read()
support = json.load(open('card-support.json'))
assert all('</script' not in script for script in [eng, decktools, undotools, rules, library_script])
eng = library_script + '\n' + rules + '\n' + eng
out = ui.replace('/*ENGINE*/', eng).replace('/*DECKTOOLS*/', decktools).replace('/*UNDOTOOLS*/', undotools).replace('/*SUPPORT*/', 'window.BREAK_SUPPORT = ' + json.dumps(support).replace('<', '\\u003c') + ';').replace('/*IMAGES*/', 'window.CARD_IMG = ' + json.dumps(imgs) + ';')
open('index.html', 'w').write(out)
print('images', len(imgs), 'size', len(out))
