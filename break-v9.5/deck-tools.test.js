const assert = require('node:assert/strict');
const {DEF, DECKS} = require('./engine');
const {parseDeck, exportDeck, normalCode} = require('./deck-tools');
for (const deck of Object.values(DECKS)) {
  const parsed = parseDeck(exportDeck(deck), DEF);
  assert.deepEqual(parsed.cards, deck.cards);
  assert.deepEqual(parseDeck({n: deck.name, c: Object.entries(deck.cards).map(([c,n])=>['HV-'+c+'.webp',n])}, DEF).cards, deck.cards);
}
const base = JSON.parse(exportDeck(DECKS.k1014));
assert.throws(()=>parseDeck({...base,c:[['UNKNOWN',40]]},DEF), /尚未收錄/);
assert.throws(()=>parseDeck({...base,c:[['P01-002',39]]},DEF), /40 張/);
assert.throws(()=>parseDeck({...base,c:[['P01-078',9],['P01-002',31]]},DEF), /Event/);
assert.throws(()=>parseDeck({...base,c:[['P01-002',40.5]]},DEF), /張數無效/);
assert.equal(normalCode('HV-P01-002.webp'),'P01-002');
assert.equal(normalCode('HVBP-002.webp'),'BP-002');
assert.deepEqual(parseDeck({ n: 'official bonus code', c: [['HVBP-002',40]] }, DEF).cards, { 'BP-002': 40 });
console.log('deck-tools: all tests passed');

// ---------- 查卡網站分享連結（Claude 2026-10-20）
{
  const DT = require('./deck-tools'), CL = require('./card-library');
  const LZ = DT.LZString;
  const imageOf = code => CL.card(code).versions[0].images[0];
  // 模擬查卡網站 encodeDeck：c 用 image_file（含稀有度）
  const deck = DECKS.k1014;
  const payload = { n: '烏野1014 分享', c: Object.entries(deck.cards).map(([c, n]) => [imageOf(c), n]), k: { x: 1 } };
  const code = LZ.compressToEncodedURIComponent(JSON.stringify(payload));
  const url = 'https://weilun2022.github.io/haikyu-cards/?deck=' + code;
  for (const text of [url, '  ' + url + '  ', '?deck=' + code, code, url.replace(/\+/g, ' '), url + '&x=1', url.replace(code, encodeURIComponent(code))]) {
    const parsed = DT.parseShare(text, DEF);
    assert.deepEqual(parsed.cards, deck.cards);
    assert.equal(parsed.name, '烏野1014 分享');
  }
  // 舊格式：card_no
  assert.deepEqual(DT.parseShare(LZ.compressToEncodedURIComponent(JSON.stringify({ n: 'old', c: Object.entries(deck.cards).map(([c, n]) => ['HV-' + c, n]) })), DEF).cards, deck.cards);
  // 自家 encodeShare 往返
  assert.deepEqual(DT.parseShare(DT.encodeShare(deck), DEF).cards, deck.cards);
  // inspect：一次列出鎖定卡、張數
  const locked = Object.values(CL.data.cards).filter(c => !c.playable && c.kind === 'C').slice(0, 2);
  const bad = { n: 'x', c: [[imageOf(locked[0].code), 3], [locked[1].code, 2], ['P01-002', 30], ['NOPE-999', 1]] };
  const r = DT.inspectDeck(DT.decodeShare(LZ.compressToEncodedURIComponent(JSON.stringify(bad))), DEF);
  assert.equal(r.ok, false);
  assert.deepEqual(r.locked.map(l => [l.code, l.count]), [[locked[0].code, 3], [locked[1].code, 2]]);
  assert.equal(r.unknown.length, 1); assert.equal(r.total, 36);
  assert.ok(r.problems.some(p => /40 張/.test(p)) && r.problems.some(p => /尚未開放/.test(p)));
  assert.equal(DT.inspectDeck(payload, DEF).ok, true);
  // 壞輸入
  assert.throws(() => DT.decodeShare(''), /請貼上/);
  assert.throws(() => DT.decodeShare('https://weilun2022.github.io/haikyu-cards/'), /沒有 \?deck=/);
  assert.throws(() => DT.decodeShare('abc<>'), /不合法/);
  assert.throws(() => DT.decodeShare(code.slice(0, 20)), /解碼失敗|不是牌組/);
  console.log('deck-tools share: all tests passed');
}
