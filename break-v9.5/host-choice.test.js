'use strict';
// C 通用選擇：驗證器、選取狀態、AI 基礎決策（Claude 2026-10-21）
const assert = require('node:assert/strict');
const H = require('./host-choice'), { fixtures, req, opt, cardOpt } = require('./choice-fixtures');
const byKind = k => fixtures.find(r => r.kind === k);

// 每個 fixture：request 合法、AI 回答合法、AI 不讀 request 以外資訊
for (const r of fixtures) {
  assert.ok(H.checkRequest(r).ok, r.kind + ' ' + H.checkRequest(r).error);
  const a = H.aiAnswer(r);
  assert.ok(H.validate(r, a).ok, r.kind);
}

// 封套：過期／別人的回答被拒
{
  const r = byKind('firstService'), a = H.makeAnswer(r, 'serve');
  assert.ok(H.validate(r, a).ok);
  for (const k of ['matchId', 'requestId', 'epoch', 'actor']) assert.match(H.validate(r, { ...a, [k]: k === 'epoch' || k === 'actor' ? 99 : 'x' }).error, /不符/);
  assert.match(H.validate(r, { matchId: 'demo', requestId: r.requestId, epoch: 1, actor: 0 }).error, /缺少 value/);
}
// ack
{ const r = byKind('reveal'); assert.ok(H.checkValue(r, true).ok); for (const v of [false, 1, 'true', null]) assert.equal(H.checkValue(r, v).ok, false); }
// single：嚴格型態，true/false/0/null 不混淆，不能拿陣列答單選
{
  const r = byKind('activate_payment');
  assert.ok(H.checkValue(r, true).ok); assert.ok(H.checkValue(r, false).ok);
  for (const v of [1, 0, 'true', null, [true]]) assert.equal(H.checkValue(r, v).ok, false, JSON.stringify(v));
  const m = byKind('mode'); assert.ok(H.checkValue(m, 1).ok); assert.equal(H.checkValue(m, '1').ok, false); assert.equal(H.checkValue(m, 2).ok, false);
}
// number：只能選 allowedCounts（離散）
{ const r = byKind('payment_count'); assert.ok(H.checkValue(r, 3).ok); for (const v of [1, 4, 2.5, '2']) assert.equal(H.checkValue(r, v).ok, false); }
// cards：同卡號不同實體可分開選，ID 不可重複、數量界線
{
  const r = byKind('payment_cards'), [a, b, c] = r.options.map(o => o.value);
  assert.equal(r.options[0].card.cardNo, r.options[1].card.cardNo);
  assert.ok(H.checkValue(r, [b]).ok);
  assert.match(H.checkValue(r, []).error, /至少/); assert.match(H.checkValue(r, [a, c]).error, /最多/);
  assert.match(H.checkValue(r, ['zzz']).error, /不在候選/); assert.match(H.checkValue(r, a).error, /陣列/);
  const g = byKind('guts'), ids = g.options.map(o => o.value);
  assert.match(H.checkValue(g, [ids[0], ids[0]]).error, /兩次/); assert.ok(H.checkValue(g, [ids[0], ids[3]]).ok);
  const mul = byKind('mulligan'); assert.ok(H.checkValue(mul, []).ok); assert.ok(H.checkValue(mul, mul.options.map(o => o.value)).ok);
}
// block：同名不可、需中攔且中攔在出場者內、人數上限
{
  const r = byKind('block'), [tsu, h1, h2, kag] = r.options.map(o => o.value);
  assert.ok(H.checkValue(r, { cards: [tsu, h1, kag], center: tsu }).ok);
  assert.match(H.checkValue(r, { cards: [h1, h2], center: h1 }).error, /同名/);
  assert.match(H.checkValue(r, { cards: [tsu], center: kag }).error, /中攔/);
  assert.match(H.checkValue(r, { cards: [], center: null }).error, /至少/);
  assert.match(H.checkValue(r, [tsu]).error, /\{cards, center\}/);
  const two = { ...r, context: { ...r.context, block: { ...r.context.block, maxCount: 2 } } };
  assert.match(H.checkValue(two, { cards: [tsu, h1, kag], center: tsu }).error, /最多 2/);
}
// 未知 input／壞 request：拒絕不猜
{
  const r = byKind('mode');
  assert.match(H.checkRequest({ ...r, input: { type: 'slots' } }).error, /未知/);
  assert.match(H.checkRequest({ ...r, protocol: 'x' }).error, /協定/);
  assert.match(H.checkRequest({ ...r, options: [r.options[0], r.options[0]] }).error, /重複/);
  const { canManual, ...noField } = r; assert.match(H.checkRequest(noField).error, /canManual/);
  assert.throws(() => H.aiValue({ ...r, input: { type: 'slots' } }), /未知/);
}
// 選取狀態：toggle、單張替換、上限訊息、中攔轉移、有序
{
  const r = byKind('guts'), ids = r.options.map(o => o.value);
  let s = H.createSelection(r);
  s = H.toggle(r, s, ids[0]); s = H.toggle(r, s, ids[1]); assert.ok(H.canSubmit(r, s));
  s = H.toggle(r, s, ids[2]); assert.match(s.error, /最多/); assert.equal(s.picked.length, 2);
  s = H.toggle(r, s, ids[0]); assert.deepEqual(s.picked, [ids[1]]); assert.equal(H.canSubmit(r, s), false);
  assert.equal(H.progress(r, s), '已選 1 / 2');
  const one = byKind('payment_cards'), o = one.options.map(x => x.value);
  let t = H.toggle(one, H.createSelection(one), o[0]); t = H.toggle(one, t, o[2]); assert.deepEqual(t.picked, [o[2]]);
  const b = byKind('block'), bv = b.options.map(x => x.value);
  let u = H.toggle(b, H.createSelection(b), bv[1]); u = H.toggle(b, u, bv[2]); assert.match(u.error, /同名/);
  u = H.toggle(b, u, bv[0]); assert.deepEqual(u.center, bv[1]);
  u = H.setCenter(b, u, bv[0]); assert.deepEqual(u.center, bv[0]);
  u = H.toggle(b, u, bv[0]); assert.deepEqual(u.center, bv[1]); assert.ok(H.canSubmit(b, u));
  const ord = fixtures.find(x => x.input.ordered), ov = ord.options.map(x => x.value);
  let w = H.createSelection(ord); for (const v of [ov[2], ov[0], ov[1]]) w = H.toggle(ord, w, v);
  assert.deepEqual(H.selectionValue(ord, w), [ov[2], ov[0], ov[1]]);
  const n = byKind('payment_count'); assert.equal(H.selectionValue(n, H.toggle(n, H.createSelection(n), 3)), 3);
}
// AI 偏好：先發、接球、發動、抽最多、牌頂棄最少；空池合法
{
  assert.equal(H.aiValue(byKind('firstService')), 'serve');
  assert.equal(H.aiValue(byKind('activate_payment')), true);
  assert.equal(H.aiValue(byKind('draw_count')), 2);
  assert.equal(H.aiValue(req('mill_count', 'x', { type: 'number' }, [opt(0, '0'), opt(3, '3')])), 0);
  assert.equal(H.aiValue(req('defend', 'x', { type: 'single' }, [opt('block', '攔'), opt('receive', '接')])), 'receive');
  assert.deepEqual(H.aiValue(byKind('mulligan')), []);
  const empty = req('move_cards', 'x', { type: 'cards', min: 0, max: 0 }, []); assert.ok(H.validate(empty, H.aiAnswer(empty)).ok);
  assert.throws(() => H.aiValue(req('target', 'x', { type: 'single' }, [])), /沒有合法選項/);
  const b = H.aiValue(byKind('block')); assert.equal(new Set(b.cards).size, b.cards.length); assert.ok(b.cards.includes(b.center));
}
console.log('host-choice: all tests passed (' + fixtures.length + ' fixtures)');

// v1 must reject v2 restrictions rather than silently ignore them.
for (const key of ['slots','groups','constraints']) { const r=JSON.parse(JSON.stringify(fixtures[1]));r.input[key]=[];assert.equal(H.checkRequest(r).ok,false);assert.equal(require('./rules/host-contract').validateRequest(r),false); }
{ const r=JSON.parse(JSON.stringify(byKind('block')));r.options[0].card.effectiveName='同一有效名';r.options[1].card.effectiveName='同一有效名';assert.equal(H.checkValue(r,{cards:[r.options[0].value,r.options[1].value],center:r.options[0].value}).ok,false); }
