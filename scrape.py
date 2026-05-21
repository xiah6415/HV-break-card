import sys, io, re, json, time
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import requests
from bs4 import BeautifulSoup

BASE = 'https://www.hashtagmrboard.com'

ARTICLES = [
    '/blog/posts/hv-pr-promo',
    '/blog/posts/hv-d01-haikyu-baboka-break-hv-cn-translate',
    '/blog/posts/hv-d02-haikyu-baboka-break-hv-cn-translate',
    '/blog/posts/hv-d03-inarizaki-high-school',
    '/blog/posts/hv-p01-haikyu-baboka-break-hv-p01-karasunohigh-cn-translate',
    '/blog/posts/hv-p01-haikyu-baboka-break-hv-p01-nekoma-high-cn-translate',
    '/blog/posts/hv-p01-haikyu-baboka-break-hv-p01-seijoh-cn-translate',
    '/blog/posts/hv-p01-haikyu-baboka-break-hv-p01-otherhigh-cn-translate',
    '/blog/posts/hv-p01-haikyu-baboka-break-hv-p01-event-cn-translate',
    '/blog/posts/hv-p01-haikyu-baboka-break-hv-p02--inarizaki-high-school-cn-translate',
    '/blog/posts/hv-p02-haikyu-baboka-break-hv-p01-karasunohigh-cn-translate',
    '/blog/posts/hv-p02-date-kogyo-high-school',
    '/blog/posts/hv-p02-shiratorizawa',
    '/blog/posts/hv-p02-other-high-school',
    '/blog/posts/hv-p03-1',
    '/blog/posts/hv-p03-2',
    '/blog/posts/hv-p03-3',
    '/blog/posts/new-deck-share-01',
    '/blog/posts/new-deck-share-02',
]

# 角色卡：有位置欄位
CARD_RE = re.compile(
    r'(HV-\S+-\d+\w*)\s+(\S+)\s+所[属屬][:：]\s*(.+?)\s+位置[:：]\s*(\S+)\s*(.*?)(?:收錄於[:：]\s*(.+))?$',
    re.DOTALL
)
# 事件卡：無位置欄位
EVENT_RE = re.compile(
    r'(HV-\S+-\d+\w*)\s+(\S+)\s+所[属屬][:：]\s*(\S+)\s+(.*)',
    re.DOTALL
)

def scrape(path):
    url = BASE + path
    r = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
    r.encoding = 'utf-8'
    soup = BeautifulSoup(r.text, 'html.parser')
    content = soup.find(class_='Post-content')
    if not content:
        return []
    fig = content.find('figure', class_='table')
    if not fig:
        return []
    cards = []
    for row in fig.find('table').find_all('tr'):
        cells = row.find_all(['td', 'th'])
        if len(cells) < 2:
            continue
        imgs = cells[0].find_all('img')
        if not imgs:
            continue
        text = cells[1].get_text(separator=' ', strip=True)
        m = CARD_RE.match(text)
        if m:
            cards.append({
                'number':   m.group(1),
                'rarity':   m.group(2),
                'school':   m.group(3),
                'position': m.group(4),
                'effect':   m.group(5).strip(),
                'source':   (m.group(6) or '').strip(),
                'image':    imgs[0]['src'].split('?')[0],
                'type':     'character',
            })
        else:
            m = EVENT_RE.match(text)
            if m:
                cards.append({
                    'number':   m.group(1),
                    'rarity':   m.group(2),
                    'school':   m.group(3),
                    'position': '事件',
                    'effect':   m.group(4).strip(),
                    'source':   '',
                    'image':    imgs[0]['src'].split('?')[0],
                    'type':     'event',
                })
    return cards

all_cards = []
seen = set()
for path in ARTICLES:
    print(f'  {path}')
    try:
        cards = scrape(path)
        new = [c for c in cards if c['number'] not in seen]
        seen.update(c['number'] for c in new)
        all_cards.extend(new)
        print(f'    +{len(new)} cards (skipped {len(cards)-len(new)} dupes)')
    except Exception as e:
        print(f'    ERROR: {e}')
    time.sleep(1)

all_cards.sort(key=lambda c: c['number'])
with open('cards.json', 'w', encoding='utf-8') as f:
    json.dump(all_cards, f, ensure_ascii=False, indent=2)
print(f'\nTotal: {len(all_cards)} cards → cards.json')
