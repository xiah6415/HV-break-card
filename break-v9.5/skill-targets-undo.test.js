const assert = require('node:assert/strict');
const E = require('./engine');
const { UndoSession } = require('./undo-tools');
const flush = () => new Promise(resolve => setImmediate(resolve));
const clone = x => JSON.parse(JSON.stringify(x));
class Scenario extends E.Game {
  async run() {
    const p = this.players[0]; this.beginTurn(p);
    p.hand = ['PR-057', 'P03-096', 'P03-087']; p.deck = ['D01-012', 'P01-074'];
    p.area.toss = ['P01-004', 'P01-002', 'P01-004', 'P01-006'];
    p.area.attack = ['P01-004', 'P01-002', 'PR-043', 'D01-009'];
    p.ts.setter = 'P01-006'; p.ts.toss = 1;
    await this.enterCharacter(p, 'receive', 'PR-057'); p.ts.receiver = 'PR-057'; p.ts.rcv = 5;
    await this.resolve(p, 'P03-096', 'rcv'); await this.resolve(p, 'P03-087', 'rcv');
    await this.confirmTurnEnd(p, { type: 'attack', off: 4 }); this.finishTurn(p);
    return p;
  }
}
(async () => {
  const queue = [], errors = []; let logs = [];
  const snapshot = g => clone({ players: g.players.map(p => { const { g, agent, ...data } = p; return data; }), logs, turn: g.turnNo, src: g.src });
  const session = new UndoSession({ Game: Scenario }, { seed: 7, decks: ['quick', 'seijoh'], ai: E.AI,
    human: { wantsAck: true, choose: (g, p, req) => new Promise(resolve => queue.push({ req, resolve, state: snapshot(g), index: session.entries.length })) },
    onGame() { logs = []; }, onLog(s) { logs.push(s); }, onError(e) { errors.push(e); } });
  session.start(); await flush(); const states = new Map(); const kinds = new Set(); let reversals = 0;
  for (let i = 0; i < 20; i++) {
    let ticket = queue.shift(); assert(ticket, 'request exists'); states.set(ticket.index, ticket.state); kinds.add(ticket.req.kind);
    const target = session.status().target;
    if (target >= 0) {
      const old = ticket; assert(session.undo()); await flush(); ticket = queue.shift();
      assert.deepEqual(ticket.state, states.get(target)); reversals++;
      old.resolve(null); await flush(); assert.deepEqual(snapshot(session.game), ticket.state, 'stale callback must not modify restored court');
      ticket.resolve(answer(ticket.req)); await flush(); ticket = queue.shift();
      assert.deepEqual(ticket.state, old.state, 'repeating choice must restore same target/name/cost/parameter checkpoint');
    }
    if (ticket.req.kind === 'turnEnd') { ticket.resolve(true); await session.done; break; }
    ticket.resolve(answer(ticket.req)); await flush();
  }
  const p = session.game.players[0]; assert.equal(p.ts.rcv, 6); assert.equal(p.ts.toss, 3); assert.equal(p.drop.length, 6);
  assert.deepEqual(p.effects, {}); assert.deepEqual(errors, []);
  for (const kind of ['name', 'target', 'parameter', 'skill', 'guts', 'turnEnd']) assert(kinds.has(kind));
  assert(reversals >= 7); session.stop(); console.log('target Undo: passed', reversals, 'full state/log restores, name/target/parameter/cross-court Guts and obsolete callbacks');
})();
function answer(r) {
  if (r.kind === 'name') return r.options.find(o=>o.value.replace(/\s/g,'')==='日向翔陽').value;
  if (r.kind === 'target') return r.ctx?.card==='P03-096' ? 'receive' : 'toss';
  if (r.kind === 'parameter') return r.ctx.target === 'receive' ? 'rcv' : 'tos';
  if (r.kind === 'gutsCourt'||r.kind==='guts') return [0, 1, 2, 3, 4, 5];
  return true;
}
