const assert = require('node:assert/strict');
const E = require('./engine');
function fixture(choose = async (g, p, r) => r.kind === 'event' ? null : r.options[0].value) {
  const g = new E.Game({ seed: 7, decks: ['quick', 'seijoh'], agents: [{ wantsAck: true, choose }, E.AI] });
  const p = g.players[0]; g.beginTurn(p); p.hand = []; p.deck = ['D01-012']; g.ball = { type: 'attack', off: 3 };
  return { g, p };
}
let passed = 0, failed = 0;
async function check(name, run) { try { await run(); console.log('PASS', name); passed++; } catch (e) { console.error('FAIL', name, e.message); failed++; } }
(async () => {
  await check('PR-057 chooses either name on entry and expires at end of turn', async () => {
    for (const name of ['日向 翔陽', '西谷 夕']) {
      const { g, p } = fixture(async (g, p, r) => { assert.equal(r.kind, 'name'); return name; });
      p.hand = ['PR-057']; await g.enterCharacter(p, 'receive', 'PR-057');
      assert.equal(g.cardName(p, 'receive'), name); assert.equal(E.nm('PR-057'), '着地上手組。');
      g.finishTurn(p); assert.equal(g.cardName(p, 'receive'), '着地上手組。');
    }
  });
  await check('PR-057 entry removes only same-name options; printed name outside court is unchanged', async () => {
    const { g, p } = fixture(async (g, p, r) => { assert.deepEqual(r.options.map(o => o.value), ['西谷 夕']); return r.options[0].value; });
    p.area.receive = ['P01-004']; p.hand = ['PR-057'];
    await g.enterCharacter(p, 'toss', 'PR-057'); assert.equal(g.cardName(p, 'toss'), '西谷 夕');
    assert(g.canEnter(p, 'attack', 'P01-004')); assert(!g.canEnter(p, 'attack', 'D01-005'));
    assert.equal(E.isHin('PR-057'), false);
  });
  await check('replacing a character clears its name and parameter effects, including identical card codes', async () => {
    const { g, p } = fixture(); p.area.receive = ['PR-057'];
    p.effects.receive = { card: 'PR-057', name: '日向 翔陽', mods: { rcv: 1 } };
    p.hand = ['PR-057']; g.place(p, 'receive', 'PR-057');
    assert.equal(g.cardName(p, 'receive'), '着地上手組。'); assert.equal(g.parameter(p, 'receive', 'rcv'), 5);
  });
  await check('Natsu selects an off-phase Hinata and any numeric parameter, not automatically the current receiver', async () => {
    const { g, p } = fixture(async (g, p, r) => r.kind === 'target' ? 'attack' : 'tos');
    p.area.receive = ['P01-011']; p.ts.receiver = 'P01-011'; p.ts.rcv = 6;
    p.area.attack = ['P01-004']; p.hand = ['P03-096'];
    await g.resolve(p, 'P03-096', 'rcv');
    assert.equal(g.parameter(p, 'attack', 'tos'), 1); assert.equal(p.ts.rcv, 6); assert.equal(p.hand.length, 1);
    assert.equal(g.parameter(p, 'attack', 'atk'), 3);
    assert(!g.playable(p, 'rcv').some(x => x.card === 'P03-096'));
  });
  await check('Natsu recognizes only the chosen PR-057 court name', async () => {
    for (const name of ['日向 翔陽', '西谷 夕']) {
      let targeted = false;
      const { g, p } = fixture(async (g, p, r) => { if (r.kind === 'target') { targeted = true; return 'receive'; } return 'rcv'; });
      p.area.receive = ['PR-057']; p.effects.receive = { card: 'PR-057', name, mods: {} };
      p.ts.receiver = 'PR-057'; p.ts.rcv = 5; p.hand = ['P03-096'];
      await g.resolve(p, 'P03-096', 'rcv'); assert.equal(targeted, name === '日向 翔陽');
      assert.equal(p.ts.rcv, name === '日向 翔陽' ? 6 : 5);
    }
  });
  await check('Natsu may draw without a Hinata, but cannot be played when both draw and targets are unavailable', async () => {
    const { g, p } = fixture(); p.area.receive = ['P01-011']; p.hand = ['P03-096'];
    assert(g.playable(p, 'rcv').some(x => x.card === 'P03-096'));
    p.restrict.no_add = true; assert(!g.playable(p, 'rcv').some(x => x.card === 'P03-096'));
  });
  await check('side Hinata can receive a block parameter bonus; discard cleanup counts it once', async () => {
    const { g, p } = fixture(async (g, p, r) => r.kind === 'target' ? 'side:0' : 'blk');
    p.area.block = ['P03-048']; p.ts.sides = ['P01-002']; p.ts.blockers = ['P03-048', 'P01-002']; p.ts.blk = 6;
    p.hand = ['P03-096']; await g.resolve(p, 'P03-096', 'blk'); assert.equal(p.ts.blk, 7);
    g.cleanupSides(p); assert.deepEqual(p.drop, ['P01-002']); assert(!g.courtTargets(p).some(t => t.key === 'side:0'));
  });
  await check('six Guts are selected across areas without paying top characters; receive gets +2 only when selected', async () => {
    const { g, p } = fixture(async (g, p, r) => {
      if (r.kind === 'target') return 'receive';
      if (r.kind === 'skill') return true;
      if (r.kind === 'gutsCourt') { assert.equal(r.options.length, 7); return [0, 2, 3, 4, 5, 6]; }
      return 'rcv';
    });
    p.area.receive = ['P01-004', 'P01-002', 'P03-048'];
    p.area.toss = ['D01-009', 'PR-032', 'P01-006']; p.area.attack = ['BP-002', 'P01-004', 'PR-043', 'P01-003'];
    p.ts.receiver = 'P03-048'; p.ts.rcv = 0; p.hand = ['P03-087'];
    await g.resolve(p, 'P03-087', 'rcv'); assert.equal(p.ts.rcv, 2); assert.equal(g.parameter(p, 'receive', 'atk'), 3);
    assert.deepEqual(p.area.receive, ['P01-002', 'P03-048']); assert.deepEqual(p.area.toss, ['P01-006']);
    assert.deepEqual(p.area.attack, ['P01-003']); assert.equal(p.drop.length, 6);
  });
  await check('six-Guts optional bonus may be declined and cannot partially pay with five', async () => {
    for (const count of [5, 6]) {
      const { g, p } = fixture(async (g, p, r) => r.kind === 'target' ? 'receive' : false);
      p.area.receive = [...Array(count).fill('P01-004'), 'P03-048']; p.ts.receiver = 'P03-048'; p.ts.rcv = 0;
      p.hand = ['P03-087']; await g.resolve(p, 'P03-087', 'rcv');
      assert.equal(p.guts('receive'), count); assert.equal(p.ts.rcv, 0); assert.equal(g.parameter(p, 'receive', 'atk'), 3);
    }
  });
  await check('P03-087 uses live top characters, exact affiliations and a nonempty court', async () => {
    const { g, p } = fixture(); p.hand = ['P03-087'];
    assert(!g.playable(p, 'rcv').some(x => x.card === 'P03-087'));
    p.area.receive = ['P03-046', 'P01-004']; assert(g.playable(p, 'rcv').some(x => x.card === 'P03-087'));
    p.area.serve = ['P03-046']; assert(!g.playable(p, 'rcv').some(x => x.card === 'P03-087'));
    const old = E.DEF['P01-004'][8];
    try { p.area.serve = []; E.DEF['P01-004'][8] = 'ユース'; assert(g.uniformCourt(p));
      E.DEF['P01-004'][8] = '疑似ユース'; assert(!g.uniformCourt(p));
    } finally { E.DEF['P01-004'][8] = old; }
  });
  await check('parameter choices exclude dash, include zero, and turn end removes numeric bonuses', async () => {
    const { g, p } = fixture(async (g, p, r) => { assert(!r.options.some(o => o.value === 'srv' || o.value === 'blk')); assert(r.options.some(o => o.value === 'tos')); return 'tos'; });
    p.area.receive = ['PR-057']; await g.chooseParameter(p, 'receive', 2, 'test', 'rcv');
    assert.equal(g.parameter(p, 'receive', 'tos'), 2); assert.equal(g.parameter(p, 'receive', 'srv'), null);
    g.finishTurn(p); assert.equal(g.parameter(p, 'receive', 'tos'), 0);
  });
  await check('real receive check accepts Kageyama after six-Guts receive +2 and Hinata after Natsu +1', async () => {
    const STOP = Symbol('setter reached');
    for (const event of ['P03-087', 'P03-096']) {
      const receiver = event === 'P03-087' ? 'P03-048' : 'P01-004';
      const { g, p } = fixture(async (g, p, r) => {
        if (r.kind === 'setter') throw STOP;
        if (r.kind === 'receiver') return receiver;
        if (r.kind === 'event') return r.timing === 'rcv' && r.options.some(o => o.value === event) ? event : null;
        if (r.kind === 'target') return 'receive';
        if (r.kind === 'parameter') return 'rcv';
        if (r.kind === 'gutsCourt') return [0, 1, 2, 3, 4, 5];
        return true;
      });
      p.hand = [receiver, event, 'D01-009']; p.deck = ['D01-012', 'PR-043'];
      p.area.toss = [...Array(6).fill('P01-004'), 'D01-009'];
      g.ball = { type: 'attack', off: event === 'P03-087' ? 2 : 6 };
      await assert.rejects(g.receiveTurn(p), e => e === STOP);
      assert.equal(p.ts.rcv, g.ball.off); assert.equal(p.guts('toss'), event === 'P03-087' ? 0 : 6);
    }
  });
  await check('invalid targets are rejected and duplicate cost responses never pay extra or remove a top character', async () => {
    const { g, p } = fixture(async (g, p, r) => r.kind === 'target' ? 'attack' : [0, 1, 2, 3, 4, 5, 5]);
    p.area.receive = ['P01-004']; p.area.toss = [...Array(6).fill('P01-002'), 'P01-006'];
    await assert.rejects(g.chooseTarget(p, g.courtTargets(p).filter(t => t.key === 'receive'), 'test', 'rcv'), /無效的角色/);
    await g.payCourt(p, 6); assert.equal(p.drop.length, 6); assert.deepEqual(p.area.toss, ['P01-006']);
  });
  await check('chosen Hinata name controls Kageyama attack bonus and Broad Attack; two PR-057 copies can choose different names', async () => {
    assert(E.canChain(['PR-057', 'PR-057'], '日向 翔陽'));
    for (const name of ['日向 翔陽', '西谷 夕']) {
      const { g, p } = fixture(async () => name); p.hand = ['PR-057', 'D01-012']; p.deck = [];
      p.area.toss = ['P01-006']; p.ts.setter = 'P01-006'; p.ts.toss = 1; p.ts.hin = 2;
      await g.enterAttack(p, 'PR-057', false); assert.equal(p.ts.atk, name === '日向 翔陽' ? 5 : 3);
      await g.resolve(p, 'D01-012', 'atk'); assert.equal(!!p.opp.pending.one_blocker, name === '日向 翔陽');
    }
  });
  console.log(`skill targets: ${passed} passed, ${failed} failed`); if (failed) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
