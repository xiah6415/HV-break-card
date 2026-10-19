const assert = require('node:assert/strict');
const E = require('./engine');
const { UndoSession } = require('./undo-tools');
const clone = value => JSON.parse(JSON.stringify(value));
const flush = () => new Promise(resolve => setImmediate(resolve));

function state(g, logs) {
  return clone({
    players: g.players.map(p => { const { g, agent, ...data } = p; return data; }),
    dice: g.dice, firstServer: g.firstServer, turn: g.turnNo, owner: g.turnP?.idx,
    ball: g.ball, target: g.target, rally: g.rallyNo, src: g.src, stats: g.stats,
    winner: g.winner?.idx, logs
  });
}

function harness(seed, decks = ['k1014', 'seijoh'], gateAI = false, localPlayer = 0, bothHuman = false) {
  const queue = [], waiters = [], errors = [];
  let logs = [], gated = false, finished = false;
  const emit = event => waiters.length ? waiters.shift()(event) : queue.push(event);
  const human = { label: '你', choose(g, p, req) {
    return new Promise(resolve => emit({ type: 'human', g, p, req, resolve, snapshot: state(g, logs), index: session.entries.length }));
  } };
  const ai = { ...E.AI, label: 'AI', delay: 0, async choose(g, p, req) {
    if (gateAI && !gated && g.turnP?.idx === 1) {
      gated = true;
      return new Promise(resolve => emit({ type: 'ai', g, p, req, resolve }));
    }
    return E.AI.choose.call(this, g, p, req);
  } };
  const session = new UndoSession(E, {
    seed, decks, human, ai, localPlayer,
    agents: bothHuman ? [{ ...human, label: '玩家1', wantsAck: true }, { ...human, label: '玩家2', wantsAck: true }] : undefined,
    onGame() { logs = []; finished = false; },
    onLog(s, cls) { logs.push([s, cls]); },
    onUpdate(g) { if (g.winner && !finished) { finished = true; emit({ type: 'done' }); } },
    onError(error) { errors.push(error); emit({ type: 'error', error }); }
  });
  return {
    session, errors,
    snapshot: () => state(session.game, logs),
    next() {
      if (queue.length) return Promise.resolve(queue.shift());
      return new Promise((resolve, reject) => {
        const receive = event => { clearTimeout(timer); resolve(event); };
        const timer = setTimeout(() => { const i = waiters.indexOf(receive); if (i >= 0) waiters.splice(i, 1); reject(new Error('Decision timed out')); }, 2000);
        waiters.push(receive);
      });
    }
  };
}
async function defaultAnswer(ticket) {
  if (ticket.req.kind === 'roll' || ticket.req.kind === 'ack') return true;
  if (ticket.req.kind === 'guts') return ticket.req.options.slice(0, ticket.req.need).map(x => x.value);
  return E.AI.choose.call({ delay: 0 }, ticket.g, ticket.p, ticket.req);
}

(async () => {
  const kinds = new Set();
  let reversals = 0;
  // Compare complete engine state and logs at many real decision checkpoints,
  // including checkpoints following draws, costs and automatic AI actions.
  for (const [i, seed] of [7, 12, 42, 91, 300, 2026].entries()) {
    const h = harness(seed, [i % 2 ? 'k1014c' : 'k1014', i % 3 ? 'seijoh' : 'hk_axis']);
    const checkpoints = new Map(), checked = new Set();
    h.session.start();
    for (let step = 0; step < 300; step++) {
      let ticket = await h.next();
      if (ticket.type === 'error') throw ticket.error;
      if (ticket.type === 'done') break;
      assert.equal(ticket.type, 'human');
      kinds.add(ticket.req.kind);
      checkpoints.set(ticket.index, ticket.snapshot);
      const status = h.session.status();
      if (status.enabled && !checked.has(ticket.index)) {
        checked.add(ticket.index);
        const expected = checkpoints.get(status.target);
        assert(expected, 'target must be a prior human decision');
        if (status.opponent) {
          assert.equal(h.session.undo(), false, 'opponent turn requires consent');
          const request = h.session.requestTakeback();
          assert(request);
          assert(h.session.resolveTakeback(request.id, request.responder, true));
        } else assert(h.session.undo());
        ticket = await h.next();
        assert.equal(ticket.type, 'human');
        assert.deepEqual(ticket.snapshot, expected, 'undo must restore all state and logs');
        assert.equal(h.session.entries.length, status.target);
        if (!status.opponent) assert.equal(ticket.g.turnNo, expected.turn, 'normal undo must stay in the same turn');
        reversals++;
      }
      ticket.resolve(await defaultAnswer(ticket));
    }
    assert.equal(h.errors.length, 0);
    h.session.stop();
  }
  assert(reversals > 20, 'expected substantial rollback coverage');

  // A request during the AI turn freezes the pending AI answer. Cancelling the
  // request resumes the same game; confirming invalidates the old async work.
  for (const response of ['cancel', 'decline', 'accept']) {
    const h = harness(7, ['k1014', 'seijoh'], true);
    const checkpoints = new Map();
    h.session.start();
    let ai;
    for (let i = 0; i < 100; i++) {
      const ticket = await h.next();
      if (ticket.type === 'ai') { ai = ticket; break; }
      assert.equal(ticket.type, 'human');
      checkpoints.set(ticket.index, ticket.snapshot);
      ticket.resolve(await defaultAnswer(ticket));
    }
    assert(ai, 'must reach the AI turn');
    const status = h.session.status();
    assert(status.enabled && status.opponent);
    const request = h.session.requestTakeback();
    assert(request);
    assert.equal(h.session.requestTakeback(), null, 'only one pending request');
    assert.equal(h.session.resolveTakeback(request.id, request.requester, true), false, 'requester cannot approve their own request');
    const before = h.snapshot(), entryCount = h.session.entries.length;
    ai.resolve(await defaultAnswer(ai));
    await flush(); await flush();
    assert.deepEqual(h.snapshot(), before, 'AI must not advance while confirmation is open');
    assert.equal(h.session.entries.length, entryCount);
    if (response === 'accept') {
      assert(h.session.resolveTakeback(request.id, request.responder, true));
      assert.equal(h.session.resolveTakeback(request.id, request.responder, true), false, 'old response cannot be applied twice');
      const ticket = await h.next();
      assert.equal(ticket.type, 'human');
      assert.deepEqual(ticket.snapshot, checkpoints.get(status.target));
      const restored = h.snapshot();
      await flush(); await flush();
      assert.deepEqual(h.snapshot(), restored, 'old AI must not alter restored state');
      assert.equal(h.session.status().opponent, false);
    } else {
      if (response === 'cancel') assert(h.session.cancelTakeback(request.id));
      else assert(h.session.resolveTakeback(request.id, request.responder, false));
      const ticket = await h.next();
      assert.notEqual(ticket.type, 'error');
      assert(h.session.entries.length > entryCount, 'cancel must allow AI to continue');
    }
    h.session.stop();
    assert.equal(h.errors.length, 0);
  }

  // The core has no fixed host/player side. A player-2 request must be approved
  // by player 1, and restoration must return to player 2's own decision.
  const twoPlayers = harness(7, ['k1014', 'seijoh'], false, 1, true);
  const playerCheckpoints = new Map();
  twoPlayers.session.start();
  let approved = false;
  for (let step = 0; step < 200; step++) {
    const ticket = await twoPlayers.next();
    assert.equal(ticket.type, 'human');
    playerCheckpoints.set(ticket.index, ticket.snapshot);
    const status = twoPlayers.session.status();
    if (status.enabled && status.opponent) {
      const request = twoPlayers.session.requestTakeback();
      assert.equal(request.requester, 1);
      assert.equal(request.responder, 0);
      assert.equal(twoPlayers.session.undo(), false);
      assert(twoPlayers.session.resolveTakeback(request.id, 0, true));
      const restored = await twoPlayers.next();
      assert.equal(restored.p.idx, 1);
      assert.deepEqual(restored.snapshot, playerCheckpoints.get(status.target));
      assert.equal(twoPlayers.session.resolveTakeback(request.id, 0, true), false);
      approved = true;
      break;
    }
    ticket.resolve(await defaultAnswer(ticket));
  }
  assert(approved, 'must exercise consent with two human agents');
  twoPlayers.session.stop();

  const fresh = harness(7);
  fresh.session.start();
  const roll = await fresh.next();
  assert.equal(roll.req.kind, 'roll');
  assert.equal(fresh.session.status().enabled, false, 'cannot undo the initial dice roll');
  assert.equal(fresh.session.undo(), false);
  fresh.session.stop();
  fresh.session.start();
  assert.equal((await fresh.next()).req.kind, 'roll');
  assert.equal(fresh.session.entries.length, 0, 'new game clears undo history');
  fresh.session.stop();
  console.log('undo-tools: passed', reversals, 'complete-state reversals; AI pause/cancel/decline/accept; two-player consent; stale responses; restart; kinds:', [...kinds].join(', '));
})().catch(error => { console.error(error); process.exit(1); });
