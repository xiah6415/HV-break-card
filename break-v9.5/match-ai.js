/* BREAK 策略 AI（單一狀態 Match／break.host.v1）。Claude 2026-10-24。
   介面：BreakMatchAI.answer(match, request) → 合法 answer（與 host-choice.aiAnswer 相同封套）。
   作法：
   - 結構選擇（發球／接球／舉球／攻擊角色、重抽、付 Guts、棄牌）用規則：看自己的卡片數值與目前來球。
   - 會改變數值的選擇（Event、是否付費發動、效果對象、參數、模式、名稱、數量、接球或攔網）做短距模擬：
     複製對局 → 套用選項 → 由自己的規則策略接手到下一個結構決策或換對手行動 → 靜態評分，取最高分。
   - 公平性：模擬前把對手手牌＋牌庫、自己牌庫重新洗牌（只知道張數，不知道內容），評分不看卡片身分。
   純函式：不修改傳入的 match。 */
(function (root) {
'use strict';
const H = typeof module !== 'undefined' && module.exports ? require('./host-choice') : root.BreakHostChoice;
const PARAMS = ['serve', 'block', 'receive', 'toss', 'attack'];
const STRUCTURAL = new Set(['event', 'receiver', 'setter', 'attacker', 'serve', 'turnEnd', 'defend', 'block', 'lossConfirm', 'mulligan', 'firstService', 'roll']);
const SIMULATE = new Set(['event', 'activate_payment', 'optional', 'skill', 'target', 'parameter', 'mode', 'name', 'move_count', 'draw_count', 'mill_count', 'payment_count', 'target_count', 'entry_count', 'trigger_order', 'defend']);
const W = { hand: 3.5, handExtra: 1, handCap: 5, offense: 4, offenseCap: 9, offenseExtra: 1, guts: 0.3, failReceive: 300, rally: 1000 };

const int = v => Number.isInteger(v) ? v : 0;
const K = m => m._kernel;
const printed = (m, id, p) => { const v = K(m).card(id).printed.parameters?.[p]; return Number.isInteger(v) ? v : null; };
const current = (m, id, p) => { const v = K(m).parameter(id, p); return Number.isInteger(v) ? v : null; };
const worth = (m, id) => { const c = K(m).card(id); return c.printed.type === 'character' ? PARAMS.reduce((s, p) => s + int(c.printed.parameters?.[p]), 0) : 4; };
const top = (m, p, area) => K(m).top(p, area);
const zone = (m, p, z) => K(m).zone(p, z);
const ball = m => K(m).state.ball;

// ---------- 複製與資訊遮蔽
function rng(seed) { let w = seed >>> 0; return () => { w = (w + 0x6D2B79F5) >>> 0; let t = w; t = Math.imul(t ^ t >>> 15, 1 | t); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function clone(m) {
  const c = Object.create(Object.getPrototypeOf(m)), k = Object.create(Object.getPrototypeOf(m._kernel));
  Object.assign(k, m._kernel); k.state = JSON.parse(JSON.stringify(m._kernel.state)); k.depth = 0; k.draining = false; k.busy = false;
  Object.assign(c, { _kernel: k, epoch: m.epoch, _identity: m._identity, _answers: [], _cursor: 0, _eventPreview: null });
  return c;
}
function shuffle(a, r) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } }
function hideUnknown(m, me, seed) {
  const s = K(m).state, r = rng(seed), opp = 1 - me;
  shuffle(s.zones[me + '.deck'], r);
  const hand = s.zones[opp + '.hand'], deck = s.zones[opp + '.deck'], pool = [...hand, ...deck];
  shuffle(pool, r);
  hand.splice(0, hand.length, ...pool.slice(0, hand.length)); deck.splice(0, deck.length, ...pool.slice(hand.length));
  for (const id of hand) s.cards[id].zone = opp + '.hand';
  for (const id of deck) s.cards[id].zone = opp + '.deck';
}

// ---------- 靜態評分（自己視角）
const handValue = n => W.hand * Math.min(n, W.handCap) + W.handExtra * Math.max(0, n - W.handCap);
const offenseValue = o => W.offense * Math.min(o, W.offenseCap) + W.offenseExtra * Math.max(0, o - W.offenseCap);
function rallyOver(m, base) { return m._m.phase === 'finished' || m._m.rally !== base.rally || m._m.phase === 'loss' || m._m.pc === 'lossResolve' || m._m.pc === 'lossConfirm'; }
function evaluate(m, me, base) {
  if (rallyOver(m, base)) { const l = m._m.loser; if (l === me) return -W.rally; if (l === 1 - me) return W.rally; }
  const k = K(m), b = ball(m);
  let v = handValue(zone(m, me, 'hand').length);
  for (const a of PARAMS) v += W.guts * Math.max(0, zone(m, me, a).length - 1);
  if (b && b.owner === me) v += offenseValue(b.offense);
  else {
    const t = top(m, me, 'toss'), a = top(m, me, 'attack');
    if (t && a) v += offenseValue(int(current(m, t, 'toss')) + int(current(m, a, 'attack')));
    else if (t) v += W.offense * 0.5 * int(current(m, t, 'toss'));
    if (b && b.owner === 1 - me && k.state.turn.player === me) {
      const r = top(m, me, 'receive');
      if (r && ['receive', 'draw'].includes(k.state.turn.phase) && int(current(m, r, 'receive')) < b.offense) v -= W.failReceive;
    }
  }
  return v;
}

// ---------- 規則策略（模擬內部與結構決策共用）
function cardIds(r) { return r.options.filter(o => typeof o.value === 'string' && o.card).map(o => o.value); }
function best(list, score) { let b = null, s = -Infinity; for (const x of list) { const v = score(x); if (v > s) { s = v; b = x; } } return b; }
function rulesValue(m, r) {
  const me = r.actor, b = ball(m), off = b && b.owner !== me ? b.offense : 0, ids = cardIds(r);
  switch (r.kind) {
    case 'firstService': return r.options.some(o => o.value === 'serve') ? 'serve' : r.options[0].value;
    case 'mulligan': {
      // 起手要有能接（≥4）、能舉（≥1）、能攻（≥3）各一；其餘低價值角色放回
      const hand = ids.slice(), keep = new Set(), take = f => { const id = best(hand.filter(x => !keep.has(x) && f(x)), x => -worth(m, x)); if (id) keep.add(id); return !!id; };
      const ok = [take(x => int(printed(m, x, 'receive')) >= 4), take(x => int(printed(m, x, 'toss')) >= 1), take(x => int(printed(m, x, 'attack')) >= 3)].every(Boolean);
      if (ok) return [];
      return hand.filter(x => !keep.has(x) && K(m).card(x).printed.type === 'character' && worth(m, x) <= 6).slice(0, r.input.max);
    }
    case 'serve': return best(ids, x => 2 * int(printed(m, x, 'serve')) - 0.3 * worth(m, x));
    case 'receiver': {
      const ok = ids.filter(x => int(printed(m, x, 'receive')) >= off);
      return ok.length ? best(ok, x => -worth(m, x) + 0.5 * int(printed(m, x, 'receive'))) : best(ids, x => int(printed(m, x, 'receive')));
    }
    case 'setter': return best(ids, x => 3 * int(printed(m, x, 'toss')) - 0.3 * worth(m, x) - (int(printed(m, x, 'attack')) >= 3 ? 2 : 0));
    case 'attacker': return best(ids, x => 3 * int(printed(m, x, 'attack')) - 0.5 * worth(m, x));
    case 'block': {
      const max = Math.min(r.input.max, r.context?.block?.maxCount ?? r.input.max), order = ids.slice().sort((a, b) => int(printed(m, b, 'block')) - int(printed(m, a, 'block')));
      let cards = [];
      for (const id of order) { if (cards.length >= max) break; const next = { cards: [...cards, id], center: cards[0] || id }; if (H.checkValue(r, next).ok && (!m._blockLegal || m._blockLegal(me, next))) cards = next.cards; }
      if (!cards.length) return H.aiValue(r);
      return { cards, center: cards[0] };
    }
    case 'guts': case 'payment_cards': return ids.slice().sort((a, b) => worth(m, a) - worth(m, b)).slice(0, r.input.min);
    case 'move_cards': {
      const toHand = /hand/.test(String(r.context?.destination || ''));
      return ids.slice().sort((a, b) => toHand ? worth(m, b) - worth(m, a) : worth(m, a) - worth(m, b)).slice(0, r.input.min);
    }
    case 'defend': return 'receive';
    case 'event': return null;
    default: return H.aiValue(r);
  }
}
function legal(r, value) { return H.validate(r, H.makeAnswer(r, value)).ok; }
function safeRules(m, r) { const v = rulesValue(m, r); return v !== undefined && legal(r, v) ? v : H.aiValue(r); }

// ---------- 候選與模擬
function candidates(r) {
  const t = r.input.type;
  if (t === 'single' || t === 'number') return r.options.map(o => o.value);
  if (t === 'cards' && r.input.min === r.input.max && r.input.max === 1) return r.options.map(o => [o.value]);
  return null;
}
function rollout(m0, me, value, seed, longHorizon) {
  const base = { rally: m0._m.rally };
  const m = clone(m0); hideUnknown(m, me, seed);
  try {
    let r = m.request(me); m.command({ kind: 'answer', answer: H.makeAnswer(r, value) });
    for (let i = 0; i < (longHorizon ? 40 : 12); i++) {
      if (rallyOver(m, base)) break;
      r = m.request(0) || m.request(1); if (!r) break;
      if (r.actor !== me) break;
      if (!longHorizon && STRUCTURAL.has(r.kind) && r.kind !== 'lossConfirm') break;
      m.command({ kind: 'answer', answer: H.makeAnswer(r, safeRules(m, r)) });
    }
  } catch (e) { return -Infinity; }
  return evaluate(m, me, base);
}
function choose(m, r) {
  if (r.input.type === 'ack') return true;
  if (r.context?.ineffectiveReason && r.options.some(o => o.value === false)) return false;
  const list = SIMULATE.has(r.kind) ? candidates(r) : null;
  if (!list || list.length < 2) return safeRules(m, r);
  const seed = (m._m.seed ^ Math.imul(m._m.decisionIndex + 1, 2654435761)) >>> 0, long = r.kind === 'defend';
  let bestValue = list[0], bestScore = -Infinity;
  for (const value of list.slice(0, 10)) {
    if (!legal(r, value)) continue;
    const score = rollout(m, r.actor, value, seed, long);
    if (score > bestScore + 1e-9) { bestScore = score; bestValue = value; }
  }
  return bestValue;
}
function answer(m, r) {
  let value;
  try { value = choose(m, r); } catch (e) { value = undefined; }
  if (value === undefined || !legal(r, value)) return H.aiAnswer(r);
  return H.makeAnswer(r, value);
}
const api = { answer, choose, evaluate, rulesValue, clone, W };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BreakMatchAI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
