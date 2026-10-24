import base64, json, subprocess
from library.build import write_library
from rules.build_runtime import write_runtime
library = write_library()
runtime = write_runtime()
subprocess.run(['node', 'rules/build-pilot.js'], check=True)
native = '\n'.join(open(f).read() for f in ['pilot-runtime.js','host-choice.js','choice-ui.js'])
ui = open('ui.html').read(); decktools = open('deck-tools.js').read()
# Legacy engine stays a Node regression oracle; only static presentation data
# are imported at build time. The public page contains no old Game or bridge.
table_data = subprocess.check_output(['node','-e',"const E=require('./engine');process.stdout.write(JSON.stringify({DEF:E.DEF,DECKS:E.DECKS}))"], text=True)
open('online-decks.json','w').write(json.dumps(json.loads(table_data)['DECKS'], ensure_ascii=False))
eng = 'window.BreakTableData=' + table_data.replace('<','\\u003c') + ';\n' + open('table-data.js').read()
assets = json.load(open('library/assets.json'))['images']
imgs = {code: ('data:image/webp;base64,' + base64.b64encode(open(a['file'], 'rb').read()).decode() if a['origin'] == 'legacy_preserved' else a['file']) for code, a in assets.items()}
support = json.load(open('card-support.json'))
assert all('</script' not in script for script in [eng, decktools, native])
out = ui.replace('/*NATIVE*/', native).replace('/*ENGINE*/', eng).replace('/*DECKTOOLS*/', decktools).replace('/*SUPPORT*/', 'window.BREAK_SUPPORT = ' + json.dumps(support).replace('<', '\\u003c') + ';').replace('/*IMAGES*/', 'window.CARD_IMG = ' + json.dumps(imgs) + ';')
open('index.html', 'w').write(out)
print('images', len(imgs), 'size', len(out))
