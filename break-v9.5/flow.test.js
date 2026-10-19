const assert = require('node:assert/strict');
const E = require('./engine');
const { UndoSession } = require('./undo-tools');
const flush = () => new Promise(resolve => setImmediate(resolve));
const state = g => JSON.stringify({
  rally: g.rallyNo, turn: g.turnNo, owner: g.turnP?.idx, ball: g.ball, winner: g.winner?.idx,
  players: g.players.map(p => ({ deck: p.deck, hand: p.hand, drop: p.drop, ev: p.ev, sets: p.sets, area: p.area, ts: p.ts, restrict: p.restrict, pending: p.pending }))
});
(async () => {
  const queue = [], waiters = [], errors = [];
  const emit = ticket => waiters.length ? waiters.shift()(ticket) : queue.push(ticket);
  const next = () => queue.length ? Promise.resolve(queue.shift()) : new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('flow timed out')), 2000);
    waiters.push(ticket => { clearTimeout(timer); resolve(ticket); });
  });
  const session = new UndoSession(E, {
    seed: 7, decks: ['k1014', 'seijoh'], ai: E.AI,
    human: { label: '你', choose(g, p, req) { return new Promise(resolve => emit({ kind: 'human', g, p, req, resolve })); } },
    onNotice(g, notice) { return new Promise(resolve => emit({ kind: 'notice', g, notice, resolve })); },
    onError(error) { errors.push(error); }
  });
  const choose = async ticket => ticket.req.kind === 'mulligan' ? [] : ticket.req.kind === 'guts' ? ticket.req.options.slice(0, ticket.req.need).map(x => x.value) : E.AI.choose(ticket.g, ticket.p, ticket.req);
  session.start();
  let ticket;
  for (;;) { ticket = await next(); if (ticket.kind === 'notice') break; ticket.resolve(await choose(ticket)); }
  assert.equal(ticket.notice.type, 'serve');
  const before = state(session.game), entries = session.entries.length;
  await flush(); await flush();
  assert.equal(state(session.game), before, 'serve announcement must block the next choice');
  assert.equal(session.entries.length, entries, 'display acknowledgements are not game decisions');

  // Releasing an announcement from an old game must not advance its replacement.
  const oldNotice = ticket;
  session.start();
  const roll = await next(); assert.equal(roll.req.kind, 'roll');
  const replacement = state(session.game);
  oldNotice.resolve(); await flush(); await flush();
  assert.equal(state(session.game), replacement);
  roll.resolve(true);

  for (let step = 0; step < 100; step++) {
    ticket = await next();
    if (ticket.kind === 'human' && ticket.req.kind === 'lossConfirm') break;
    ticket.resolve(ticket.kind === 'human' ? await choose(ticket) : undefined);
  }
  assert.equal(ticket.req.kind, 'lossConfirm'); assert.match(ticket.req.reason, /接球 .* 小於來球/);
  assert.equal(ticket.req.canLoss, false, 'forced confirmation cannot recursively trigger another Loss');
  const failed = state(session.game), rally = session.game.rallyNo, sets = session.game.players[0].sets.length;
  await flush(); assert.equal(state(session.game), failed, 'failed receive must wait before scoring/refilling');
  assert(session.undo());
  const receiver = await next();
  assert.equal(receiver.kind, 'human'); assert.equal(receiver.req.kind, 'receiver', 'replay skips old banners and returns to the prior choice');
  const restored = state(session.game);
  ticket.resolve(true); await flush(); await flush();
  assert.equal(state(session.game), restored, 'a stale Loss confirmation cannot affect the restored game');
  receiver.resolve(await choose(receiver));
  const again = await next(); assert.equal(again.req.kind, 'lossConfirm');
  again.resolve(true);
  const result = await next(); assert.equal(result.notice.type, 'loss'); assert.equal(result.notice.player, 0);
  assert.equal(session.game.rallyNo, rally); assert.equal(session.game.players[0].sets.length, sets);
  const resultState = state(session.game);
  await flush(); assert.equal(state(session.game), resultState, 'Loss result must remain visible before the interval');
  result.resolve();
  const serve = await next();
  assert.equal(serve.notice.type, 'serve'); assert.equal(serve.notice.player, 1);
  assert.equal(session.game.rallyNo, rally + 1); assert.equal(session.game.players[0].sets.length, sets - 1);
  const request = session.requestTakeback(); assert(request);
  assert(session.resolveTakeback(request.id, request.responder, true));
  const restoredLoss = await next(); assert.equal(restoredLoss.req.kind, 'lossConfirm');
  const takenBack = state(session.game);
  serve.resolve(); await flush(); await flush();
  assert.equal(state(session.game), takenBack, 'old serve acknowledgement cannot start AI after takeback');
  assert.deepEqual(errors, []);
  session.stop();
  console.log('flow: gated serve/turn/loss, explicit failed-receive confirmation, deferred interval, decision-free notices, replay and stale callbacks passed');
})().catch(error => { console.error(error); process.exit(1); });
