const E = require('./engine.js');
async function one(seed, a, b) {
  const g = new E.Game({ seed, decks: [a, b], agents: [Object.assign({}, E.AI, { label: 'A' }), Object.assign({}, E.AI, { label: 'B' })] });
  const w = await g.run(); return w.idx === 0;
}
(async () => {
  const pairs = [['k1014', 'seijoh'], ['quick', 'seijoh'], ['k1014c', 'seijoh'], ['k1014', 'hk_axis'], ['k1010', 'k1014'], ['seijoh', 'seijoh']];
  const n = +process.argv[2] || 1000;
  for (const [a, b] of pairs) {
    let w = 0; const t0 = Date.now();
    for (let s = 0; s < n; s++) if (await one(s, a, b)) w++;
    console.log(a, 'vs', b, (w / n).toFixed(3), (Date.now() - t0) + 'ms');
  }
  // verbose sample
  const lines = [];
  const g = new E.Game({ seed: 7, decks: ['k1014', 'seijoh'], agents: [Object.assign({}, E.AI, { label: '你' }), Object.assign({}, E.AI, { label: 'AI' })], onLog: s => lines.push(s) });
  await g.run(); console.log(lines.slice(0, 60).join('\n'));
})().catch(e => { console.error(e); process.exit(1); });
