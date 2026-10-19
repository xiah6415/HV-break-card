/* BREAK v9: deck input/validation. UMD, no runtime dependencies. */
(function(root) {
'use strict';
function normalCode(s) {
  if (typeof s !== 'string') throw Error('卡號必須是文字');
  return s.trim().replace(/^HV-/i, '').replace(/\.webp$/i, '');
}
function parseDeck(source, defs) {
  const input = typeof source === 'string' ? JSON.parse(source) : source;
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('牌組格式必須是物件');
  let pairs;
  if (Array.isArray(input.c)) pairs = input.c;
  else if (input.cards && typeof input.cards === 'object' && !Array.isArray(input.cards)) pairs = Object.entries(input.cards);
  else throw Error('找不到 c 或 cards 牌組清單');
  const cards = Object.create(null);
  for (const item of pairs) {
    if (!Array.isArray(item) || item.length !== 2) throw Error('每筆卡片須為 [卡號, 張數]');
    const code = normalCode(item[0]), count = item[1];
    if (!Object.prototype.hasOwnProperty.call(defs, code)) throw Error('尚未收錄卡片：' + code);
    if (!Number.isSafeInteger(count) || count < 1 || count > 40) throw Error('張數無效：' + code);
    cards[code] = (cards[code] || 0) + count;
  }
  let total = 0, events = 0;
  for (const [code, n] of Object.entries(cards)) {
    total += n;
    if (defs[code][1] === 'E') events += n;
  }
  if (total !== 40) throw Error('牌組必須 40 張，目前 ' + total + ' 張');
  if (events > 8) throw Error('Event 最多 8 張，目前 ' + events + ' 張');
  return { name: String(input.n || input.name || '自訂牌組').slice(0, 60), cards: {...cards} };
}
function exportDeck(deck) { return JSON.stringify({ n: deck.name, c: Object.entries(deck.cards) }, null, 2); }
const api = { normalCode, parseDeck, exportDeck };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.BreakDeckTools = api;
})(typeof window !== 'undefined' ? window : globalThis);
