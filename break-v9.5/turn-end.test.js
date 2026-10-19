const assert = require('node:assert/strict');
const E = require('./engine');
const flush = () => new Promise(resolve => setImmediate(resolve));
const snapshot = g => JSON.stringify({
  turn: g.turnNo, rally: g.rallyNo, owner: g.turnP.idx, server: g.server, ball: g.ball,
  players: g.players.map(p => ({ hand: p.hand, deck: p.deck, drop: p.drop, ev: p.ev, area: p.area, sets: p.sets, ts: p.ts }))
});
(async () => {
  let endResolve, lossResolve, reachedEnd, reachedLoss, armed = false;
  const end = new Promise(resolve => { reachedEnd = resolve; });
  const loss = new Promise(resolve => { reachedLoss = resolve; });
  const STOP = Symbol('stop before interval');
  const seen = new Set();
  const human = { wantsAck: true, async choose(g, p, req) {
    if (req.kind === 'turnEnd') {
      assert.equal(req.canLoss, true); assert.equal(g.turnP, p);
      seen.add(req.outgoing.type);
      if (req.outgoing.type === 'attack') {
        assert(p.ts.receiver && p.ts.setter && p.ts.attacker);
        assert(p.ts.rcv >= g.ball.off, 'this is a successful receive, toss and attack');
        assert.equal(req.outgoing.off, p.ts.toss + p.ts.atk);
        armed = true; reachedEnd(req);
        return new Promise(resolve => { endResolve = resolve; });
      }
    }
    assert(!(armed && req.kind === 'lossConfirm'), 'voluntary Loss after attack must not ask again');
    return req.kind === 'mulligan' ? [] : req.kind === 'guts' ? req.options.slice(0, req.need).map(x => x.value) : E.AI.choose(g, p, req);
  } };
  const g = new E.Game({ seed: 7, decks: ['k1014', 'seijoh'], agents: [human, E.AI], async onNotice(notice) {
    if (armed) {
      assert.equal(notice.type, 'loss', 'AI must not get a new turn when the player chooses Loss instead of ending');
      reachedLoss(notice);
      await new Promise(resolve => { lossResolve = resolve; });
      throw STOP;
    }
  } });
  const done = g.run().catch(error => { if (error !== STOP) throw error; });
  await end;
  const before = snapshot(g);
  await flush(); await flush();
  assert.equal(snapshot(g), before, 'completed attack must stay on the player turn until explicit end');
  const rally = g.rallyNo, sets = g.players[0].sets.length;
  endResolve({ __loss: true });
  const notice = await loss;
  assert.equal(notice.player, 0); assert.match(notice.reason, /主動 Loss/);
  assert.equal(g.rallyNo, rally); assert.equal(g.players[0].sets.length, sets);
  assert.equal(snapshot(g), before, 'Loss must preserve every played card until the interval is confirmed');
  assert(seen.has('serve') && seen.has('attack'));
  lossResolve(); await done;
  console.log('turn end: successful receive/toss/attack waits; Loss remains legal; no AI handoff or duplicate confirmation; played cards preserved');
})().catch(error => { console.error(error); process.exit(1); });
