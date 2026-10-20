const assert = require('node:assert/strict');
const E = require('./engine');
const STOP = Symbol('entry skill resolved');
function fixture() {
  const g = new E.Game({ seed: 1, decks: ['k1014', 'seijoh'], agents: [{ wantsAck: true, async choose(g, p, r) {
    if (r.kind === 'receiver') return p.hand.find(c => E.st(c, 'rcv') != null);
    if (r.kind === 'guts') return r.options.slice(0,r.need).map(o=>o.value);
    if (r.kind === 'rulesChoice') return r.options[0].value;
    if (r.kind === 'target') return 'attack';
    if (r.kind === 'discard') return r.options[0].value;
    if (r.kind === 'event' || r.kind === 'retrieve') return null;
    return true;
  } }, E.AI] });
  const p = g.players[0]; g.beginTurn(p); p.hand = []; p.deck = []; g.ball = { type: 'serve', off: 1 };
  g.eventLoop = async (p, timing) => { if (timing === 'rcv') throw STOP; };
  return { g, p };
}
(async () => {
  { const { g, p } = fixture(); p.hand = ['D01-005']; p.deck = ['P01-002', 'P01-004']; p.area.receive = ['P01-013', 'P01-003', 'P01-006'];
    await assert.rejects(g.receiveTurn(p), error => error === STOP);
    assert.equal(p.ts.rcv, 7); assert.equal(p.guts('receive'), 0); assert.equal(p.drop.length, 3); assert.equal(p.hand.length, 2);
  }
  { const { g, p } = fixture(); p.hand = ['P01-002']; p.area.attack = ['P01-013', 'P01-003', 'P01-006'];
    await g.enterAttack(p, 'P01-002', false);
    assert.equal(p.ts.atk, 5); assert.equal(p.drop.length, 3); assert.equal(p.opp.pending.no_rcv6, 1);
    g.beginTurn(p.opp); assert.equal(p.opp.restrict.no_rcv6, 1); g.beginTurn(p.opp); assert(!p.opp.restrict.no_rcv6);
  }
  { const { g, p } = fixture(); p.hand = ['BP-002', 'P01-013']; await g.enterAttack(p, 'BP-002', false);
    assert.equal(p.ts.atk, 4); assert.deepEqual(p.drop, ['P01-013']);
  }
  { const { g, p } = fixture(); p.hand = ['D04-002']; p.ts.setter = 'D04-003'; p.sets = []; p.opp.sets = ['D01-005']; p.area.attack = ['P01-033', 'P01-035'];
    await g.enterAttack(p, 'D04-002', false); assert.equal(p.ts.atk, 5); assert.equal(p.drop.length, 2);
  }
  { const { g, p } = fixture(); p.hand = ['P01-035', 'D04-003']; p.opp.hand = Array(4).fill('D01-005'); p.opp.deck = ['P01-002'];
    await g.enterAttack(p, 'P01-035', false); assert.equal(p.ts.atk, 4); assert.deepEqual(p.drop, ['D04-003']);
    g.beginTurn(p.opp); const size = p.opp.hand.length;
    assert.equal(g.sdraw(p.opp, 1), 0); assert.equal(p.opp.hand.length, size); assert.equal(g.draw(p.opp, 1), 1);
  }
  { const { g, p } = fixture(); p.hand = ['P04-088', 'P04-088']; p.deck = ['P01-013']; p.area.attack=['D04-002']; p.ts.attacker = 'D04-002'; p.ts.atk = 7;
    await g.resolve(p, 'P04-088', 'atk'); assert.equal(p.ts.atk, 8); assert.equal(g.sharedRulesState.effects.filter(e=>e.event==='character_entry').length,1);assert(!p.opp.pending.rcv_minus);
    assert(!g.playable(p, 'atk').some(x => x.card === 'P04-088'));
  }
  { const { g, p } = fixture(); p.hand = ['P01-039', 'D04-010']; p.deck = ['D04-003', 'P04-026']; g.ball.off = 6;
    await assert.rejects(g.receiveTurn(p), error => error === STOP);
    assert.equal(p.ts.rcv, 6); assert.deepEqual(p.drop, ['D04-010']); assert.equal(p.hand.length, 2);
  }
  for (const [type, off, receive, draws] of [['serve', 1, 5, 1], ['serve', 6, 7, 0], ['attack', 1, 5, 0], ['attack', 6, 5, 0]]) {
    const { g, p } = fixture(); p.hand = ['P03-046']; p.deck = ['P01-002', 'P01-004']; g.ball = { type, off };
    await assert.rejects(g.receiveTurn(p), error => error === STOP);
    assert.equal(p.ts.rcv, receive); assert.equal(p.hand.length, 1 + draws);
  }
  console.log('skill basics: D01-005, P01-002, BP-002, D04-002, P01-035, P04-088 and four P03-046 scenarios passed');
})().catch(error => { console.error(error); process.exit(1); });
