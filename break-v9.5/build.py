import base64, json, os
from rules.build_runtime import write_runtime
runtime = write_runtime()
ui = open('ui.html').read(); eng = open('engine.js').read(); decktools = open('deck-tools.js').read(); undotools = open('undo-tools.js').read()
rules = '\n'.join(open('rules/' + f).read() for f in ['core.js', 'decisions.js']) + '\nwindow.BreakRulesData=' + json.dumps(runtime, ensure_ascii=False).replace('<', '\\u003c') + ';\n' + open('rules/legacy.js').read()
imgs = {f[:-5]: 'data:image/webp;base64,' + base64.b64encode(open('img/' + f, 'rb').read()).decode() for f in sorted(os.listdir('img')) if f.endswith('.webp')}
support = json.load(open('card-support.json'))
assert all('</script' not in script for script in [eng, decktools, undotools, rules])
eng = rules + '\n' + eng
out = ui.replace('/*ENGINE*/', eng).replace('/*DECKTOOLS*/', decktools).replace('/*UNDOTOOLS*/', undotools).replace('/*SUPPORT*/', 'window.BREAK_SUPPORT = ' + json.dumps(support).replace('<', '\\u003c') + ';').replace('/*IMAGES*/', 'window.CARD_IMG = ' + json.dumps(imgs) + ';')
open('index.html', 'w').write(out)
print('images', len(imgs), 'size', len(out))
