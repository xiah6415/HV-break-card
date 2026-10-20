const assert = require('node:assert/strict');
const E = require('./engine.js');
const STOP = Symbol('stop after receive check');
function fixture(choose = async (g, p, r) => r.options[0].value) {
  const g = new E.Game({ seed: 7, decks: ['hk_axis', 'seijoh'], agents: [{ wantsAck: true, choose }, E.AI] });
  const p = g.players[0];
  g.beginTurn(p); g.ball = { type: 'serve', off: 1 };
  p.deck = []; p.hand = []; return { g, p };
}
const available = (g, p, timing) => g.playable(p, timing).map(x => x.card);
async function toSetter(g, p) {
  await assert.rejects(g.receiveTurn(p), error => error === STOP);
}
(async () => {
  const { g, p } = fixture();
  p.hand = ['PR-029', 'PR-029', 'P03-090', 'P03-057'];
  p.drop = ['P01-002']; p.ev = ['P01-078'];
  assert.deepEqual(available(g,p,'drw').filter(c=>c!=='P03-057'), available(g,p,'rcv'));
  assert(available(g,p,'drw').includes('P03-057'));assert(!available(g,p,'rcv').includes('P03-057'));
  assert.equal(available(g, p, 'rcv').filter(x => x === 'PR-029').length, 1);
  for (const timing of ['srv', 'tos', 'atk', 'blk']) assert.deepEqual(available(g, p, timing), []);
  p.restrict.no_add = 1;
  assert.deepEqual(available(g, p, 'rcv'), [], 'draw-phase character skill cannot activate at receive');
  p.restrict = {}; p.ts.used['P03-090'] = 1; p.ts.kurokawa = 1;
  assert.deepEqual(available(g, p, 'rcv'), ['PR-029','P03-090'], 'used Event may be placed with its skill invalid');
  g.moveCode(p.drop,p.deck,'P01-002'); assert.deepEqual(available(g, p, 'rcv'), ['P03-090'], 'retrieve needs a target, but used Event may still be placed');

  // Skip the draw event window, then actually recover a setter before the receive check.
  const seen = [];
  const flow = fixture(async (game, player, req) => {
    seen.push([req.kind, req.timing]);
    if (req.kind === 'ack') return true;
    if (req.kind === 'retrieve') return req.options.find(o => o.value)?.value ?? null;
    if (req.kind === 'receiver') return 'D01-005';
    if (req.kind === 'event') {
      if (req.timing === 'drw') return null;
      assert.equal(req.timing, 'rcv');
      assert.match(req.prompt, /接球判定前/);
      return req.options.some(o => o.value === 'PR-029') ? 'PR-029' : null;
    }
    if (req.kind === 'setter') {
      assert(req.options.some(o => o.value === 'P01-006'), 'recovered setter must be usable this turn');
      throw STOP;
    }
    throw new Error('unexpected request: ' + req.kind);
  });
  flow.p.hand = ['D01-005', 'PR-029']; flow.p.drop = ['P01-006']; flow.p.deck = ['D01-012'];
  await toSetter(flow.g, flow.p);
  assert.deepEqual(seen.slice(0, 4), [['ack', undefined], ['event', 'drw'], ['receiver', undefined], ['event', 'rcv']]);
  assert(flow.p.hand.includes('P01-006')); assert(!flow.p.drop.includes('P01-006'));
  assert(flow.p.ev.includes('PR-029')); assert.equal(flow.p.deck.length, 0);
  assert.equal(seen.filter(x => x[0] === 'ack').length, 1, 'one normal draw per receive turn');

  // Only early draw-phase activation watches subsequent entries; receive cannot activate retroactively.
  let cases = 0;
  for (const receiver of ['PR-022', 'PR-057', 'D01-005', 'P01-039']) {
    for (const reduction of [0, 3]) {
      const values = [];
      for (const timing of ['drw', 'rcv']) {
        const f = fixture(async (game, player, req) => {
          if (req.kind === 'ack') return true;
          if (req.kind === 'receiver') return receiver;
          if (req.kind === 'name') return '西谷 夕';
          if (req.kind === 'skill') return false;
          if (req.kind === 'rulesChoice') return req.options[0].value;
          if (req.kind === 'event') return req.timing === timing && req.options.some(o => o.value === 'P03-057') ? 'P03-057' : null;
          if (req.kind === 'setter') throw STOP;
          throw new Error('unexpected request: ' + req.kind);
        });
        f.p.hand = [receiver, 'P03-057', 'P01-006']; f.p.restrict.rcv_minus = reduction;
        f.g.ball.off = -10; // Reach the comparison even when an ineligible receiver is reduced below zero.
        await toSetter(f.g, f.p);
        assert.equal(f.p.drop.filter(c => c === 'P03-057').length, timing==='drw'?1:0);
        values.push(f.p.ts.rcv);
      }
      const eligible=['PR-022','PR-057','D01-005'].includes(receiver);
      assert.equal(values[0]-values[1],eligible?2+reduction:0,`${receiver}: actual future entry only`);
      cases++;
    }
  }
  const recovery = fixture();
  recovery.p.hand = ['P03-090']; recovery.p.ev = ['D01-012'];
  await recovery.g.resolve(recovery.p, 'P03-090', 'rcv');
  assert(recovery.p.hand.includes('D01-012'));
  recovery.g.moveCode(recovery.p.ev,recovery.p.hand,'P03-090');
  assert(available(recovery.g, recovery.p, 'rcv').includes('P03-090'));
  const deckBefore=recovery.p.deck.length;await recovery.g.resolve(recovery.p,'P03-090','rcv');assert.equal(recovery.p.deck.length,deckBefore);assert(recovery.p.hand.includes('D01-012'));
  console.log(`event timing: eligibility, restrictions, late retrieval, one draw, and ${cases} canonical draw-only skill comparisons passed`);
})().catch(error => { console.error(error); process.exit(1); });
