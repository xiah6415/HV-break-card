import base64, json, os
ui = open('ui.html').read(); eng = open('engine.js').read(); decktools = open('deck-tools.js').read()
imgs = {f[:-5]: 'data:image/webp;base64,' + base64.b64encode(open('img/' + f, 'rb').read()).decode() for f in sorted(os.listdir('img')) if f.endswith('.webp')}
assert '</script' not in eng and '</script' not in decktools
out = ui.replace('/*ENGINE*/', eng).replace('/*DECKTOOLS*/', decktools).replace('/*IMAGES*/', 'window.CARD_IMG = ' + json.dumps(imgs) + ';')
open('index.html', 'w').write(out)
print('images', len(imgs), 'size', len(out))
