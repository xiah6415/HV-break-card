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
console.log('deck-tools: all tests passed');
