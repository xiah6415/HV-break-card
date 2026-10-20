const assert = require('node:assert/strict');
const E = require(process.env.RULES_ENGINE_PATH || './engine');
const STOP = Symbol('stop at next phase');
const total = p => p.hand.length + p.deck.length + p.drop.length + p.ev.length + p.sets.length + Object.values(p.area).reduce((n, a) => n + a.length, 0) + (p.ts.sides || []).length;
function fixture(choose = async (g, p, r) => r.kind === 'retrieve' ? null : r.kind === 'event' ? null : r.options[0].value) {
  const g = new E.Game({ seed: 7, decks: ['k1014', 'seijoh'], agents: [{ wantsAck: true, choose }, E.AI] });
  const p = g.players[0]; g.beginTurn(p); p.deck = []; g.ball = { type: 'serve', off: 1 };
  return { g, p };
}
let failed = 0, passed = 0;
async function check(name, run) {
  try { await run(); passed++; console.log('PASS', name); }
  catch (error) { failed++; console.error('FAIL', name, error.message); }
}
(async () => {
  await check('Kuro preview equals receive value, including dual-year PR-057 and immunity', async () => {
    const { g, p } = fixture(); p.ts.kurokawa = 1; p.restrict.rcv_minus = 1;
    assert.equal(g.rcvPreview(p, 'PR-022'), '7'); assert.equal(g.rcvPreview(p, 'PR-057'), '7');
    assert.equal(g.rcvPreview(p, 'P01-004'), '4');
  });
  await check('PR-029 can recover zero even when each name has exactly one candidate', async () => {
    const { g, p } = fixture(); p.hand = ['PR-029']; p.drop = ['P01-002', 'P01-006'];
    await g.resolve(p, 'PR-029', 'drw');
    assert.deepEqual(p.hand, []); assert.deepEqual(p.drop, ['P01-002', 'P01-006']);
    assert.deepEqual(p.ev, ['PR-029']);
  });
  await check('P02-001 pays three Guts and gains six even if optional recovery is declined', async () => {
    const { g, p } = fixture(async (g, p, r) => {
      if (r.kind === 'setter') throw STOP;
      if (r.kind === 'retrieve' || r.kind === 'event') return null;
      return r.kind === 'receiver' ? 'P02-001' : true;
    });
    p.hand = ['P02-001', 'P01-006']; p.area.receive = ['P01-004', 'P01-013', 'P01-003'];
    p.sets = []; p.opp.sets = ['P01-033'];
    await assert.rejects(g.receiveTurn(p), error => error === STOP);
    assert.equal(p.ts.rcv, 6); assert.equal(p.guts('receive'), 0);
    assert.deepEqual(p.drop, ['P01-004', 'P01-013', 'P01-003']);
  });
  await check('Kageyama may decline the revealed card; it goes to bottom and the attack bonus still applies', async () => {
    const { g, p } = fixture(async (g, p, r) => {
      if (r.kind === 'attacker') throw STOP;
      if (r.kind === 'event' || r.kind === 'retrieve') return null;
      return r.kind === 'receiver' ? 'D01-005' : r.kind === 'setter' ? 'P01-006' : true;
    });
    p.hand = ['D01-005', 'P01-006', 'P01-004']; p.deck = ['D01-012', 'P01-002', 'P01-013'];
    p.area.toss = ['D01-009', 'P01-011'];
    await assert.rejects(g.receiveTurn(p), error => error === STOP);
    assert(!p.hand.includes('P01-002')); assert.deepEqual(p.deck, ['P01-002', 'D01-012']);
    assert.equal(p.ts.hin, 2); assert.equal(p.guts('toss'), 0);
  });
  await check('P03-086 may pay its bottom-deck cost with zero recovered events', async () => {
    const { g, p } = fixture(); p.hand = ['P03-086']; p.ts.setter = 'P01-006'; p.ts.toss = 1;
    await g.resolve(p, 'P03-086', 'tos');
    assert.equal(p.ts.toss, 2); assert.deepEqual(p.ev, []); assert.deepEqual(p.deck, ['P03-086']);
  });
  await check('Open Attack can draw/discard with a Hinata setter, but cannot summon same-name Hinata', async () => {
    const { g, p } = fixture(async (g, p, r) => r.options[0].value);
    p.hand = ['P01-078', 'D01-005', 'P01-006']; p.deck = ['P01-013', 'P01-011']; p.drop = ['P01-002'];
    p.ts.setter = 'P01-004'; p.ts.attacker = 'D01-009'; p.ts.atk = 3;
    p.area.toss = ['P01-004']; p.area.attack = ['D01-009'];
    assert(g.playable(p, 'atk').some(x => x.card === 'P01-078'));
    await g.resolve(p, 'P01-078', 'atk');
    assert.equal(p.ts.attacker, 'D01-009'); assert(p.drop.includes('P01-002'));
    assert.equal(p.hand.length, 3); assert.equal(p.deck.length, 0);
  });
  await check('free step accepts thirteen legal hand skills without an arbitrary twelve-action cutoff', async () => {
    const { g, p } = fixture(async (g, p, r) => r.kind === 'target' ? 'receive' : r.options.find(x => x.value === 'P01-013')?.value ?? null);
    p.hand = Array(13).fill('P01-013'); p.deck = Array(26).fill('D01-005'); p.area.receive = ['P01-004'];
    p.ts.receiver = 'P01-004'; p.ts.rcv = 5;
    await g.eventLoop(p, 'rcv', {});
    assert.equal(p.hand.length, 0); assert.equal(p.ts.rcv, 31); assert.equal(total(p), 40);
  });
  await check('Loss while paying block skill cost moves side blockers to drop exactly once', async () => {
    const g = new E.Game({ seed: 12, decks: ['k1014', 'seijoh'], agents: [{ wantsAck: true, async choose(g, p, r) {
      if (r.kind === 'mulligan') return [];
      if (r.kind === 'defend') return 'block';
      if (r.kind === 'block') return { cards: ['P02-003', 'PR-043'], center: 'P02-003' };
      if (r.kind === 'cost') return { __loss: true };
      return true;
    } }, E.AI], onNotice(notice) {
      if (notice.type !== 'loss') return;
      const p = g.players[0];
      assert.equal(notice.player, 0); assert.equal(p.top('block'), 'P02-003');
      assert.equal(p.drop.filter(x => x === 'PR-043').length, 1);
      assert.equal(total(p), 40); throw STOP;
    } });
    g.serveTurn = async server => {
      assert.equal(server.idx, 1); g.beginTurn(server);
      for (const p of g.players) {
        const pool = Object.entries(E.DECKS[p.deckKey].cards).flatMap(([c, n]) => Array(n).fill(c));
        p.hand = p.idx === 0 ? ['P02-003', 'PR-043', 'D01-012'] : [];
        p.ev = p.idx === 1 ? ['P01-087', 'P01-087'] : [];
        for (const c of [...p.hand, ...p.ev]) pool.splice(pool.indexOf(c), 1);
        p.sets = [pool.pop(), pool.pop()]; p.deck = pool; p.drop = [];
        p.area = { serve: [], block: [], receive: [], toss: [], attack: [] };
      }
      delete g.cardState; // The fixture replaces the whole post-setup layout, before testing real movement.
      return { type: 'attack', off: 9 };
    };
    await assert.rejects(g.run(), error => error === STOP);
  });
  console.log(`rules audit: ${passed} passed, ${failed} failed`);
  if (failed) process.exitCode = 1;
})().catch(error => { console.error(error); process.exit(1); });
