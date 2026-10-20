const E = require('./engine.js');
const Rand = { label: 'R', async choose(g, p, req) { const o = req.options; if (req.multi) return o.filter(() => Math.random() < 0.4).map(x => x.value); return o[Math.floor(Math.random() * o.length)].value; } };
(async () => {
  const decks = Object.keys(E.DECKS); let n = 0, rallies = 0;
  for (let s = 0; s < 3000; s++) {
    const a = decks[s % decks.length], b = decks[(s * 7 + 3) % decks.length];
    const g = new E.Game({ seed: s, decks: [a, b], agents: [s % 2 ? Rand : E.AI, Rand] });
    await g.run(); n++; rallies += g.rallyNo;
    const physical = g.cardSnapshot();
    if (Object.keys(physical.cards).length !== 80) throw new Error('Physical identity conservation failed');
    // invariants: card count conservation
    for (const p of g.players) {
      const total = p.deck.length + p.hand.length + p.drop.length + p.ev.length + p.sets.length + Object.values(p.area).reduce((x, y) => x + y.length, 0);
      if (total !== 40) { console.log('COUNT MISMATCH', a, b, s, total); process.exit(1); }
    }
  }
  console.log('ok games', n, 'avg rallies', (rallies / n).toFixed(2));
})().catch(e => { console.error(e); process.exit(1); });
