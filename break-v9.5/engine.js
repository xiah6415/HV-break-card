/* BREAK 對練台 — 規則引擎（移植自 haikyu-sim/sim2.py） */
(function (root) {
'use strict';
const N = null, K = '烏野', A = '青城';
// code: [name, kind, srv, blk, rcv, tos, atk, value, school, year, text]
const DEF = {
  // ---- 烏野
  'P01-013': ['縁下 力', 'C', 1, 0, 2, 0, 0, 2, K, 2, '接球階段從手牌棄置：自己的烏野角色 1 人接球 +2'],
  'P02-003': ['月島 蛍', 'C', 1, 2, 3, 0, 2, 4, K, 1, '攔網登場：對手 Event 區 ≥2 張時，從手牌放 1 張 Event 到 Event 區 → 抽 1、攔網 +6'],
  'D01-005': ['西谷 夕', 'C', N, N, 5, 0, 0, 3, K, 2, '接球登場：付 3 Guts → 抽 1、接球 +2'],
  'P01-011': ['西谷 夕', 'C', N, N, 6, 0, 0, 3, K, 2, ''],
  'PR-033': ['西谷 夕', 'C', N, N, 6, 0, 0, 3, K, 2, ''],
  'P02-001': ['日向 翔陽', 'C', 2, 2, 0, 0, 3, 6, K, 1, '接球登場：雙方セット合計 ≤1 時，付 3 Guts → 接球 +6，棄牌區烏野角色 1 張回手'],
  'P03-051': ['西谷 夕', 'C', N, N, 5, 0, 0, 3, K, 2, '接球登場：付 2 Guts，付的全是烏野 → 接球 +2；對手攻擊手原始攻擊 0 時，對手進攻 −3'],
  'PR-022': ['澤村 大地', 'C', 1, 0, 5, 0, 0, 3, K, 3, '接球登場：對手發球/攻擊 ≤2 → A 傳球(1)；付 1 Guts 抽 1'],
  'PR-057': ['着地上手組。', 'C', N, N, 5, 0, 3, 5, K, 1, '登場時名稱可選「日向 翔陽」或「西谷 夕」，直到本回合結束（目前名稱選擇尚未自動化，見支援限制）'],
  'D01-009': ['菅原 孝支', 'C', 1, 1, 2, 2, 3, 4, K, 3, ''],
  'P01-006': ['影山 飛雄', 'C', 1, 1, 1, 1, 2, 9, K, 1, '舉球登場：付 2 Guts → 翻牌庫頂，日向或オープン攻撃加入手牌；本回合日向登場時攻擊 +2'],
  'P03-048': ['影山 飛雄', 'C', 1, 3, 0, 2, 2, 5, K, 1, ''],
  'PR-032': ['影山 飛雄', 'C', 4, 1, 2, 2, 1, 4, K, 1, ''],
  'PR-043': ['影山 飛雄', 'C', 3, 3, 0, 2, 0, 4, K, 1, ''],
  'PR-054': ['影山 飛雄', 'C', 5, 1, 1, 2, 1, 5, K, 1, ''],
  'P01-002': ['日向 翔陽', 'C', 2, 3, 1, 0, 1, 8, K, 1, '攻擊登場：付 3 Guts → 攻擊 +4，對手下回合不能派原始接球 ≥6 的接球手'],
  'P01-004': ['日向 翔陽', 'C', 2, 0, 5, 0, 3, 5, K, 1, ''],
  'BP-002': ['日向 翔陽', 'C', 1, 1, 1, 0, 2, 7, K, 1, '攻擊登場：棄 1 張手牌 → 攻擊 +2'],
  'P01-003': ['日向 翔陽', 'C', 1, 2, 2, 0, 2, 6, K, 1, '從手牌攻擊登場、手牌 ≤3、舉球是影山 → 攻擊 +2，對手下回合最多派 2 人攔網'],
  'PR-053': ['日向 翔陽', 'C', 3, 3, 2, 0, 3, 5, K, 1, ''],
  'D01-004': ['山口 忠', 'C', 5, 3, 3, 0, 1, 4, K, 1, ''],
  'P03-046': ['赤木 路成', 'C', N, N, 5, 0, 0, 3, '稲荷崎', 3, '接球登場：對手發球 ≤2 → 抽 1；對手發球 ≥6 → 接球 +2'],
  'P03-057': ['黒川 広樹', 'C', 0, 1, 0, 0, 2, 2, K, 0, '抽牌階段從手牌棄置：本回合自己的烏野 2/3 年角色登場時接球 +2，參數不會被降低'],
  'D01-012': ['ブロード攻撃', 'E', 0, 0, 0, 0, 0, 5, K, 0, '［攻擊］抽 1、攻擊 +1；舉球影山、攻擊日向 → 對手下回合最多派 1 人攔網'],
  'P01-074': ['烏養 一繋', 'E', 0, 0, 0, 0, 0, 3, K, 0, '［攻擊］抽 1、攻擊 +1；對手 Event 區抽牌/接球卡 ≥5 → 再 +2'],
  'P01-078': ['オープン攻撃', 'E', 0, 0, 0, 0, 0, 8, K, 0, '［攻擊］抽 2 棄 1；Event 區オープン ≤2 → 棄牌區日向登場攻擊區、攻擊 +1'],
  'P03-086': ['プレーは大分 おりこうさんよな', 'E', 0, 0, 0, 0, 0, 4, 'ユース', 0, '［舉球］S 舉球手舉球設為 2；可放牌庫底 → Event 區 1 張攻擊 Event 回手'],
  'P03-090': ['おれにバレーボール教えてくれて ありがとう', 'E', 0, 0, 0, 0, 0, 4, '音駒', 0, '［抽牌］每回合 1 次：Event 區 1 張其他 Event 回手'],
  'PR-029': ['鬼と 鬼だな', 'E', 0, 0, 0, 0, 0, 4, K, 0, '［抽牌］棄牌區日向、影山各最多 1 張回手'],
  'P03-096': ['日向 夏', 'E', 0, 0, 0, 0, 0, 5, K, 0, '［攔網/接球/攻擊］每回合 1 次：抽 1，日向 1 人任一數值 +1'],
  'P03-087': ['周りの上手さに引っ張られる', 'E', 0, 0, 0, 0, 0, 5, K, 0, '［接球/攻擊］每回合 1 次：全烏野或全ユース → 抽 1，角色 1 人攻擊 +1；指定影山可跨區付 6 Guts，再任一參數 +2（部分效果待補）'],
  // ---- 青葉城西（含 P04 / D04）
  'P01-033': ['及川 徹', 'C', 5, 0, 0, 1, 0, 7, A, 3, '發球/舉球登場：棄 1 張青城 → 任一參數 +1；對手手牌 ≥4 → 對手棄 1（目前僅加當階段數值）'],
  'D04-003': ['及川 徹', 'C', 5, 0, 1, 2, 2, 6, A, 3, ''],
  'P04-027': ['渡 親治', 'C', N, N, 6, 0, 0, 3, A, 2, ''],
  'P01-039': ['渡 親治', 'C', N, N, 5, 1, 0, 3, A, 2, '接球登場：對手進攻 ≥6，棄 1 張青城 → 接球 +1；全青城 → 抽 1'],
  'D04-010': ['国見 英', 'C', 1, 2, 5, 0, 2, 4, A, 1, ''],
  'P04-026': ['花巻 貴大', 'C', 1, 3, 5, 0, 0, 4, A, 3, ''],
  'P01-035': ['岩泉 一', 'C', 1, 3, 1, 0, 2, 7, A, 3, '攻擊登場：棄 1 張青城 → 攻擊 +2；對手手牌 ≤4 → 對手下回合不能用技能加牌'],
  'D04-004': ['岩泉 一', 'C', 5, 0, 4, 0, 3, 5, A, 3, ''],
  'D04-002': ['岩泉 一', 'C', 3, 3, 0, 0, 1, 6, A, 3, '攻擊登場：舉球是及川，付 2 Guts → 攻擊 +3（セット比對手少再 +1）'],
  'D04-011': ['京谷 賢太郎', 'C', 4, 2, 3, 0, 3, 5, A, 2, ''],
  'D04-006': ['松川 一静', 'C', 2, 3, 3, 0, 3, 5, A, 3, ''],
  'P04-024': ['松川 一静', 'C', 1, 3, 0, 1, 3, 5, A, 3, ''],
  'P01-087': ['俺も思った☆', 'E', 0, 0, 0, 0, 0, 5, A, 0, '［發球/舉球］及川在場：抽 1、及川舉球 +1；對手下回合每次非抽牌加手牌就棄 1'],
  'P04-088': ['ドンピシャ!!!', 'E', 0, 0, 0, 0, 0, 5, A, 0, '［攻擊］每回合 1 次：抽 1、青城攻擊手 +1；攻擊 ≥8 → 對手下回合接球手 −1'],
  'P04-089': ['3年間ありがとう!!!', 'E', 0, 0, 0, 0, 0, 5, A, 0, '［接球］每回合 1 次：抽 1、青城 3 年接球 +1；再棄 1 張青城 3 年角色 → +2'],
  'P01-088': ['お前達は 強いよ', 'E', 0, 0, 0, 0, 0, 4, A, 0, '［接球］最多抽 1，青城角色 1 人接球 +1；手牌 ≤3 再 +1（目前可不抽牌與目標選擇待補）'],
};
const HIN = new Set(['P02-001', 'P01-002', 'P01-004', 'BP-002', 'P01-003', 'PR-053']);
const DECKS = {
  k1014: { name: '烏野1014', cards: { 'D01-005': 2, 'P01-003': 1, 'P03-046': 2, 'P03-057': 1, 'P01-013': 1, 'P02-003': 1, 'P01-011': 2, 'P02-001': 1, 'P03-051': 2, 'PR-057': 1, 'D01-009': 1, 'P01-006': 4, 'P03-048': 3, 'PR-032': 1, 'PR-043': 1, 'P01-002': 3, 'P01-004': 2, 'BP-002': 3, 'D01-012': 2, 'P01-074': 1, 'P01-078': 2, 'P03-086': 1, 'P03-090': 1, 'PR-029': 1 } },
  k1014c: { name: '1014c（接 6 強化）', cards: { 'D01-005': 2, 'P03-046': 2, 'P01-013': 1, 'P02-003': 1, 'P01-011': 3, 'PR-033': 2, 'P02-001': 1, 'P03-051': 2, 'PR-057': 1, 'D01-009': 1, 'P01-006': 4, 'P03-048': 3, 'PR-032': 1, 'PR-043': 1, 'P01-002': 3, 'P01-004': 2, 'BP-002': 3, 'D01-012': 2, 'P01-078': 2, 'P03-086': 1, 'P03-090': 1, 'PR-029': 1 } },
  quick: { name: '烏野快攻版', cards: { 'P01-011': 3, 'PR-033': 3, 'PR-043': 3, 'P03-048': 3, 'PR-054': 1, 'BP-002': 4, 'P01-004': 4, 'P01-002': 3, 'PR-053': 3, 'D01-004': 3, 'D01-012': 2, 'P03-096': 2, 'P01-078': 2, 'P03-087': 2, 'P01-006': 2 } },
  k1010: { name: '烏野1010', cards: { 'P01-013': 1, 'P02-003': 2, 'D01-005': 1, 'P01-011': 3, 'P02-001': 1, 'P03-051': 2, 'PR-022': 2, 'PR-057': 1, 'D01-009': 1, 'P01-006': 4, 'P03-048': 3, 'PR-032': 1, 'PR-043': 1, 'P01-002': 3, 'P01-004': 2, 'BP-002': 4, 'D01-012': 2, 'P01-074': 1, 'P01-078': 2, 'P03-086': 1, 'P03-090': 1, 'PR-029': 1 } },
  seijoh: { name: '青葉城西（第四彈）', cards: { 'P01-033': 4, 'D04-003': 4, 'P04-027': 4, 'P01-039': 2, 'D04-010': 2, 'P04-026': 2, 'P01-035': 4, 'D04-004': 3, 'D04-002': 2, 'D04-011': 2, 'D04-006': 2, 'P04-024': 1, 'P01-087': 3, 'P04-088': 2, 'P04-089': 2, 'P01-088': 1 } },
  hk_axis: { name: '烏野 日向影山軸', cards: { 'P01-004': 5, 'D01-005': 3, 'PR-033': 3, 'P03-046': 2, 'P01-006': 4, 'PR-043': 5, 'P01-002': 3, 'BP-002': 4, 'P01-013': 2, 'P03-057': 1, 'P01-074': 1, 'P01-078': 2, 'D01-012': 2, 'PR-029': 1, 'P03-086': 2 } },
};

const nm = c => DEF[c][0];
const isC = c => DEF[c][1] === 'C';
const IDX = { srv: 2, blk: 3, rcv: 4, tos: 5, atk: 6 };
const st = (c, k) => DEF[c][IDX[k]];
const val = c => DEF[c][7];
const sch = c => DEF[c][8];
const yr = c => DEF[c][9];
const isK = c => sch(c) === K;
const isA = c => sch(c) === A;
const short = c => nm(c).split(' ')[0];
const recvName = c => (c === 'PR-057' ? '西谷 夕' : nm(c));
const atkName = c => (c === 'PR-057' ? '日向 翔陽' : nm(c));
const isHin = c => HIN.has(c) || c === 'PR-057';
const kuroEligible = c => isK(c) && (yr(c) === 2 || yr(c) === 3 || c === 'PR-057');
const EVT = {
  'D01-012': ['atk'], 'P01-074': ['atk'], 'P01-078': ['atk'], 'P03-086': ['tos'], 'P03-090': ['drw'], 'PR-029': ['drw'],
  'P03-096': ['atk', 'rcv', 'blk'], 'P03-087': ['atk', 'rcv'], 'P01-087': ['srv', 'tos'], 'P04-088': ['atk'], 'P04-089': ['rcv'], 'P01-088': ['rcv'],
};
function validateDecks() {
  for (const k in DECKS) {
    const d = DECKS[k].cards; let t = 0, e = 0;
    for (const c in d) { if (!DEF[c]) throw new Error('missing ' + c); t += d[c]; if (!isC(c)) e += d[c]; }
    if (t !== 40 || e > 8) throw new Error(k + ' size ' + t + ' ev ' + e);
  }
}
validateDecks();

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function rm(arr, c) { const i = arr.indexOf(c); if (i >= 0) arr.splice(i, 1); return i >= 0; }
const AREAS = ['serve', 'block', 'receive', 'toss', 'attack'];
const AREA_ZH = { serve: '發球', block: '攔網', receive: '接球', toss: '舉球', attack: '攻擊' };

class LostSignal { constructor(why) { this.why = why; } }

class Player {
  constructor(game, idx, deckKey, agent) {
    this.g = game; this.idx = idx; this.deckKey = deckKey; this.agent = agent;
    this.name = agent.label || (idx === 0 ? '你' : 'AI');
    this.deck = []; for (const [c, n] of Object.entries(DECKS[deckKey].cards)) for (let i = 0; i < n; i++) this.deck.push(c);
    game.shuffle(this.deck);
    this.hand = []; this.drop = []; this.ev = []; this.sets = [];
    this.area = { serve: [], block: [], receive: [], toss: [], attack: [] };
    this.restrict = {}; this.pending = {}; this.ts = {}; this.newCount = {};
  }
  get opp() { return this.g.players[1 - this.idx]; }
  handC() { return this.hand.filter(isC); }
  guts(a) { return Math.max(0, this.area[a].length - 1); }
  top(a) { const s = this.area[a]; return s.length ? s[s.length - 1] : null; }
  chars() { return AREAS.map(a => this.top(a)).filter(Boolean); }
  allSchool(s) { return this.chars().every(c => sch(c) === s); }
}

class Game {
  constructor(opts) {
    this.rand = rng(opts.seed == null ? (Date.now() & 0xffffffff) : opts.seed);
    this.logFn = opts.onLog || (() => {});
    this.reveal = opts.reveal == null ? -1 : opts.reveal; this.src = '';
    this.update = opts.onUpdate || (() => {});
    this.onNotice = opts.onNotice || (() => {});
    this.players = [new Player(this, 0, opts.decks[0], opts.agents[0]), new Player(this, 1, opts.decks[1], opts.agents[1])];
    this.ball = null; this.rallyNo = 0; this.turnNo = 0; this.server = null; this.winner = null; this.stats = {};
  }
  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } }
  log(s, cls) { this.logFn(s, cls); }
  tag(k) { this.stats[k] = (this.stats[k] || 0) + 1; }
  async ask(p, req) { this.update(); req.canLoss = this.turnP === p && !['mulligan', 'roll', 'lossConfirm'].includes(req.kind); const r = await p.agent.choose(this, p, req); if (r && r.__loss && req.canLoss) this.lost(p, '主動 Loss（放棄這球）'); return r; }
  async notice(data) { this.update(); await this.onNotice({ rally: this.rallyNo, ...data }); }
  async yes(p, kind, prompt, ctx) { const r = await this.ask(p, { kind, prompt, ctx, options: [{ label: '發動', value: true }, { label: '不發動', value: false }] }); return r; }

  // ---------- card movement
  draw(p, n = 1, why = '') {
    const got = [];
    for (let i = 0; i < n; i++) { if (!p.deck.length) { this.log(`${p.name} 牌庫空，無法抽牌`, 'warn'); break; } const c = p.deck.pop(); p.hand.push(c); got.push(c); p.newCount[c] = (p.newCount[c] || 0) + 1; }
    if (got.length) {
      const tag = why ? `（${why}）` : '';
      if (p.idx === this.reveal) this.log(`${p.name}${tag}抽到：${got.map(nm).join('、')}`, 'draw');
      else this.log(`${p.name}${tag}抽 ${got.length} 張（手牌 ${p.hand.length}）`, 'draw');
    }
    return got.length;
  }
  sdraw(p, n = 1) { if (p.restrict.no_add) { this.log(`${p.name} 被岩泉封鎖，${this.src || '技能'}的抽牌無效`, 'warn'); return 0; } return this.draw(p, n, this.src || '技能'); }
  async sadd(p, c, src) {
    if (p.restrict.no_add) { this.log(`${p.name} 被岩泉封鎖，無法加入手牌`, 'warn'); return false; }
    rm(src, c); p.hand.push(c);
    for (let i = 0; i < (p.restrict.oremo || 0); i++) if (p.hand.length) await this.discard(p, '俺も思った☆：加入手牌後棄 1 張');
    return true;
  }
  async pickHand(p, prompt, filter, kind = 'discard') {
    const cands = [...new Set(p.hand.filter(filter || (() => true)))];
    if (!cands.length) return null;
    const c = await this.ask(p, { kind, prompt, options: cands.map(x => ({ label: `${nm(x)}`, card: x, value: x })) });
    return c;
  }
  async optionalRetrieve(p, prompt, candidates) {
    if (!candidates.length || p.restrict.no_add) return null;
    return this.ask(p, { kind: 'retrieve', prompt, options: [...candidates.map(c => ({ label: nm(c) + ' ' + c, card: c, value: c })), { label: '不加入手牌', value: null }] });
  }
  async revealTop(p, source, eligible) {
    // The flip request must not contain the still-hidden top card.
    if (p.deck.length && p.agent.wantsAck) await this.ask(p, {
      kind: 'reveal', prompt: `${source}：請翻開牌庫頂 1 張`,
      options: [{ label: '翻開牌庫頂', value: true }]
    });
    const card = p.deck[p.deck.length - 1] || null;
    const matches = card && eligible(card);
    const canTake = matches && !p.restrict.no_add;
    const reason = !card ? '牌庫已空，沒有可翻開的牌。' : !matches ? '沒有符合條件的牌，已放回牌庫底。' : p.restrict.no_add ? '符合條件，但受到禁止加入手牌的效果影響，已放回牌庫底。' : '符合條件：可以加入手牌，也可以放回牌庫底。';
    if (card) this.log(`${source}翻開：${nm(card)}（${card}）`);
    if (card && !canTake) p.deck.unshift(p.deck.pop());
    const ctx = { revealed: card, source, reason };
    let take = null;
    if (canTake) take = await this.ask(p, {
      kind: 'retrieve', prompt: `${source}：${reason}`, ctx,
      options: [{ label: '加入手牌', card, value: card }, { label: '不加入，放回牌庫底', value: null }]
    });
    else if (p.agent.wantsAck) await this.ask(p, {
      kind: 'revealResult', prompt: `${source}：${reason}`, ctx,
      options: [{ label: '看完了，繼續', value: true }]
    });
    if (!p.agent.wantsAck) await this.notice({
      type: 'reveal', player: p.idx, card, source, reason,
      result: !card ? '沒有翻牌' : take === card ? '加入手牌' : '放回牌庫底'
    });
    if (card) {
      if (take === card) { const top = [p.deck.pop()]; await this.sadd(p, card, top); this.log(`${source}：${nm(card)} 加入手牌`); }
      else { if (canTake) p.deck.unshift(p.deck.pop()); this.log(`${source}：${nm(card)} 放回牌庫底。${reason}`, 'draw'); }
    } else this.log(`${source}：${reason}`, 'warn');
  }
  async discard(p, prompt, filter) {
    const c = await this.pickHand(p, prompt, filter);
    if (c) { rm(p.hand, c); p.drop.push(c); this.log(`${p.name} 棄掉 ${nm(c)}`); }
    return c;
  }
  async pay(p, a, n) {
    const s = p.area[a];
    let idx = null;
    if (p.agent.wantsAck && s.length - 1 > n) {
      const r = await this.ask(p, { kind: 'guts', multi: true, need: n, area: a, prompt: `付 ${n} Guts：從${AREA_ZH[a]}區選 ${n} 張（最上面的角色不能付）`, options: s.slice(0, -1).map((c, i) => ({ label: nm(c), card: c, value: i })) });
      if (Array.isArray(r) && new Set(r).size === n && r.every(i => i >= 0 && i < s.length - 1)) idx = [...new Set(r)].sort((x, y) => y - x);
    }
    const paid = idx ? idx.map(i => s.splice(i, 1)[0]).reverse() : s.splice(0, n); p.drop.push(...paid); if (paid.length) this.log(`${p.name} 付 ${paid.length} Guts（${AREA_ZH[a]}區）：${paid.map(nm).join('、')} → 棄牌區`, 'guts'); return paid; }
  place(p, a, c) { rm(p.hand, c); p.area[a].push(c); }

  // ---------- main loop
  async run() {
    const [P0, P1] = this.players;
    let d0, d1; do { d0 = 1 + Math.floor(this.rand() * 6); d1 = 1 + Math.floor(this.rand() * 6); } while (d0 === d1);
    let server = d0 > d1 ? P0 : P1;
    this.dice = [d0, d1]; this.firstServer = server.idx;
    this.log(`擲骰：${P0.name} ${d0} vs ${P1.name} ${d1} → ${server.name} 取得發球權，從發球方開始調度`, 'head');
    for (const p of this.players) if (p.agent.wantsAck) await this.ask(p, { kind: 'roll', prompt: '擲骰決定發球權', ctx: { dice: [d0, d1], server: server.idx }, options: [{ label: '開始調度', value: true }] });
    for (const p of [server, server.opp]) {
      this.draw(p, 6, '起手');
      const back = await this.ask(p, { kind: 'mulligan', role: p === server ? 'serve' : 'receive', multi: true, prompt: '起手調度：點選要放回牌庫的牌（可 0～6 張），放回幾張就重抽幾張', options: p.hand.map((c, i) => ({ label: nm(c), card: c, value: i })) });
      if (back && back.length) {
        const idx = [...new Set(back)].sort((a, b) => b - a);
        const ret = idx.map(i => p.hand.splice(i, 1)[0]);
        p.deck.push(...ret); this.shuffle(p.deck); this.draw(p, ret.length, '調度');
        this.log(`${p.name} 調度：放回 ${ret.length} 張並重抽`);
      } else this.log(`${p.name} 保留起手`);
      p.sets = [p.deck.pop(), p.deck.pop()];
    }
    for (;;) {
      this.rallyNo++;
      this.server = server.idx;
      this.log(`第 ${this.rallyNo} 球 — ${server.name} 發球`, 'head');
      let loser = null, lossReason = '回合往返達上限';
      try {
        this.ball = await this.serveTurn(server);
        let cur = server.opp;
        for (let t = 0; t < 80; t++) { this.target = cur.idx; this.ball = await this.defendTurn(cur); cur = cur.opp; }
        loser = cur;
      } catch (e) {
        if (!(e instanceof LostSignal)) throw e;
        loser = e.who; lossReason = e.why;
        this.cleanupSides(loser);
        if (loser.agent.wantsAck && !lossReason.startsWith('主動 Loss')) {
          await this.ask(loser, { kind: 'lossConfirm', prompt: `${loser.name} 無法繼續這球：${lossReason}`, reason: lossReason, options: [{ label: '喊 Loss', value: true }] });
        }
        this.log(`${loser.name} ロスト：${lossReason}`, 'lost');
      }
      await this.notice({ type: 'loss', player: loser.idx, reason: lossReason, winner: loser.opp.idx, final: !loser.sets.length });
      this.turnP = null;
      for (const p of this.players) { p.pending = {}; p.restrict = {}; p.ts = {}; }
      this.ball = null; this.target = null;
      const winner = loser.opp;
      if (!loser.sets.length) { this.winner = winner; this.log(`${winner.name} 獲勝！`, 'win'); this.update(); return winner; }
      for (const p of this.players) { p.newCount = {}; if (p.hand.length < 6) this.draw(p, 6 - p.hand.length, 'インターバル補牌'); }
      loser.hand.push(loser.sets.pop());
      const setCard = loser.hand[loser.hand.length - 1]; loser.newCount[setCard] = (loser.newCount[setCard] || 0) + 1;
      this.log(`インターバル：雙方補到 6 張，${loser.name} 再把 1 張セットカード加入手牌${loser.idx === this.reveal ? '：' + nm(setCard) : ''}（剩 ${loser.sets.length}）`, 'draw');
      server = winner;
      this.update();
    }
  }
  lost(p, why) { const e = new LostSignal(why); e.who = p; throw e; }
  cleanupSides(p) {
    const sides = p.ts.sides || [];
    if (!sides.length) return;
    p.ts.sides = [];
    p.drop.push(...sides);
    if (sides.length) this.log(`側攔 ${sides.map(nm).join('、')} → 棄牌區`, 'guts');
  }
  beginTurn(p) { this.turnP = p; this.turnNo++; p.restrict = p.pending; p.pending = {}; p.ts = { used: {} }; p.newCount = {}; this.src = ''; }
  async confirmTurnEnd(p, outgoing) {
    if (!p.agent.wantsAck) return;
    const label = { serve: '發球', attack: '進攻', block: '攔網回球' }[outgoing.type];
    await this.ask(p, { kind: 'turnEnd', prompt: `${label}準備完成：${outgoing.off}。尚未交棒，可結束回合或喊 Loss`, outgoing, options: [{ label: '結束回合', value: true }] });
  }

  // ---------- serve
  async serveTurn(p) {
    this.beginTurn(p);
    await this.notice({ type: 'serve', player: p.idx });
    const o = p.opp;
    const cs = [...new Set(p.handC().filter(c => st(c, 'srv') != null))];
    if (!cs.length) this.lost(p, '沒有能發球的角色');
    const c = await this.ask(p, { kind: 'serve', prompt: '選擇發球角色', options: cs.map(x => ({ label: `${nm(x)}　發 ${st(x, 'srv')}`, card: x, value: x })) });
    this.place(p, 'serve', c); this.src = nm(c);
    let off = st(c, 'srv');
    if (c === 'P01-033' && p.hand.some(isA) && await this.yes(p, 'skill', `及川：棄 1 張青城 → 發球 +1${o.hand.length >= 4 ? '，對手棄 1' : ''}？`, { card: c })) {
      await this.discard(p, '選 1 張青城棄掉', isA); off += 1;
      if (o.hand.length >= 4) await this.discard(o, '及川 033：你要棄 1 張手牌');
    }
    await this.eventLoop(p, 'srv', { serveChar: c });
    await this.confirmTurnEnd(p, { type: 'serve', off });
    this.log(`${p.name} 發球 ${nm(c)} → 威力 ${off}`);
    return { type: 'serve', off };
  }

  // ---------- defend
  async defendTurn(p) {
    this.beginTurn(p);
    const ball = this.ball;
    await this.notice({ type: 'turn', player: p.idx, from: p.opp.idx, ball: { ...ball }, toss: ball.type === 'attack' ? p.opp.ts.toss : null, attack: ball.type === 'attack' ? p.opp.ts.atk : null });
    if (ball.type === 'attack') {
      const combos = this.blockCombos(p, ball.off);
      if (combos.length) {
        const ch = await this.ask(p, { kind: 'defend', prompt: `來球：攻擊 ${ball.off}。要攔網還是接球？`, ball, combos, options: [{ label: '接球（抽 1 張）', value: 'receive' }, { label: '攔網（不抽牌）', value: 'block' }] });
        if (ch === 'block') return await this.blockTurn(p, combos);
      }
    }
    return await this.receiveTurn(p);
  }
  blockMax(p) { return p.restrict.one_blocker ? 1 : p.restrict.two_blockers ? 2 : 3; }
  blockCands(p) { return [...new Set(p.handC().filter(c => st(c, 'blk') != null))]; }
  evalBlock(p, combo, off = this.ball.off) {
    const o = p.opp, evInHand = p.hand.some(x => !isC(x));
    let total = combo.reduce((s, c) => s + st(c, 'blk'), 0), tsu = false;
    if (combo.includes('P02-003') && o.ev.length >= 2 && evInHand) { total += 6; tsu = true; }
    const natsu = p.hand.includes('P03-096') && combo.some(x => HIN.has(x)) && !(combo.includes('P02-003') && tsu && p.hand.filter(x => !isC(x)).length < 2) ? 1 : 0;
    const names = new Set(combo.map(nm));
    const legal = combo.length >= 1 && combo.length <= this.blockMax(p) && names.size === combo.length && combo.every(c => p.hand.includes(c) && st(c, 'blk') != null);
    return { cards: [...combo], total, tsu, natsu: total < off && natsu > 0, ok: legal && total + natsu >= off, legal, cost: combo.length * 10 + combo.reduce((s, c) => s + val(c), 0) + (total < off ? 3 : 0) };
  }
  blockCombos(p, off) {
    const maxn = this.blockMax(p), cs = this.blockCands(p), res = [];
    const rec = (start, combo) => {
      if (combo.length) { const r = this.evalBlock(p, combo, off); if (r.ok) res.push(r); }
      if (combo.length >= maxn) return;
      for (let i = start; i < cs.length; i++) {
        if (combo.some(x => nm(x) === nm(cs[i]))) continue;
        combo.push(cs[i]); rec(i + 1, combo); combo.pop();
      }
    };
    rec(0, []);
    res.sort((a, b) => a.cost - b.cost);
    return res.slice(0, 12);
  }
  async blockTurn(p, combos) {
    const pick = await this.ask(p, { kind: 'block', build: { cands: this.blockCands(p), max: this.blockMax(p) }, prompt: `組攔網（需 ≥ ${this.ball.off}）`, options: combos.map((cb, i) => ({ label: `${cb.cards.map(short).join('＋')}　攔 ${cb.total}${cb.tsu ? '（含月島 +6）' : ''}${cb.natsu ? '（還要用日向夏 +1）' : ''}`, value: i, cards: cb.cards })) });
    let cb, center;
    if (pick && typeof pick === 'object') {
      cb = this.evalBlock(p, pick.cards);
      if (!cb.ok) cb = combos[0];
      center = cb.tsu ? 'P02-003' : (pick.center && cb.cards.includes(pick.center) ? pick.center : cb.cards[0]);
    } else { cb = combos[pick]; center = cb.tsu ? 'P02-003' : cb.cards.slice().sort((a, b) => val(b) - val(a))[0]; }
    this.place(p, 'block', center); this.src = '月島';
    const sides = cb.cards.filter(c => c !== center); for (const c of sides) rm(p.hand, c);
    p.ts.sides = sides;
    if (cb.tsu) {
      const e = await this.pickHand(p, '月島：選 1 張 Event 放到 Event 區', x => !isC(x), 'cost');
      rm(p.hand, e); p.ev.push(e); this.sdraw(p, 1);
    }
    p.ts.blk = cb.total; p.ts.blockers = cb.cards.slice();
    this.log(`${p.name} 攔網 ${cb.cards.map(short).join('＋')}：攔 ${cb.total} vs ${this.ball.off}`);
    await this.eventLoop(p, 'blk', {});
    this.cleanupSides(p);
    if (p.ts.blk < this.ball.off) this.lost(p, `攔網 ${p.ts.blk} 小於進攻 ${this.ball.off}`);
    this.log(`攔網成功（${p.ts.blk} ≥ ${this.ball.off}），回球 0；側攔進棄牌區`);
    await this.confirmTurnEnd(p, { type: 'block', off: 0 });
    this.tag(p.idx + ':block');
    return { type: 'block', off: 0 };
  }

  // ---------- receive turn
  async receiveTurn(p) {
    const o = p.opp, ball = this.ball, off = ball.off;
    if (p.agent.wantsAck) await this.ask(p, { kind: 'ack', prompt: `抽牌階段：來球 ${ball.type === 'serve' ? '發球' : ball.type === 'block' ? '攔網回球' : '攻擊'} ${off}，先抽 1 張`, options: [{ label: '抽 1 張', value: true }] });
    this.draw(p, 1, '抽牌階段');
    await this.eventLoop(p, 'drw', {});
    // receive
    const cs = [...new Set(p.handC().filter(c => st(c, 'rcv') != null && !(p.restrict.no_rcv6 && st(c, 'rcv') >= 6)))];
    if (!cs.length) this.lost(p, '沒有能接球的角色');
    const c = await this.ask(p, { kind: 'receiver', prompt: `來球：${ball.type === 'serve' ? '發球' : ball.type === 'block' ? '攔網回球' : '攻擊'} ${off}。選擇接球角色`, ball, options: cs.map(x => ({ label: `${nm(x)}　接 ${this.rcvPreview(p, x)}`, card: x, value: x })) });
    this.place(p, 'receive', c); this.src = nm(c);
    const kuro = p.ts.kurokawa && kuroEligible(c);
    let r = st(c, 'rcv') - (kuro ? 0 : (p.restrict.rcv_minus || 0));
    if (p.restrict.rcv_minus && !kuro) this.log(`ドンピシャ!!!：${nm(c)} 接球 −${p.restrict.rcv_minus}`, 'warn');
    if (kuro) { r += 2; this.log('黒川：接球 +2，數值不會被降低'); }
    const g = p.guts('receive');
    if (c === 'D01-005' && g >= 3 && await this.yes(p, 'skill', '西谷：付 3 Guts → 抽 1、接球 +2？', { card: c, need: off - r })) { await this.pay(p, 'receive', 3); this.sdraw(p, 1); r += 2; }
    if (c === 'P03-051' && g >= 2 && await this.yes(p, 'skill', `西谷：付 2 Guts（全是烏野時）→ 接球 +2${ball.type === 'attack' && o.ts.attacker && st(o.ts.attacker, 'atk') === 0 ? '，對手攻擊手原始攻擊 0 → 對手進攻 −3' : ''}？`, { card: c, need: off - r })) {
      const paid = await this.pay(p, 'receive', 2);
      if (paid.every(isK)) {
        r += 2;
        if (ball.type === 'attack' && o.ts.attacker && st(o.ts.attacker, 'atk') === 0) { ball.off = Math.max(0, ball.off - 3); this.log(`西谷：對手進攻 −3 → ${ball.off}`); }
      } else this.log('付的 Guts 不全是烏野，沒有效果', 'warn');
    }
    if (c === 'P02-001' && p.sets.length + o.sets.length <= 1 && g >= 3 && await this.yes(p, 'skill', '日向：付 3 Guts → 接球 +6、棄牌區烏野角色回手？', { card: c, need: off - r })) {
      await this.pay(p, 'receive', 3); r += 6;
      const cand = [...new Set(p.drop.filter(x => isC(x) && isK(x)))];
      const x = await this.optionalRetrieve(p, '最多選 1 張烏野角色回手', cand);
      if (x) await this.sadd(p, x, p.drop);
    }
    if (c === 'PR-022' && ball.type !== 'block' && off <= 2) { p.ts.apass = 1; this.log('澤村：A 傳球(1)'); if (p.guts('receive') >= 1 && await this.yes(p, 'skill', '澤村：付 1 Guts 抽 1？', { card: c })) { await this.pay(p, 'receive', 1); this.sdraw(p, 1); } }
    if (c === 'P03-046' && ball.type === 'serve') { if (off <= 2) { this.sdraw(p, 1); this.log('赤木：抽 1'); } if (off >= 6) { r += 2; this.log('赤木：接球 +2'); } }
    if (c === 'P01-039' && off >= 6 && p.hand.some(isA) && await this.yes(p, 'skill', '渡：棄 1 張青城 → 接球 +1？', { card: c, need: off - r })) { await this.discard(p, '選 1 張青城棄掉', isA); r += 1; if (p.allSchool(A)) this.sdraw(p, 1); }
    p.ts.rcv = r; p.ts.receiver = c;
    this.log(`${p.name} 接球 ${nm(c)}：${r} vs ${off}`);
    await this.eventLoop(p, 'rcv', {});
    r = p.ts.rcv;
    if (r < ball.off) this.lost(p, `接球 ${r} 小於來球 ${ball.off}`);
    this.log(`接球成功（${r} ≥ ${ball.off}）`);
    // toss
    const rname = recvName(c);
    const ts = [...new Set(p.handC().filter(x => st(x, 'tos') != null && nm(x) !== rname))];
    if (!ts.length) this.lost(p, '沒有能舉球的角色');
    const t = await this.ask(p, { kind: 'setter', prompt: '選擇舉球角色', options: ts.map(x => ({ label: `${nm(x)}　舉 ${st(x, 'tos')}`, card: x, value: x })) });
    this.place(p, 'toss', t); this.src = nm(t);
    let toss = st(t, 'tos') + (p.ts.apass || 0);
    if (t === 'P01-006' && p.guts('toss') >= 2 && await this.yes(p, 'skill', '影山：付 2 Guts → 翻牌庫頂找日向/オープン，本回合日向攻擊 +2？', { card: t })) {
      await this.pay(p, 'toss', 2); p.ts.hin = 2;
      await this.revealTop(p, '影山', top => isHin(top) && top !== 'PR-057' || top === 'P01-078');
    }
    if (t === 'P01-033' && p.hand.some(isA) && await this.yes(p, 'skill', `及川：棄 1 張青城 → 舉球 +1${o.hand.length >= 4 ? '，對手棄 1' : ''}？`, { card: t })) {
      await this.discard(p, '選 1 張青城棄掉', isA); toss += 1;
      if (o.hand.length >= 4) await this.discard(o, '及川 033：你要棄 1 張手牌');
    }
    p.ts.toss = toss; p.ts.setter = t;
    this.log(`${p.name} 舉球 ${nm(t)}：${toss}`);
    await this.eventLoop(p, 'tos', {});
    // attack
    const tname = nm(t);
    const as = [...new Set(p.handC().filter(x => st(x, 'atk') != null && atkName(x) !== tname))];
    if (!as.length) this.lost(p, '沒有能攻擊的角色');
    const a = await this.ask(p, { kind: 'attacker', prompt: '選擇攻擊角色', options: as.map(x => ({ label: `${nm(x)}　攻 ${st(x, 'atk')}${isHin(x) && p.ts.hin ? ' +2' : ''}`, card: x, value: x })) });
    await this.enterAttack(p, a, false);
    await this.eventLoop(p, 'atk', {});
    const offense = p.ts.toss + p.ts.atk;
    await this.confirmTurnEnd(p, { type: 'attack', off: offense });
    this.log(`${p.name} 攻擊 ${nm(p.ts.attacker)}：舉 ${p.ts.toss} ＋ 攻 ${p.ts.atk} ＝ 進攻 ${offense}`, 'atk');
    this.tag(p.idx + ':attack');
    return { type: 'attack', off: offense };
  }
  rcvPreview(p, c) {
    const kuro = p.ts.kurokawa && kuroEligible(c);
    let r = st(c, 'rcv') - (kuro ? 0 : (p.restrict.rcv_minus || 0));
    const g = p.guts('receive') + (p.area.receive.length ? 1 : 0);
    const extra = [];
    if (c === 'D01-005' && g >= 3) extra.push('+2');
    if (c === 'P03-051' && g >= 2) extra.push('+2');
    if (c === 'P02-001' && p.sets.length + p.opp.sets.length <= 1 && g >= 3) extra.push('+6');
    if (c === 'P03-046' && this.ball.type === 'serve' && this.ball.off >= 6) extra.push('+2');
    if (kuro) r += 2;
    return r + (extra.length ? `（技能 ${extra.join('')}）` : '');
  }
  async enterAttack(p, a, fromDrop) {
    const o = p.opp; this.src = nm(a);
    if (fromDrop) { rm(p.drop, a); p.area.attack.push(a); } else this.place(p, 'attack', a);
    let atk = st(a, 'atk');
    const g = p.guts('attack');
    const t = p.ts.setter;
    if (a === 'P01-002' && g >= 3 && await this.yes(p, 'skill', '日向：付 3 Guts → 攻擊 +4，對手下回合不能派原始接球 ≥6？', { card: a })) { await this.pay(p, 'attack', 3); atk += 4; o.pending.no_rcv6 = 1; }
    if (a === 'BP-002' && p.hand.length && await this.yes(p, 'skill', '日向：棄 1 張手牌 → 攻擊 +2？', { card: a })) { await this.discard(p, '選 1 張手牌棄掉（棄日向可當オープン的彈藥）'); atk += 2; }
    if (a === 'P01-003' && !fromDrop && p.hand.length <= 3 && nm(t) === '影山 飛雄') { atk += 2; o.pending.two_blockers = 1; this.log('日向 003：攻擊 +2，對手下回合最多 2 人攔網'); }
    if (a === 'P01-035' && p.hand.some(isA) && await this.yes(p, 'skill', `岩泉：棄 1 張青城 → 攻擊 +2${o.hand.length <= 4 ? '，對手下回合不能用技能加牌' : ''}？`, { card: a })) {
      await this.discard(p, '選 1 張青城棄掉', isA); atk += 2;
      if (o.hand.length <= 4) { o.pending.no_add = 1; this.log(`岩泉：${o.name} 下回合不能用技能加牌`, 'warn'); }
    }
    if (a === 'D04-002' && nm(t) === '及川 徹' && g >= 2 && await this.yes(p, 'skill', '岩泉：付 2 Guts → 攻擊 +3？', { card: a })) { await this.pay(p, 'attack', 2); atk += 3 + (p.sets.length < o.sets.length ? 1 : 0); }
    if (isHin(a) && p.ts.hin) atk += p.ts.hin;
    p.ts.atk = atk; p.ts.attacker = a;
    this.log(`${p.name} 攻擊手 ${nm(a)}：攻 ${atk}`);
  }

  // ---------- events
  playable(p, timing) {
    const o = p.opp, res = [];
    // Draw-phase cards remain available until the receive check resolves.
    const drawWindow = timing === 'drw' || timing === 'rcv';
    const seen = new Set();
    for (const c of p.hand) {
      if (seen.has(c)) continue; seen.add(c);
      const T = EVT[c];
      if (isC(c)) {
        if (c === 'P01-013' && timing === 'rcv' && p.ts.receiver && isK(p.ts.receiver)) res.push({ card: c, label: '縁下（棄掉）：接球 +2' });
        if (c === 'P03-057' && drawWindow && !p.ts.kurokawa) res.push({ card: c, label: '黒川（棄掉）：本回合 2/3 年烏野接球 +2' });
        continue;
      }
      if (!T || !(T.includes(timing) || (drawWindow && T.includes('drw')))) continue;
      if (p.ts.used[c] && ['P03-090', 'P03-096', 'P03-087', 'P04-088', 'P04-089'].includes(c)) continue;
      const ok = {
        'PR-029': () => !p.restrict.no_add && p.drop.some(x => isHin(x) && x !== 'PR-057' || nm(x) === '影山 飛雄'),
        'P03-090': () => !p.restrict.no_add && p.ev.some(x => x !== 'P03-090'),
        'P03-086': () => !!p.ts.setter && ['影山 飛雄', '菅原 孝支', '及川 徹'].includes(nm(p.ts.setter)),
        'P01-087': () => ['serve', 'toss'].some(a => p.top(a) && nm(p.top(a)) === '及川 徹'),
        'P01-078': () => !!p.ts.attacker,
        'D01-012': () => !!p.ts.attacker, 'P01-074': () => !!p.ts.attacker,
        'P03-096': () => (timing === 'atk' ? p.ts.attacker && isHin(p.ts.attacker) : timing === 'rcv' ? p.ts.receiver && isHin(p.ts.receiver) : timing === 'blk' ? (p.ts.blockers || []).some(x => HIN.has(x)) : false),
        'P03-087': () => timing === 'atk' && p.ts.attacker && p.allSchool(K),
        'P04-088': () => p.ts.attacker && isA(p.ts.attacker),
        'P04-089': () => p.ts.receiver && isA(p.ts.receiver) && yr(p.ts.receiver) === 3,
        'P01-088': () => p.ts.receiver && isA(p.ts.receiver),
      }[c];
      if (ok && ok()) res.push({ card: c, label: nm(c) });
    }
    return res;
  }
  async eventLoop(p, timing, ctx) {
    for (;;) {
      const opts = this.playable(p, timing);
      if (!opts.length) return;
      const zh = { srv: '發球階段', drw: '抽牌階段', rcv: '接球判定前', tos: '舉球階段', atk: '攻擊階段', blk: '攔網階段' }[timing];
      const status = timing === 'blk' ? `目前攔網 ${p.ts.blk} vs 進攻 ${this.ball.off}` : timing === 'rcv' ? `目前接球 ${p.ts.rcv} vs 來球 ${this.ball.off}` : timing === 'atk' ? `目前進攻 ${p.ts.toss + p.ts.atk}` : timing === 'tos' ? `目前舉球 ${p.ts.toss}` : '';
      const pick = await this.ask(p, { kind: 'event', timing, prompt: `${zh}：要使用卡片嗎？${status ? '　' + status : ''}`, options: [...opts.map(o => ({ label: o.label, card: o.card, value: o.card })), { label: timing === 'rcv' ? '完成事件，判定接球' : '結束，進入下一步', value: null }] });
      if (!pick) return;
      await this.resolve(p, pick, timing);
    }
  }
  async resolve(p, c, timing) {
    const o = p.opp; this.src = nm(c);
    rm(p.hand, c);
    if (isC(c)) {
      p.drop.push(c);
      if (c === 'P01-013') { p.ts.rcv += 2; this.log(`${p.name} 棄縁下：接球 +2 → ${p.ts.rcv}`); }
      if (c === 'P03-057') {
        p.ts.kurokawa = 1;
        const receiver = p.ts.receiver;
        if (timing === 'rcv' && receiver && kuroEligible(receiver)) {
          p.ts.rcv += 2 + (p.restrict.rcv_minus || 0);
          this.log(`黒川：目前接球 +2，數值不會被降低 → ${p.ts.rcv}`);
        }
        this.log(`${p.name} 棄黒川：本回合 2/3 年烏野接球 +2`);
      }
      return;
    }
    p.ev.push(c); p.ts.used[c] = 1;
    this.log(`${p.name} 打出 ${nm(c)}`, 'ev');
    switch (c) {
      case 'PR-029': {
        for (const want of [x => isHin(x) && x !== 'PR-057', x => nm(x) === '影山 飛雄']) {
          const cand = [...new Set(p.drop.filter(want))];
          if (!cand.length) continue;
          const x = await this.optionalRetrieve(p, '鬼と鬼だな：最多選 1 張回手', cand);
          if (x && await this.sadd(p, x, p.drop)) this.log(`回收 ${nm(x)}`);
        }
        break;
      }
      case 'P03-090': {
        const cand = [...new Set(p.ev.filter(x => x !== 'P03-090'))];
        const x = await this.ask(p, { kind: 'retrieve', prompt: 'ありがとう：選 1 張 Event 回手', options: cand.map(y => ({ label: nm(y), card: y, value: y })) });
        if (await this.sadd(p, x, p.ev)) this.log(`回收 ${nm(x)}`);
        break;
      }
      case 'P03-086': {
        p.ts.toss = 2; this.log('舉球設為 2');
        const back = [...new Set(p.ev.filter(x => EVT[x] && EVT[x].length === 1 && EVT[x][0] === 'atk'))];
        if (await this.yes(p, 'skill', 'おりこう：放回牌庫底，從 Event 區最多拿 1 張攻擊 Event 回手？', {})) {
          const x = await this.optionalRetrieve(p, '最多選 1 張攻擊 Event 回手', back);
          rm(p.ev, c); p.deck.unshift(c);
          if (x && await this.sadd(p, x, p.ev)) this.log(`回收 ${nm(x)}`);
        }
        break;
      }
      case 'P01-087': { this.sdraw(p, 1); if (timing === 'tos' && p.ts.setter && nm(p.ts.setter) === '及川 徹') p.ts.toss += 1; o.pending.oremo = (o.pending.oremo || 0) + 1; this.log(`${o.name} 下回合每次非抽牌加手牌要棄 1`, 'warn'); break; }
      case 'P01-078': {
        this.sdraw(p, 2);
        if (p.hand.length) await this.discard(p, 'オープン攻撃：抽 2 後棄 1 張');
        if (p.ev.filter(x => x === 'P01-078').length <= 2 && nm(p.ts.setter) !== '日向 翔陽') {
          const hs = [...new Set(p.drop.filter(x => HIN.has(x)))];
          if (hs.length) {
            const h = hs.length === 1 ? hs[0] : await this.ask(p, { kind: 'summon', prompt: 'オープン攻撃：選棄牌區的日向登場攻擊區（必須）', options: hs.map(y => ({ label: `${nm(y)} ${y}　攻 ${st(y, 'atk')}`, card: y, value: y })) });
            await this.enterAttack(p, h, true); p.ts.atk += 1; this.log(`オープン攻撃：${nm(h)} 登場，攻擊 → ${p.ts.atk}`);
          } else this.log('棄牌區沒有日向，オープン只抽牌');
        }
        break;
      }
      case 'D01-012': { this.sdraw(p, 1); p.ts.atk += 1; if (nm(p.ts.setter) === '影山 飛雄' && atkName(p.ts.attacker) === '日向 翔陽') { o.pending.one_blocker = 1; this.log(`${o.name} 下回合最多派 1 人攔網`, 'warn'); } break; }
      case 'P01-074': { this.sdraw(p, 1); p.ts.atk += 1; if (o.ev.filter(x => EVT[x] && (EVT[x].includes('drw') || EVT[x].includes('rcv'))).length >= 5) p.ts.atk += 2; break; }
      case 'P03-096': { this.sdraw(p, 1); if (timing === 'atk') p.ts.atk += 1; else if (timing === 'rcv') p.ts.rcv += 1; else if (timing === 'blk') p.ts.blk += 1; break; }
      case 'P03-087': { this.sdraw(p, 1); p.ts.atk += 1; break; }
      case 'P04-088': { this.sdraw(p, 1); p.ts.atk += 1; if (p.ts.atk >= 8) { o.pending.rcv_minus = 1; this.log(`${o.name} 下回合接球手 −1`, 'warn'); } break; }
      case 'P04-089': {
        this.sdraw(p, 1); p.ts.rcv += 1;
        if (p.hand.some(x => isC(x) && isA(x) && yr(x) === 3) && await this.yes(p, 'skill', '3年間：再棄 1 張青城 3 年角色 → 接球 +2？', {})) { await this.discard(p, '選 1 張青城 3 年角色棄掉', x => isC(x) && isA(x) && yr(x) === 3); p.ts.rcv += 2; }
        break;
      }
      case 'P01-088': { this.sdraw(p, 1); p.ts.rcv += 1 + (p.hand.length <= 3 ? 1 : 0); break; }
    }
  }
}

// ======================== AI ========================
function canChain(hand, rname, drop) {
  const cs = hand.filter(isC);
  for (const t of cs) {
    if (st(t, 'tos') == null || nm(t) === rname) continue;
    const rest = cs.slice(); rest.splice(rest.indexOf(t), 1);
    if (rest.some(a => st(a, 'atk') != null && atkName(a) !== nm(t))) return true;
  }
  return false;
}
function rcvPotential(g, p, c) {
  const off = g.ball.off;
  const kuro = p.ts.kurokawa && kuroEligible(c);
  let v = st(c, 'rcv') - (kuro ? 0 : (p.restrict.rcv_minus || 0));
  const gg = p.guts('receive') + (p.area.receive.length ? 1 : 0);
  if (c === 'D01-005' && gg >= 3) v += 2;
  if (c === 'P03-051' && gg >= 2) v += 2 + (g.ball.type === 'attack' && p.opp.ts.attacker && st(p.opp.ts.attacker, 'atk') === 0 ? 3 : 0);
  if (c === 'P02-001' && p.sets.length + p.opp.sets.length <= 1 && gg >= 3) v += 6;
  if (c === 'P03-046' && g.ball.type === 'serve' && off >= 6) v += 2;
  if (c === 'P01-039' && off >= 6 && p.hand.filter(isA).length >= 2) v += 1;
  if (kuro) v += 2;
  const rest = p.hand.slice(); rest.splice(rest.indexOf(c), 1);
  let boost = 0;
  if (isK(c) && rest.includes('P01-013') && c !== 'P01-013') boost += 2;
  if (isA(c) && rest.includes('P01-088')) boost += 1;
  if (isA(c) && yr(c) === 3 && rest.includes('P04-089')) boost += 1;
  return { v, boost, rest };
}
const AI = {
  label: 'AI',
  delay: 0,
  async choose(g, p, req) {
    if (this.delay) await new Promise(r => setTimeout(r, this.delay));
    const o = p.opp, opts = req.options;
    const byVal = (arr, f) => arr.slice().sort((a, b) => f(b) - f(a))[0];
    switch (req.kind) {
      case 'mulligan': {
        // 保留：1 張接球 ≥5、1 張舉球手、1 張主攻；其餘在起手不理想時放回
        const isSet = c => isC(c) && st(c, 'tos') >= 1 && (nm(c) === '影山 飛雄' || nm(c) === '及川 徹' || nm(c) === '菅原 孝支');
        const isKey = c => isC(c) && (HIN.has(c) || nm(c) === '岩泉 一');
        const keep = new Set(); const pickFirst = f => { const i = p.hand.findIndex((c, j) => !keep.has(j) && f(c)); if (i >= 0) keep.add(i); return i >= 0; };
        const hasR = pickFirst(c => isC(c) && st(c, 'rcv') >= 5), hasS = pickFirst(isSet), hasA = pickFirst(isKey);
        const chars = p.hand.filter(isC).length;
        if (hasR && hasS && hasA && chars >= 4) return [];
        p.hand.forEach((c, j) => { if (!keep.has(j) && isC(c) && chars >= 5 && (st(c, 'rcv') >= 5 || st(c, 'atk') >= 3)) keep.add(j); });
        return p.hand.map((c, j) => j).filter(j => !keep.has(j));
      }
      case 'serve': return byVal(opts, x => st(x.value, 'srv') * 2 - val(x.value) * (isA(x.value) ? 0.3 : 1) + (x.value === 'P01-033' ? 2 : 0)).value;
      case 'defend': {
        const cheap = req.combos[0] && req.combos[0].cards.length === 1;
        if (cheap) return 'block';
        const anyRcv = p.handC().some(c => st(c, 'rcv') != null && rcvPotential(g, p, c).v + rcvPotential(g, p, c).boost >= g.ball.off);
        return anyRcv ? 'receive' : 'block';
      }
      case 'block': return 0;
      case 'receiver': {
        const off = g.ball.off; let best = null;
        for (const x of opts) {
          const c = x.value; const { v, boost, rest } = rcvPotential(g, p, c);
          if (v + boost < off) continue;
          if (!canChain(rest, recvName(c), p.drop)) continue;
          const cost = val(c) + (v < off ? 2 : 0);
          if (!best || cost < best.cost) best = { c, cost };
        }
        if (best) return best.c;
        return byVal(opts, x => rcvPotential(g, p, x.value).v).value;
      }
      case 'setter': {
        const rname = p.ts.receiver ? recvName(p.ts.receiver) : '';
        return byVal(opts, x => {
          const t = x.value; const rest = p.hand.slice(); rest.splice(rest.indexOf(t), 1);
          let s = st(t, 'tos') * 3 - val(t) * 0.3;
          if (!rest.some(a => isC(a) && st(a, 'atk') != null && atkName(a) !== nm(t))) s -= 50;
          if (t === 'P01-006' && p.guts('toss') + (p.area.toss.length ? 1 : 0) >= 2 && rest.some(a => HIN.has(a))) s += 8;
          if (t === 'P01-033' && rest.filter(isA).length >= 2) s += 3;
          if (['日向 翔陽', '岩泉 一'].includes(nm(t))) s -= 10;
          return s;
        }).value;
      }
      case 'attacker': {
        return byVal(opts, x => {
          const a = x.value; let b = st(a, 'atk'); const gg = p.guts('attack') + (p.area.attack.length ? 1 : 0);
          if (a === 'P01-002' && gg >= 3) b += 4;
          if (a === 'BP-002' && p.hand.length >= 2) b += 2;
          if (a === 'P01-035' && p.hand.filter(isA).length >= 2) b += 2;
          if (a === 'D04-002' && nm(p.ts.setter) === '及川 徹' && gg >= 2) b += 3;
          if (isHin(a)) b += p.ts.hin || 0;
          return b * 3 - val(a) * 0.5;
        }).value;
      }
      case 'skill': {
        if (req.ctx && req.ctx.need != null && req.ctx.need <= 0 && ['D01-005', 'P01-039'].includes(req.ctx.card)) return false;
        return true;
      }
      case 'event': {
        const cards = opts.filter(x => x.value);
        for (const x of cards) {
          const c = x.value;
          if (req.timing === 'blk') { if (p.ts.blk < g.ball.off) return c; continue; }
          if (req.timing === 'rcv') {
            if (p.ts.rcv < g.ball.off && ['P01-013', 'P01-088', 'P04-089', 'P03-096'].includes(c)) return c;
            if (c === 'P03-057') {
              const receiver = p.ts.receiver;
              if (p.ts.rcv < g.ball.off && receiver && kuroEligible(receiver)) return c;
              continue;
            }
            if (!EVT[c] || !EVT[c].includes('drw')) continue;
          }
          if (c === 'P01-078') {
            const hs = p.drop.filter(y => HIN.has(y));
            if (hs.length) {
              const bestH = hs.sort((a, b) => val(b) - val(a))[0];
              const cand = st(bestH, 'atk') + 1 + (p.ts.hin || 0) + (bestH === 'P01-002' && p.guts('attack') + 1 >= 3 ? 4 : 0) + (bestH === 'BP-002' ? 2 : 0);
              if (cand < p.ts.atk) continue;
            }
            return c;
          }
          if (c === 'P03-057') continue;
          if (c === 'P03-086' && p.ts.toss >= 2) continue;
          return c;
        }
        return null;
      }
      case 'retrieve': case 'summon': {
        const cards = opts.filter(x => x.value);
        return cards.length ? byVal(cards, x => val(x.value)).value : null;
      }
      case 'discard': case 'cost': {
        const openInHand = p.hand.includes('P01-078');
        return opts.slice().sort((a, b) => {
          const sa = val(a.value) + (st(a.value, 'rcv') >= 6 ? 6 : 0) - (openInHand && HIN.has(a.value) && !p.drop.some(y => HIN.has(y)) ? 5 : 0);
          const sb = val(b.value) + (st(b.value, 'rcv') >= 6 ? 6 : 0) - (openInHand && HIN.has(b.value) && !p.drop.some(y => HIN.has(y)) ? 5 : 0);
          return sa - sb;
        })[0].value;
      }
      default: return opts[0].value;
    }
  },
};

const api = { DEF, DECKS, HIN, AREAS, AREA_ZH, EVT, Game, AI, nm, isC, st, val, sch, yr, short, canChain, recvName, atkName, isHin };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BreakEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
