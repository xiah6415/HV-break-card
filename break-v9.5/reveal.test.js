const assert = require('node:assert/strict');
const E = require('./engine');
const { UndoSession } = require('./undo-tools');
const matches = c => c === 'P01-002' || c === 'P01-078';
const flush = () => new Promise(resolve => setImmediate(resolve));
function fixture(choose, ack = true) {
  const logs = [], notices = [];
  const g = new E.Game({ seed: 7, decks: ['k1014', 'seijoh'], agents: [{ wantsAck: ack, choose }, E.AI],
    onLog: s => logs.push(s), onNotice: async n => { notices.push(n); } });
  const p = g.players[0]; g.beginTurn(p); p.deck = ['P01-002', 'D01-012', 'P01-002']; p.hand = [];
  return { g, p, logs, notices };
}
(async () => {
  for (const [top, blocked, take] of [['P01-002', false, true], ['P01-078', false, false], ['D01-005', false, false], ['P01-002', true, false], [null, false, false]]) {
    const seen = [];
    const { g, p, logs } = fixture(async (game, player, req) => {
      seen.push(req.kind);
      if (req.kind === 'reveal') {
        assert(!JSON.stringify(req).includes(top), 'hidden card identity must not be in flip request');
        assert(!logs.some(s => s.includes('翻開：')));
      } else {
        assert.equal(req.ctx.revealed, top);
        assert.deepEqual(player.deck, req.kind === 'retrieve' || !top ? initial : [top, ...initial.slice(0, -1)], 'miss is already on bottom; eligible card awaits the choice');
        if (blocked) assert.match(req.ctx.reason, /禁止加入/);
        if (top === 'D01-005') assert.match(req.ctx.reason, /沒有符合條件/);
        if (!top) assert.match(req.ctx.reason, /牌庫已空/);
      }
      return req.kind === 'retrieve' ? take ? top : null : true;
    });
    p.deck = top ? ['P01-002', 'D01-012', top] : [];
    p.restrict.no_add = blocked;
    const initial = p.deck.slice();
    await g.revealTop(p, '影山', matches);
    assert.deepEqual(seen, top ? ['reveal', matches(top) && !blocked ? 'retrieve' : 'revealResult'] : ['revealResult']);
    assert.deepEqual(p.hand, take ? [top] : []);
    assert.deepEqual(p.deck, !top ? [] : take ? initial.slice(0, -1) : [top, ...initial.slice(0, -1)]);
    assert(logs.some(s => s.includes(!top ? '牌庫已空' : take ? '加入手牌' : '放回牌庫底')));
  }
  // AI public reveals pause before card movement and contain only the revealed card.
  for (const top of ['P01-002', 'D01-005', null]) {
    const { g, p, notices } = fixture(E.AI.choose, false);
    p.deck = top ? ['D01-012', top] : [];
    let resume;
    g.onNotice = n => { notices.push(n); return new Promise(resolve => { resume = resolve; }); };
    const task = g.revealTop(p, '影山', matches); await flush();
    assert.equal(notices[0].card, top); assert.equal(notices[0].type, 'reveal');
    assert(!('deck' in notices[0])); assert.equal(p.hand.length, 0);
    assert.deepEqual(p.deck, !top ? [] : matches(top) ? ['D01-012', top] : [top, 'D01-012']); resume(); await task;
  }
  // Replay restores the unrevealed flip, and an obsolete result cannot move a card.
  const queue = [], errors = [];
  class RevealGame extends E.Game {
    async run() {
      const p = this.players[0]; this.beginTurn(p);
      p.deck = ['D01-012', 'P01-002']; p.hand = [];
      await this.revealTop(p, '影山', matches);
      await this.ask(p, { kind: 'after', prompt: 'after', options: [{ value: true }] });
      return p;
    }
  }
  const session = new UndoSession({ Game: RevealGame }, { seed: 7, decks: ['k1014', 'seijoh'],
    human: { wantsAck: true, choose: (g, p, req) => new Promise(resolve => queue.push({ req, resolve })) }, ai: E.AI,
    onError: error => errors.push(error) });
  session.start(); await flush(); let flip = queue.shift(); assert.equal(flip.req.kind, 'reveal');
  flip.resolve(true); await flush(); const stale = queue.shift(); assert.equal(stale.req.ctx.revealed, 'P01-002');
  assert(session.undo()); await flush(); flip = queue.shift(); assert.equal(flip.req.kind, 'reveal');
  assert(!flip.req.ctx); stale.resolve('P01-002'); await flush(); assert.deepEqual(session.game.players[0].hand, []);
  flip.resolve(true); await flush(); const again = queue.shift(); assert.equal(again.req.ctx.revealed, 'P01-002');
  again.resolve('P01-002'); await flush(); assert.deepEqual(session.game.players[0].hand, ['P01-002']);
  assert.deepEqual(session.game.players[0].deck, ['D01-012']); assert.deepEqual(errors, []); session.stop();
  console.log('reveal: manual flip, eligible/declined/miss/blocked/empty, exact top movement, AI public pause, Undo and stale result passed');
})().catch(error => { console.error(error); process.exit(1); });
