/* BREAK 對練台 — 規則引擎（移植自 haikyu-sim/sim2.py） */
(function (root) {
'use strict';
const N = null, K = '烏野', A = '青城';
const sharedRules = typeof module !== 'undefined' && module.exports ? require('./rules/legacy') : root.BreakRulesLegacy;
const cardIdentity = typeof module !== 'undefined' && module.exports ? require('./rules/identity') : root.BreakCardIdentity;
const turnEffects = typeof module !== 'undefined' && module.exports ? require('./rules/lifecycle') : root.BreakTurnEffects;
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
  'PR-057': ['着地上手組。', 'C', N, N, 5, 0, 3, 5, K, 1, '每次登場時選「日向 翔陽」或「西谷 夕」，直到本回合結束；在場上仍算 1 人'],
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
  'P03-087': ['周りの上手さに引っ張られる', 'E', 0, 0, 0, 0, 0, 5, K, 0, '［接球/攻擊］每回合 1 次：全烏野或全ユース → 抽 1，選場上角色 1 人攻擊 +1；指定影山可跨區付 6 Guts，再選其任一參數 +2'],
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
  'P01-088': ['お前達は 強いよ', 'E', 0, 0, 0, 0, 0, 4, A, 0, '［接球］最多抽 1，青城角色 1 人接球 +1；手牌 ≤3 時同一角色再 +1'],
};
const library = typeof module !== 'undefined' && module.exports ? require('./card-library') : root.BreakCardLibrary;
for (const card of Object.values(library.data.cards)) if (!Object.hasOwn(DEF, card.code)) DEF[card.code] = card.definition;
const legacySkill = c => library.permission(c)?.kind === 'legacy';
const HIN = new Set(Object.keys(DEF).filter(c => library.card(c).printedName === '日向翔陽'));
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
const hasSchool = (c, s) => library.school(c, s);
const hasYear = (c, n) => library.year(c, n);
const isK = c => hasSchool(c, K);
const isA = c => hasSchool(c, A);
const short = c => nm(c).split(' ')[0];
const entryNames = c => legacySkill(c) && c === 'PR-057' ? ['日向 翔陽', '西谷 夕'] : sharedRules.entryNames(c).length ? sharedRules.entryNames(c) : [nm(c)];
const recvName = c => nm(c);
const atkName = c => nm(c);
const isHin = c => HIN.has(c);
const kuroEligible = c => isK(c) && (hasYear(c, 2) || hasYear(c, 3));
const EVT = {
  'D01-012': ['atk'], 'P01-074': ['atk'], 'P01-078': ['atk'], 'P03-086': ['tos'], 'P03-090': ['drw'], 'PR-029': ['drw'],
  'P03-096': ['atk', 'rcv', 'blk'], 'P03-087': ['atk', 'rcv'], 'P01-087': ['srv', 'tos'], 'P04-088': ['atk'], 'P04-089': ['rcv'], 'P01-088': ['rcv'],
};
function validateDeck(cards, mode='strict') {
  library.checkMode(mode);
  if (!cards || typeof cards !== 'object' || Array.isArray(cards)) throw Error('牌組清單無效');
  let total = 0, events = 0;
  for (const [c, n] of Object.entries(cards)) {
    const code = library.requirePlayable(c, mode);
    if (code !== c || !Object.hasOwn(DEF, c)) throw Error('請先匯入標準卡號：' + c);
    if (!Number.isSafeInteger(n) || n < 1 || n > 40) throw Error('張數無效：' + c);
    total += n; if (!isC(c)) events += n;
  }
  if (total !== 40) throw Error('牌組必須 40 張，目前 ' + total + ' 張');
  if (events > 8) throw Error('Event 最多 8 張，目前 ' + events + ' 張');
}
function validateDecks() { for (const deck of Object.values(DECKS)) validateDeck(deck.cards); }
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
    this.restrict = {}; this.pending = {}; this.ts = {}; this.newCount = {}; this.effects = {};
  }
  get opp() { return this.g.players[1 - this.idx]; }
  handC() { return this.hand.filter(isC); }
  guts(a) { return Math.max(0, this.area[a].length - 1); }
  top(a) { const s = this.area[a]; return s.length ? s[s.length - 1] : null; }
  chars() { return AREAS.map(a => this.top(a)).filter(Boolean); }
  allSchool(s) { return this.chars().every(c => hasSchool(c, s)); }
}

class Game {
  constructor(opts) {
    this.mode = library.checkMode(opts.mode || 'strict');
    if (!Array.isArray(opts.decks) || opts.decks.length !== 2) throw Error('需要兩副牌組');
    for (const key of opts.decks) { if (!Object.hasOwn(DECKS, key)) throw Error('找不到牌組：' + key); validateDeck(DECKS[key].cards, this.mode); }
    this.rand = rng(opts.seed == null ? (Date.now() & 0xffffffff) : opts.seed);
    this.logFn = opts.onLog || (() => {});
    this.reveal = opts.reveal == null ? -1 : opts.reveal; this.src = '';
    this.update = opts.onUpdate || (() => {});
    this.onNotice = opts.onNotice || (() => {});
    this.players = [new Player(this, 0, opts.decks[0], opts.agents[0]), new Player(this, 1, opts.decks[1], opts.agents[1])];
    this.ball = null; this.rallyNo = 0; this.turnNo = 0; this.server = null; this.winner = null; this.stats = {};
  }
  shuffle(a) { if (this.cardState) return cardIdentity.shuffle(this, a, () => this.rand()); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } }
  moveCard(from, to, index, at) { const r=cardIdentity.move(this,from,to,index,at);sharedRules.sourceMoved(this,r.id,r.from,r.to,r.revision);return r.code; }
  moveCode(from, to, code, at) { const index = from.indexOf(code); if (index < 0) throw new Error('來源區沒有指定卡片'); return this.moveCard(from, to, index, at); }
  cardSnapshot() { return cardIdentity.snapshot(this); }
  cardReference(p, zone, index) { const state = cardIdentity.ensure(this),ids = state.zones[p.idx + '.' + zone],id = ids[index ?? ids.length - 1]; return id ? {id,incarnation:state.cards[id].incarnation} : null; }
  roleReference(p, key) { return key.startsWith('side:') ? this.cardReference(p, 'sides', +key.slice(5)) : this.cardReference(p, key); }
  sameReference(a, b) { return !!a && !!b && a.id === b.id && a.incarnation === b.incarnation; }
  validEffect(p, key) { const fx = p.effects[key]; return !!fx && (!fx.ref || this.sameReference(fx.ref, this.roleReference(p, key))); }
  scheduleRestriction(p, key, value, stack, source) { return turnEffects.schedule(this, p.idx, key, value, {stack,source}); }
  log(s, cls) { this.logFn(s, cls); }
  tag(k) { this.stats[k] = (this.stats[k] || 0) + 1; }
  async ask(p, req) { if(!this.sharedRulesPending&&!this.sharedRulesDepth&&this.sharedRulesEvents?.length)await sharedRules.flushHostEvents(this);this.update(); req.canLoss = this.turnP === p && !['mulligan', 'roll', 'lossConfirm'].includes(req.kind); const r = await p.agent.choose(this, p, req); if (r && r.__loss && req.canLoss) this.lost(p, '主動 Loss（放棄這球）'); return r; }
  async notice(data) { this.update(); await this.onNotice({ rally: this.rallyNo, ...data }); }
  async yes(p, kind, prompt, ctx) { const r = await this.ask(p, { kind, prompt, ctx, options: [{ label: '發動', value: true }, { label: '不發動', value: false }] }); return r; }

  // ---------- card movement
  draw(p, n = 1, why = '', origin = 'rule') {
    if(!sharedRules.permission(this,{action:'add_hand',player:p.idx,origin}).allowed){this.log(`${p.name} 目前不能抽牌`,'warn');return 0;}
    const got = [];
    for (let i = 0; i < n; i++) { if (!p.deck.length) { this.log(`${p.name} 牌庫空，無法抽牌`, 'warn'); break; } const c = this.moveCard(p.deck, p.hand, p.deck.length - 1); got.push(c); sharedRules.drawn(this,p,this.cardReference(p,'hand').id,this.cardState.revision);p.newCount[c] = (p.newCount[c] || 0) + 1; }
    if (got.length) {
      const tag = why ? `（${why}）` : '';
      if (p.idx === this.reveal) this.log(`${p.name}${tag}抽到：${got.map(nm).join('、')}`, 'draw');
      else this.log(`${p.name}${tag}抽 ${got.length} 張（手牌 ${p.hand.length}）`, 'draw');
    }
    return got.length;
  }
  skillHandAllowed(p) { return !p.restrict.no_add && sharedRules.permission(this,{action:'add_hand',player:p.idx,origin:'skill'}).allowed; }
  sdraw(p, n = 1) { sharedRules.assertReady(this); if (!this.skillHandAllowed(p)) { this.log(`${p.name} 被岩泉封鎖，${this.src || '技能'}的抽牌無效`, 'warn'); return 0; } return this.draw(p, n, this.src || '技能','skill'); }
  async sadd(p, c, src, index = src.indexOf(c)) {
    if (!this.skillHandAllowed(p)) { this.log(`${p.name} 被岩泉封鎖，無法加入手牌`, 'warn'); return false; }
    sharedRules.assertReady(this);
    if (src[index] !== c) throw new Error('加入手牌的實體來源不符');
    this.moveCard(src, p.hand, index);
    await sharedRules.handAdded(this, p, this.cardReference(p, 'hand').id, this.cardState.revision);
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
    if (!candidates.length || !this.skillHandAllowed(p)) return null;
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
    const canTake = matches && this.skillHandAllowed(p);
    const reason = !card ? '牌庫已空，沒有可翻開的牌。' : !matches ? '沒有符合條件的牌，已放回牌庫底。' : !this.skillHandAllowed(p) ? '符合條件，但受到禁止加入手牌的效果影響，已放回牌庫底。' : '符合條件：可以加入手牌，也可以放回牌庫底。';
    if (card) this.log(`${source}翻開：${nm(card)}（${card}）`);
    if (card && !canTake) this.moveCard(p.deck, p.deck, p.deck.length - 1, 0);
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
      if (take === card) { await this.sadd(p, card, p.deck, p.deck.length - 1); this.log(`${source}：${nm(card)} 加入手牌`); }
      else { if (canTake) this.moveCard(p.deck, p.deck, p.deck.length - 1, 0); this.log(`${source}：${nm(card)} 放回牌庫底。${reason}`, 'draw'); }
    } else this.log(`${source}：${reason}`, 'warn');
  }
  async discard(p, prompt, filter) {
    const c = await this.pickHand(p, prompt, filter);
    if (c) { this.moveCode(p.hand, p.drop, c); this.log(`${p.name} 棄掉 ${nm(c)}`); }
    return c;
  }
  async pay(p, a, n) {
    const s = p.area[a];
    let idx = null;
    if (p.agent.wantsAck && s.length - 1 > n) {
      const r = await this.ask(p, { kind: 'guts', multi: true, need: n, area: a, prompt: `付 ${n} Guts：從${AREA_ZH[a]}區選 ${n} 張（最上面的角色不能付）`, options: s.slice(0, -1).map((c, i) => ({ label: nm(c), card: c, value: i })) });
      if (Array.isArray(r) && new Set(r).size === n && r.every(i => i >= 0 && i < s.length - 1)) idx = [...new Set(r)].sort((x, y) => y - x);
    }
    const dropStart = p.drop.length;
    const paid = idx ? idx.map(i => this.moveCard(s, p.drop, i, dropStart)).reverse() : Array.from({length: Math.min(n, Math.max(0, s.length - 1))}, () => this.moveCard(s, p.drop, 0));
    if (paid.length) this.log(`${p.name} 付 ${paid.length} Guts（${AREA_ZH[a]}區）：${paid.map(nm).join('、')} → 棄牌區`, 'guts'); return paid; }
  place(p, a, c) { this.moveCode(p.hand, p.area[a], c); delete p.effects[a]; }
  courtTargets(p) {
    return [...AREAS.map(key => ({ key, card: p.top(key), label: AREA_ZH[key] + '區' })),
      ...(p.ts.sides || []).map((card, i) => ({ key: 'side:' + i, card, label: '側攔 ' + (i + 1) }))].filter(t => t.card);
  }
  cardName(p, key) {
    const c = this.courtTargets(p).find(t => t.key === key)?.card;
    if (!c) return '';
    return p.effects[key]?.card === c && this.validEffect(p, key) && p.effects[key].name || nm(c);
  }
  effect(p, key) {
    const card = this.courtTargets(p).find(t => t.key === key)?.card;
    if (!card) throw new Error('目標角色已離場');
    if (p.effects[key]?.card !== card || !this.validEffect(p, key)) p.effects[key] = { card, ref: this.roleReference(p, key), mods: {} };
    return p.effects[key];
  }
  activeParameter(p, key, param) {
    if (p.ts.finished) return null;
    if (key === 'receive' && param === 'rcv' && p.ts.receiver === p.top(key) && (!p.ts.receiverRef || this.sameReference(p.ts.receiverRef, this.roleReference(p, key)))) return 'rcv';
    if (key === 'toss' && param === 'tos' && p.ts.setter === p.top(key) && (!p.ts.setterRef || this.sameReference(p.ts.setterRef, this.roleReference(p, key)))) return 'toss';
    if (key === 'attack' && param === 'atk' && p.ts.attacker === p.top(key) && (!p.ts.attackerRef || this.sameReference(p.ts.attackerRef, this.roleReference(p, key)))) return 'atk';
    if ((key === 'block' || key.startsWith('side:')) && param === 'blk' && p.ts.blockers) return 'blk';
    return null;
  }
  parameter(p, key, param) {
    const card = this.courtTargets(p).find(t => t.key === key)?.card;
    if (!card || st(card, param) == null) return null;
    const active = this.activeParameter(p, key, param);
    // Block is an aggregate; per-character values remain separate.
    if (active && active !== 'blk' && p.ts[active] != null) return p.ts[active];
    const fx = p.effects[key];
    return st(card, param) + (fx?.card === card && this.validEffect(p, key) ? fx.mods?.[param] || 0 : 0);
  }
  boostParameter(p, key, param, amount) {
    if (this.parameter(p, key, param) == null || amount < 0 && sharedRules.protectedParameter(this,p,key,param)) return;
    const fx = this.effect(p, key); fx.mods ||= {}; fx.mods[param] = (fx.mods[param] || 0) + amount;
    const active = this.activeParameter(p, key, param);
    if (active && p.ts[active] != null) p.ts[active] += amount;
    const zh = { srv: '發球', blk: '攔網', rcv: '接球', tos: '舉球', atk: '攻擊' };
    this.log(`${this.cardName(p, key)}（${this.courtTargets(p).find(t => t.key === key).label}）：${zh[param]} ${amount >= 0 ? '+' : ''}${amount}`);
  }
  legalEntryNames(p, area, c, options={}) {
    const other = area === 'toss' ? 'receive' : area === 'attack' ? 'toss' : null;
    return entryNames(c).filter(name => (!other || name.normalize('NFKC').replace(/\s/g,'') !== this.cardName(p, other).normalize('NFKC').replace(/\s/g,'')) && sharedRules.entryAllowed(this,p,c,area,{...options,name}));
  }
  canEnter(p, area, c, options={}) { return !(area==='receive'&&p.restrict.no_rcv6&&st(c,'rcv')>=6) && st(c, { serve: 'srv', block: 'blk', receive: 'rcv', toss: 'tos', attack: 'atk' }[area]) != null && this.legalEntryNames(p, area, c, options).length > 0; }
  async enterCharacter(p, area, c, fromDrop = false) {
    sharedRules.assertReady(this);
    const old=p.top(area),coveredSource=this.roleReference(p,area),coveredCharacter=old?{effective_name:this.cardName(p,area).normalize('NFKC').replace(/\s/g,''),tags:library.card(old).schoolTags,positions:library.card(old).positionTags}:null;
    const names = this.legalEntryNames(p, area, c,{origin:fromDrop?'skill':'rule',entryOrigin:fromDrop?'drop':'hand'});
    if (!this.canEnter(p, area, c,{origin:fromDrop?'skill':'rule',entryOrigin:fromDrop?'drop':'hand'})) throw new Error('不能以相同名稱登場，或受到登場限制');
    let name = nm(c);
    if (entryNames(c).length>1) name = await this.ask(p, { kind: 'name', prompt: `${nm(c)}：選擇登場名稱（${AREA_ZH[area]}區，本回合有效）`, ctx: { card: c, area }, options: names.map(value => ({ label: value, value })) });
    if (!names.includes(name)) throw new Error('無效的登場名稱');
    if (fromDrop) { this.moveCode(p.drop, p.area[area], c); delete p.effects[area]; }
    else this.place(p, area, c);
    if (entryNames(c).length>1) { this.effect(p, area).name = name; this.log(`${nm(c)}：本回合在${AREA_ZH[area]}區作為「${name}」`); }
    const activeRole={receive:'receiver',toss:'setter',attack:'attacker'}[area];
    if(activeRole){p.ts[activeRole]=null;delete p.ts[activeRole+'Ref'];}
    await sharedRules.charactersEntered(this,p,[{key:area,origin:fromDrop?'drop':'hand',reason:fromDrop?'skill':'rule',coveredCharacter,coveredSource}]);
  }
  async chooseTarget(p, targets, prompt, timing) {
    if (!targets.length) { this.log('沒有符合條件的場上角色，略過這部分效果', 'warn'); return null; }
    const key = await this.ask(p, { kind: 'target', prompt, timing, options: targets.map(t => ({ value: t.key, card: t.card, label: `${t.label} · ${this.cardName(p, t.key)} · ${t.card}` })) });
    if (!targets.some(t => t.key === key)) throw new Error('無效的角色目標');
    return key;
  }
  async chooseParameter(p, key, amount, source, timing) {
    const labels = { srv: '發球', blk: '攔網', rcv: '接球', tos: '舉球', atk: '攻擊' };
    const options = Object.entries(labels).filter(([k]) => this.parameter(p, key, k) != null).map(([value, label]) => ({ value, label: `${label} ${this.parameter(p, key, value)} → ${this.parameter(p, key, value) + amount}` }));
    if (!options.length) return;
    const param = await this.ask(p, { kind: 'parameter', timing, ctx: { target: key, amount }, prompt: `${source}：選擇「${this.cardName(p, key)}」要 +${amount} 的數值`, options });
    if (!options.some(o => o.value === param)) throw new Error('無效的參數選擇');
    this.boostParameter(p, key, param, amount);
  }
  uniformCourt(p) {
    const chars = this.courtTargets(p);
    return chars.length > 0 && [K, 'ユース'].some(s => chars.every(t => hasSchool(t.card, s)));
  }
  courtGuts(p) { return AREAS.flatMap(area => p.area[area].slice(0, -1).map((card, index) => ({ area, index, card }))); }
  async payCourt(p, need) {
    const guts = this.courtGuts(p); if (guts.length < need) return false;
    const answer = await this.ask(p, { kind: 'gutsCourt', multi: true, need, prompt: `影山：從各區選合計 ${need} Guts（每區最上方角色不能付）`, options: guts.map((g, value) => ({ value, card: g.card, label: AREA_ZH[g.area] + '區 · ' + nm(g.card) })) });
    const valid = Array.isArray(answer) && answer.length === need && new Set(answer).size === need && answer.every(i => Number.isInteger(i) && i >= 0 && i < guts.length);
    const chosen = (valid ? answer : guts.slice(0, need).map((_, i) => i)).map(i => guts[i]);
    for (const area of AREAS) for (const g of chosen.filter(g => g.area === area).sort((a, b) => b.index - a.index)) this.moveCard(p.area[area], p.drop, g.index);
    this.log(`影山：跨區支付 ${need} Guts → 棄牌區`); return true;
  }

  // ---------- main loop
  async run() {
    const [P0, P1] = this.players;
    let d0, d1; do { d0 = 1 + Math.floor(this.rand() * 6); d1 = 1 + Math.floor(this.rand() * 6); } while (d0 === d1);
    const diceWinner = d0 > d1 ? P0 : P1;
    this.dice = [d0, d1]; this.diceWinner = diceWinner.idx;
    this.log(`擲骰：${P0.name} ${d0} vs ${P1.name} ${d1} → ${diceWinner.name} 取得先發／先接選擇權`, 'head');
    const choice = await this.ask(diceWinner, { kind: 'firstService', prompt: `${diceWinner.name} 擲骰獲勝，請選擇先發或先接`, ctx: { dice: [d0, d1], winner: diceWinner.idx }, options: [{ label: '先發球', value: 'serve' }, { label: '先接球', value: 'receive' }] });
    if (!['serve', 'receive'].includes(choice)) throw Error('請選擇先發球或先接球');
    let server = choice === 'serve' ? diceWinner : diceWinner.opp;
    this.firstServiceChoice = choice; this.firstServer = server.idx;
    this.log(`${diceWinner.name} 選擇${choice === 'serve' ? '先發球' : '先接球'} → ${server.name} 先發球，從發球方開始調度`, 'head');
    for (const p of this.players) if (p.agent.wantsAck) await this.ask(p, { kind: 'roll', prompt: '首球發球方已確定', ctx: { dice: [d0, d1], winner: diceWinner.idx, choice, server: server.idx }, options: [{ label: '開始調度', value: true }] });
    for (const p of [server, server.opp]) {
      this.draw(p, 6, '起手');
      const back = await this.ask(p, { kind: 'mulligan', role: p === server ? 'serve' : 'receive', multi: true, prompt: '起手調度：點選要放回牌庫的牌（可 0～6 張），放回幾張就重抽幾張', options: p.hand.map((c, i) => ({ label: nm(c), card: c, value: i })) });
      if (back && back.length) {
        const idx = [...new Set(back)].sort((a, b) => b - a);
        const ret = idx.map(i => this.moveCard(p.hand, p.deck, i));
        this.shuffle(p.deck); this.draw(p, ret.length, '調度');
        this.log(`${p.name} 調度：放回 ${ret.length} 張並重抽`);
      } else this.log(`${p.name} 保留起手`);
      this.moveCard(p.deck, p.sets, p.deck.length - 1); this.moveCard(p.deck, p.sets, p.deck.length - 1);
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
      if(loser.ts.sides?.length)this.cleanupSides(loser);
      await sharedRules.judgment(this,loser,'loss');
      await this.notice({ type: 'loss', player: loser.idx, reason: lossReason, winner: loser.opp.idx, final: !loser.sets.length });
      this.turnP = null;
      turnEffects.loss(this);
      sharedRules.loss(this);
      for (const p of this.players) { p.pending = {}; p.restrict = {}; p.ts = {}; p.effects = {}; }
      this.ball = null; this.target = null;
      const winner = loser.opp;
      if (!loser.sets.length) { this.winner = winner; this.log(`${winner.name} 獲勝！`, 'win'); this.update(); return winner; }
      for (const p of this.players) { p.newCount = {}; if (p.hand.length < 6) this.draw(p, 6 - p.hand.length, 'インターバル補牌'); }
      this.moveCard(loser.sets, loser.hand, loser.sets.length - 1);
      const setCard = loser.hand[loser.hand.length - 1]; loser.newCount[setCard] = (loser.newCount[setCard] || 0) + 1;
      this.log(`インターバル：雙方補到 6 張，${loser.name} 再把 1 張セットカード加入手牌${loser.idx === this.reveal ? '：' + nm(setCard) : ''}（剩 ${loser.sets.length}）`, 'draw');
      server = winner;
      this.update();
    }
  }
  lost(p, why) { const e = new LostSignal(why); e.who = p; throw e; }
  cleanupSides(p) {
    const sides = [...(p.ts.sides || [])];
    if (!sides.length) return;
    while (p.ts.sides.length) this.moveCard(p.ts.sides, p.drop, 0);
    for (const key of Object.keys(p.effects)) if (key.startsWith('side:')) delete p.effects[key];
    if (sides.length) this.log(`側攔 ${sides.map(nm).join('、')} → 棄牌區`, 'guts');
  }
  finishTurn(p) { for (const q of this.players) if (q !== p) for (const [key, fx] of Object.entries(q.effects)) if (fx.manual?.turn === this.turnNo) { if (this.validEffect(q,key)) for (const [param,delta] of Object.entries(fx.manual.mods)) fx.mods[param] -= delta; delete fx.manual; } delete p.ts.blockEntryReceipts;delete p.ts.blockEntryOrigins; p.effects = {}; p.restrict = {}; p.ts.finished = true; turnEffects.finish(this, this.turnNo); sharedRules.finishTurn(this); }
  setRulePhase(timing) {if(this.rulePhase==='drw'&&timing!=='drw')sharedRules.endDrawPhase(this);this.rulePhase=timing;}
  beginTurn(p) { if (this.turnP) this.finishTurn(this.turnP); this.turnP = p; this.turnNo++; p.restrict = {...p.pending, ...turnEffects.begin(this, p.idx)}; p.pending = {}; p.ts = { used: {} }; p.newCount = {}; this.src = ''; this.setRulePhase('drw'); sharedRules.beginTurn(this, p); }
  currentOutgoing(p, outgoing) {
    if(p.ts.keywordResolved)return {...p.ts.keywordResolved};
    const off = outgoing.type === 'serve' ? this.parameter(p, 'serve', 'srv') : outgoing.type === 'attack' ? p.ts.toss + p.ts.atk : outgoing.off;
    return {...outgoing, off:Number.isFinite(off) ? off : outgoing.off};
  }
  async manualAction(p, command) {
    if (this.mode !== 'numeric' || this.turnP !== p || this.sharedRulesPending || !command || typeof command !== 'object') throw Error('此時不能手動調整');
    const q = this.players[command.player ?? p.idx]; if (!q) throw Error('無效的玩家');
    if (command.kind === 'draw') { if (!q.deck.length) throw Error('牌庫已空'); this.draw(q, 1, '手動修正'); }
    else if (command.kind === 'discard') {
      if (!q.hand.length) throw Error('手牌已空');
      if (q !== p) await this.discard(q, '手動修正：請自行選1張棄牌');
      else { const i = q.hand.findIndex((c, i) => this.sameReference(command.ref, this.cardReference(q, 'hand', i))); if (i < 0) throw Error('手牌已改變，請重選'); const c = this.moveCard(q.hand, q.drop, i); this.log(`${q.name} 手動棄掉 ${nm(c)}`); }
    } else if (['adjust','ball'].includes(command.kind)) {
      if (![1,-1].includes(command.delta)) throw Error('每次調整1點');
      if (command.kind === 'ball') { if (!this.ball) throw Error('目前沒有來球'); if(command.delta<0&&sharedRules.protectedBall(this,1-p.idx)){this.log('手動修正未生效：來球受到防降保護','warn');return;} this.ball.off += command.delta; this.log(`手動修正：來球總值 ${command.delta > 0 ? '+' : ''}${command.delta} → ${this.ball.off}`); }
      else {
        if (!Object.hasOwn(IDX, command.param) || !this.sameReference(command.ref, this.roleReference(q, command.key))) throw Error('角色已改變，請重選');
        const before = this.parameter(q, command.key, command.param); if (before == null) throw Error('不能調整「－」');
        this.boostParameter(q, command.key, command.param, command.delta);
        const applied = this.parameter(q, command.key, command.param) - before;
        if (applied) { const fx = this.effect(q, command.key); fx.manual ||= {turn:this.turnNo, mods:{}}; fx.manual.mods[command.param] = (fx.manual.mods[command.param] || 0) + applied; this.log(`手動修正：${q.name} ${this.cardName(q,command.key)} ${{srv:'發球',blk:'攔網',rcv:'接球',tos:'舉球',atk:'攻擊'}[command.param]} ${before} → ${before + applied}`); }
        else this.log('手動修正未生效：此數值受到保護', 'warn');
      }
    } else throw Error('未知的手動操作');
  }
  async confirmTurnEnd(p, outgoing) {
    outgoing=await sharedRules.outgoing(this,p,outgoing.type,outgoing.off);
    for (;;) {
      outgoing = this.currentOutgoing(p, outgoing);
      if (!p.agent.wantsAck) return outgoing;
      const label = { serve:'發球', attack:'進攻', block:'攔網回球' }[outgoing.type];
      const answer = await this.ask(p, { kind:'turnEnd', canManual:this.mode==='numeric', prompt:`${label}準備完成：${outgoing.off}。尚未交棒，可結束回合或喊 Loss`, outgoing, options:[{label:'結束回合',value:true}] });
      if (answer?.__manual && this.mode === 'numeric') { try { await this.manualAction(p,answer.__manual); } catch (e) { this.log(e.message,'warn'); } continue; }
      return this.currentOutgoing(p,outgoing);
    }
  }

  // ---------- serve
  async serveTurn(p) {
    this.beginTurn(p);
    this.setRulePhase('srv');
    await this.notice({ type: 'serve', player: p.idx });
    const o = p.opp;
    const cs = [...new Set(p.handC().filter(c => st(c, 'srv') != null))];
    if (!cs.length) this.lost(p, '沒有能發球的角色');
    const c = await this.ask(p, { kind: 'serve', prompt: '選擇發球角色', options: cs.map(x => ({ label: `${nm(x)}　發 ${st(x, 'srv')}`, card: x, value: x })) });
    await this.enterCharacter(p, 'serve', c); this.src = nm(c);
    let off = this.parameter(p,'serve','srv');

    await this.eventLoop(p, 'srv', { serveChar: c });
    off = (await this.confirmTurnEnd(p, { type: 'serve', off }))?.off ?? off;
    this.finishTurn(p);
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
      if (combos.length || p.agent.wantsAck && this.blockCands(p).length && this.blockMax(p) > 0) {
        const ch = await this.ask(p, { kind: 'defend', prompt: `來球：攻擊 ${ball.off}。要攔網還是接球？`, ball, combos, options: [{ label: '接球（抽 1 張）', value: 'receive' }, { label: '攔網（不抽牌）', value: 'block' }] });
        if (ch === 'block') return await this.blockTurn(p, combos);
      }
    }
    return await this.receiveTurn(p);
  }
  blockMax(p) { const legacy=p.restrict.one_blocker?1:p.restrict.two_blockers?2:3;return [3,2,1].find(n=>n<=legacy&&sharedRules.blockGroupAllowed(this,p,n))||0; }
  blockCands(p) { return p.handC().filter(c => st(c, 'blk') != null); }
  evalBlock(p, combo, off = this.ball.off) {
    const o = p.opp, evInHand = p.hand.some(x => !isC(x));
    let total = combo.reduce((s, c) => s + st(c, 'blk'), 0), tsu = false;
    if (combo.includes('P02-003') && o.ev.length >= 2 && evInHand) { total += 6; tsu = true; }
    const natsu = p.hand.includes('P03-096') && combo.some(x => HIN.has(x)) && !(combo.includes('P02-003') && tsu && p.hand.filter(x => !isC(x)).length < 2) ? 1 : 0;
    const names = sharedRules.distinctNameOptions(combo.map((c,i)=>entryNames(c).filter(name=>sharedRules.entryAllowed(this,p,c,i?'side:'+(i-1):'block',{name,entryCount:sharedRules.blockEntered(this,p)+combo.length}))));
    const legal = combo.length >= 1 && combo.length <= this.blockMax(p) && names.length>0 && combo.every(c => combo.filter(x=>x===c).length<=p.hand.filter(x=>x===c).length && st(c, 'blk') != null);
    return { cards: [...combo], total, tsu, natsu: total < off && natsu > 0, ok: legal && total + natsu >= off, legal, cost: combo.length * 10 + combo.reduce((s, c) => s + val(c), 0) + (total < off ? 3 : 0) };
  }
  blockCombos(p, off) {
    const maxn = this.blockMax(p), cs = this.blockCands(p), res = [];
    const rec = (start, combo) => {
      if (combo.length) { const r = this.evalBlock(p, combo, off); if (r.ok) res.push(r); }
      if (combo.length >= maxn) return;
      for (let i = start; i < cs.length; i++) {
        if (!sharedRules.distinctNameOptions([...combo,cs[i]].map(entryNames)).length) continue;
        combo.push(cs[i]); rec(i + 1, combo); combo.pop();
      }
    };
    rec(0, []);
    res.sort((a, b) => a.cost - b.cost);
    return res.slice(0, 12);
  }
  async blockTurn(p, combos) {
    this.setRulePhase('blk');
    const pick = await this.ask(p, { kind: 'block', build: { cands: this.blockCands(p), max: this.blockMax(p) }, prompt: `組攔網（需 ≥ ${this.ball.off}）`, options: combos.map((cb, i) => ({ label: `${cb.cards.map(short).join('＋')}　攔 ${cb.total}${cb.tsu ? '（含月島 +6）' : ''}${cb.natsu ? '（還要用日向夏 +1）' : ''}`, value: i, cards: cb.cards })) });
    let cb, center;
    if (pick && typeof pick === 'object') {
      cb = this.evalBlock(p, pick.cards);
      if (!cb.legal) throw Error('請選擇合法的攔網角色組合');
      center = pick.center && cb.cards.includes(pick.center) ? pick.center : cb.cards[0];
    } else { cb = combos[pick]; if (!cb) throw Error('請選擇合法的攔網角色組合'); center = cb.cards.slice().sort((a, b) => val(b) - val(a))[0]; }
    const ordered=cb.cards.slice(),centerIndex=ordered.indexOf(center);ordered.splice(centerIndex,1);ordered.unshift(center);
    const chosen=[];
    for(let i=0;i<ordered.length;i++){
      const options=sharedRules.distinctNameOptions(ordered.slice(i).map((c,j)=>entryNames(c).filter(name=>sharedRules.entryAllowed(this,p,c,i+j?'side:'+(i+j-1):'block',{name,entryCount:sharedRules.blockEntered(this,p)+ordered.length}))),chosen);
      const name=entryNames(ordered[i]).length>1?await this.ask(p,{kind:'name',prompt:`${nm(ordered[i])}：選擇${i?'側攔':'中攔'}登場名稱`,ctx:{card:ordered[i],area:i?'side:'+(i-1):'block'},options:options.map(value=>({value,label:value}))}):options[0];
      if(!options.includes(name))throw Error('無效的攔網名稱');chosen.push(name);
    }
    this.place(p, 'block', center); this.src = '月島';
    const sides = ordered.slice(1); p.ts.sides = [];
    for (const c of sides) this.moveCode(p.hand, p.ts.sides, c);
    for(let i=0;i<ordered.length;i++)if(entryNames(ordered[i]).length>1)this.effect(p,i?'side:'+(i-1):'block').name=chosen[i];
    await sharedRules.charactersEntered(this,p,[{key:'block'},...sides.map((c,i)=>({key:'side:'+i}))]);
    if(p.ts.keywordJump==='draw'){delete p.ts.keywordJump;this.cleanupSides(p);return this.receiveTurn(p);}
    p.ts.blk = this.courtTargets(p).filter(t=>t.key==='block'||t.key.startsWith('side:')).reduce((n,t)=>n+this.parameter(p,t.key,'blk'),0); p.ts.blockers = this.courtTargets(p).filter(t=>t.key==='block'||t.key.startsWith('side:')).map(t=>t.card);
    this.log(`${p.name} 攔網 ${cb.cards.map(short).join('＋')}：攔 ${p.ts.blk} vs ${this.ball.off}`);
    await this.eventLoop(p, 'blk', {});
    if(p.ts.keywordJump==='draw'){delete p.ts.keywordJump;this.cleanupSides(p);return this.receiveTurn(p);}
    if (p.ts.blk < this.ball.off) {this.cleanupSides(p);this.lost(p, `攔網 ${p.ts.blk} 小於進攻 ${this.ball.off}`);}
    await sharedRules.judgment(this,p,'block_success',{defense:p.ts.blk});
    this.cleanupSides(p);
    this.log(`攔網成功（${p.ts.blk} ≥ ${this.ball.off}），回球 0；側攔進棄牌區`);
    const outgoing=await this.confirmTurnEnd(p, { type: 'block', off: 0 });
    this.finishTurn(p);
    this.tag(p.idx + ':block');
    return outgoing;
  }

  // ---------- receive turn
  async receiveTurn(p) {
    const o = p.opp, ball = this.ball, off = ball.off;
    if (p.agent.wantsAck) await this.ask(p, { kind: 'ack', prompt: `抽牌階段：來球 ${ball.type === 'serve' ? '發球' : ball.type === 'block' ? '攔網回球' : '攻擊'} ${off}，先抽 1 張`, options: [{ label: '抽 1 張', value: true }] });
    this.draw(p, 1, '抽牌階段');
    await this.eventLoop(p, 'drw', {});
    this.setRulePhase('rcv');
    // receive
    const cs = [...new Set(p.handC().filter(c => this.canEnter(p,'receive',c)))];
    if (!cs.length) this.lost(p, '沒有能接球的角色');
    let c = await this.ask(p, { kind: 'receiver', prompt: `來球：${ball.type === 'serve' ? '發球' : ball.type === 'block' ? '攔網回球' : '攻擊'} ${off}。選擇接球角色`, ball, options: cs.map(x => ({ label: `${nm(x)}　接 ${this.rcvPreview(p, x)}`, card: x, value: x })) });
    await this.enterCharacter(p, 'receive', c); c=p.top('receive'); this.src = nm(c);
    let r = this.parameter(p,'receive','rcv') - (sharedRules.protectedParameter(this,p,'receive','rcv')?0:p.restrict.rcv_minus||0);
    if (legacySkill(c) && c === 'PR-022' && sharedRules.skillAllowed(this,p,c,'receive') && ball.type !== 'block' && off <= 2) { p.ts.apass = 1; this.log('澤村：A 傳球(1)'); if (p.guts('receive') >= 1 && await this.yes(p, 'skill', '澤村：付 1 Guts 抽 1？', { card: c })) { await this.pay(p, 'receive', 1); this.sdraw(p, 1); } }
    p.ts.rcv = r; p.ts.receiver = c; p.ts.receiverRef = this.cardReference(p, 'receive');
    this.log(`${p.name} 接球 ${nm(c)}：${r} vs ${ball.off}`);
    await this.eventLoop(p, 'rcv', {});
    r = p.ts.rcv;
    if (r < ball.off) this.lost(p, `接球 ${r} 小於來球 ${ball.off}`);
    this.log(`接球成功（${r} ≥ ${ball.off}）`);
    // toss
    this.setRulePhase('tos');
    const ts = [...new Set(p.handC().filter(x => this.canEnter(p, 'toss', x)))];
    if (!ts.length) this.lost(p, '沒有能舉球的角色');
    let t = await this.ask(p, { kind: 'setter', prompt: '選擇舉球角色', options: ts.map(x => ({ label: `${nm(x)}　舉 ${st(x, 'tos')}`, card: x, value: x })) });
    await this.enterCharacter(p, 'toss', t); t=p.top('toss'); this.src = nm(t);
    if(p.ts.keywordJump==='end'){const out=await this.confirmTurnEnd(p,{type:'attack',off:p.ts.keywordOutgoing.offense});this.finishTurn(p);return out;}
    let toss = this.parameter(p,'toss','tos') + (p.ts.apass || 0);
    if (legacySkill(t) && t === 'P01-006' && sharedRules.skillAllowed(this,p,t,'toss') && p.guts('toss') >= 2 && await this.yes(p, 'skill', '影山：付 2 Guts → 翻牌庫頂找日向/オープン，本回合日向攻擊 +2？', { card: t })) {
      await this.pay(p, 'toss', 2); p.ts.hin = 2;
      await this.revealTop(p, '影山', top => isHin(top) && top !== 'PR-057' || top === 'P01-078');
    }

    p.ts.toss = toss; p.ts.setter = t; p.ts.setterRef = this.cardReference(p, 'toss');
    this.log(`${p.name} 舉球 ${nm(t)}：${toss}`);
    await this.eventLoop(p, 'tos', {});
    if(p.ts.keywordJump==='end'){const out=await this.confirmTurnEnd(p,{type:'attack',off:p.ts.keywordOutgoing.offense});this.finishTurn(p);return out;}
    // attack
    this.setRulePhase('atk');
    const as = [...new Set(p.handC().filter(x => this.canEnter(p, 'attack', x)))];
    if (!as.length) this.lost(p, '沒有能攻擊的角色');
    const a = await this.ask(p, { kind: 'attacker', prompt: '選擇攻擊角色', options: as.map(x => ({ label: `${nm(x)}　攻 ${st(x, 'atk')}${isHin(x) && p.ts.hin ? ' +2' : x === 'PR-057' ? '（登場時選名稱）' : ''}`, card: x, value: x })) });
    await this.enterAttack(p, a, false);
    await this.eventLoop(p, 'atk', {});
    let offense = p.ts.toss + p.ts.atk;
    offense = (await this.confirmTurnEnd(p, { type: 'attack', off: offense }))?.off ?? offense;
    this.finishTurn(p);
    this.log(`${p.name} 攻擊 ${nm(p.ts.attacker)}：舉 ${p.ts.toss} ＋ 攻 ${p.ts.atk} ＝ 進攻 ${offense}`, 'atk');
    this.tag(p.idx + ':attack');
    return { type: 'attack', off: offense };
  }
  rcvPreview(p, c) {
    if(!this.canEnter(p,'receive',c))return '不可登場';
    const preview=sharedRules.entryPreview(this,p,c,'receive','rcv');
    let r = preview.value - (preview.protected?0:p.restrict.rcv_minus||0);
    const g = p.guts('receive') + (p.area.receive.length ? 1 : 0);
    const extra = [];
    if (c === 'D01-005' && g >= 3) extra.push('+2');
    if (c === 'P03-051' && g >= 2) extra.push('+2');
    if (c === 'P02-001' && p.sets.length + p.opp.sets.length <= 1 && g >= 3) extra.push('+6');
    if (c === 'P03-046' && this.ball.type === 'serve' && this.ball.off >= 6) extra.push('+2');
    return r + (extra.length ? `（技能 ${extra.join('')}）` : '');
  }
  async enterAttack(p, a, fromDrop) {
    const o = p.opp; this.src = nm(a);
    await this.enterCharacter(p, 'attack', a, fromDrop);
    a=p.top('attack');
    let atk = this.parameter(p,'attack','atk');
    const g = p.guts('attack');
    const t = p.ts.setter;
    if (this.cardName(p, 'attack') === '日向 翔陽' && p.ts.hin) atk += p.ts.hin;
    p.ts.atk = atk; p.ts.attacker = a; p.ts.attackerRef = this.cardReference(p, 'attack');
    this.log(`${p.name} 攻擊手 ${nm(a)}：攻 ${atk}`);
  }

  // ---------- events
  playable(p, timing) {
    if (this.sharedRulesPending) return [];
    const o = p.opp, res = [];
    // Draw-phase cards remain available until the receive check resolves.
    const drawWindow = timing === 'drw' || timing === 'rcv';
    const seen = new Set();
    for (const c of p.hand) {
      if (seen.has(c)) continue; seen.add(c);
      if(!isC(c)&&!sharedRules.eventAllowed(this,p,c,timing))continue;
      if (sharedRules.handles(c)) {
        if (sharedRules.canPlay(this, p, c, timing)) res.push({card:c,label:nm(c)+(p.ts.used?.[c]?'（技能已失效，僅放入Event區）':'')});
        continue;
      }
      if (this.mode === 'numeric' && library.permission(c)?.kind === 'unapproved') {
        const phases = library.card(c).activationPhases, phase = {srv:'serve',drw:'draw',rcv:'receive',tos:'toss',atk:'attack',blk:'block'}[timing];
        if (!isC(c) && p.agent.wantsAck && (phases.includes(phase) || timing==='rcv'&&phases.includes('draw'))) res.push({card:c,label:nm(c)+'（技能未自動化）'});
        continue;
      }
      if (!legacySkill(c)) continue;
      const T = EVT[c];
      if (isC(c)) {
        continue;
      }
      if (!T || !(T.includes(timing) || (drawWindow && T.includes('drw')))) continue;
      if(!sharedRules.skillAllowed(this,p,c)){res.push({card:c,label:nm(c)+'（技能失效，僅放入Event區）'});continue;}
      if (p.ts.used[c] && ['P03-087', 'P04-088', 'P04-089'].includes(c)) continue;
      const ok = {
        'PR-029': () => this.skillHandAllowed(p) && p.drop.some(x => isHin(x) && x !== 'PR-057' || nm(x) === '影山 飛雄'),
        'P03-086': () => !!p.ts.setter && ['影山 飛雄', '菅原 孝支', '及川 徹'].includes(nm(p.ts.setter)),
        'P01-078': () => !!p.ts.attacker,
        'P03-087': () => this.uniformCourt(p),
      }[c];
      if (ok && ok()) res.push({ card: c, label: nm(c) });
    }
    return res;
  }
  async eventLoop(p, timing, ctx) {
    this.setRulePhase(timing);
    for (;;) {
      if(p.ts.keywordJump)return;
      const opts = this.playable(p, timing);
      const canManual = this.mode === 'numeric' && !!p.agent.wantsAck;
      if (!opts.length && !canManual) return;
      const zh = { srv: '發球階段', drw: '抽牌階段', rcv: '接球判定前', tos: '舉球階段', atk: '攻擊階段', blk: '攔網階段' }[timing];
      const status = timing === 'blk' ? `目前攔網 ${p.ts.blk} vs 進攻 ${this.ball.off}` : timing === 'rcv' ? `目前接球 ${p.ts.rcv} vs 來球 ${this.ball.off}` : timing === 'atk' ? `目前進攻 ${p.ts.toss + p.ts.atk}` : timing === 'tos' ? `目前舉球 ${p.ts.toss}` : '';
      const pick = await this.ask(p, { kind: 'event', canManual, timing, prompt: `${zh}：要使用卡片嗎？${status ? '　' + status : ''}`, options: [...opts.map(o => ({ label: o.label, card: o.card, value: o.card })), { label: timing === 'rcv' ? '完成事件，判定接球' : '結束，進入下一步', value: null }] });
      if (pick?.__manual && canManual) { try { await this.manualAction(p,pick.__manual); } catch(e) { this.log(e.message,'warn'); } continue; }
      if (!pick) return;
      await this.resolve(p, pick, timing);
    }
  }
  async resolve(p, c, timing) {
    sharedRules.assertReady(this);
    this.setRulePhase(timing);
    const o = p.opp; this.src = nm(c);
    if(!isC(c)&&!sharedRules.eventAllowed(this,p,c,timing))throw Error('目前禁止使用這張事件卡');
    if (this.mode === 'numeric' && library.permission(c)?.kind === 'unapproved') {
      if (!this.playable(p,timing).some(o=>o.card===c)) throw Error('此卡現在不能使用');
      this.moveCode(p.hand,p.ev,c);this.log(`${p.name} 放入 ${nm(c)}：${sharedRules.skillAllowed(this,p,c)?'技能未自動化，請手動處理':'技能已失效，不執行效果'}`,'ev');return;
    }
    if (sharedRules.handles(c)) return sharedRules.resolve(this, p, c, timing);
    if (!legacySkill(c)) throw Error('技能未獲自動結算核准');
    return sharedRules.legacyEffect(this, () => this.resolveLegacy(p, c, timing));
  }
  async resolveLegacy(p, c, timing) {
    if (!legacySkill(c)) throw Error('不在舊技能白名單');
    const o = p.opp;
    if (isC(c)) {
      this.moveCode(p.hand, p.drop, c);
      return;
    }
    this.moveCode(p.hand, p.ev, c); p.ts.used[c] = 1;
    this.log(`${p.name} 打出 ${nm(c)}`, 'ev');
    if(!sharedRules.skillAllowed(this,p,c)){this.log('技能已失效：僅放入Event區，不支付費用或執行效果。','warn');return;}
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
      case 'P03-086': {
        p.ts.toss = 2; this.log('舉球設為 2');
        const back = [...new Set(p.ev.filter(x => EVT[x] && EVT[x].length === 1 && EVT[x][0] === 'atk'))];
        if (await this.yes(p, 'skill', 'おりこう：放回牌庫底，從 Event 區最多拿 1 張攻擊 Event 回手？', {})) {
          const x = await this.optionalRetrieve(p, '最多選 1 張攻擊 Event 回手', back);
          this.moveCode(p.ev, p.deck, c, 0);
          if (x && await this.sadd(p, x, p.ev)) this.log(`回收 ${nm(x)}`);
        }
        break;
      }
      case 'P01-078': {
        this.sdraw(p, 2);
        if (p.hand.length) await this.discard(p, 'オープン攻撃：抽 2 後棄 1 張');
        if (p.ev.filter(x => x === 'P01-078').length <= 2 && this.cardName(p, 'toss') !== '日向 翔陽') {
          const hs = [...new Set(p.drop.filter(x => HIN.has(x)))];
          if (hs.length) {
            const h = hs.length === 1 ? hs[0] : await this.ask(p, { kind: 'summon', prompt: 'オープン攻撃：選棄牌區的日向登場攻擊區（必須）', options: hs.map(y => ({ label: `${nm(y)} ${y}　攻 ${st(y, 'atk')}`, card: y, value: y })) });
            await this.enterAttack(p, h, true); p.ts.atk += 1; this.log(`オープン攻撃：${nm(h)} 登場，攻擊 → ${p.ts.atk}`);
          } else this.log('棄牌區沒有日向，オープン只抽牌');
        }
        break;
      }
      case 'P03-087': {
        if (!this.uniformCourt(p)) { this.log('場上角色未全部同為烏野或ユース，效果不成立', 'warn'); break; }
        this.sdraw(p, 1);
        const key = await this.chooseTarget(p, this.courtTargets(p).filter(t => this.parameter(p, t.key, 'atk') != null), '周りの上手さ：選擇場上 1 人攻擊 +1', timing);
        if (key != null) {
          this.boostParameter(p, key, 'atk', 1);
          if (this.cardName(p, key) === '影山 飛雄' && this.courtGuts(p).length >= 6 && await this.yes(p, 'skill', '影山：從場上各區合計付 6 Guts，再選此角色任一數值 +2？', { card: 'P03-087', target: key })) {
            if (await this.payCourt(p, 6)) await this.chooseParameter(p, key, 2, '影山 6 Guts', timing);
          }
        }
        break;
      }
    }
  }
}

// ======================== AI ========================
function canChain(hand, rname, drop) {
  const cs = hand.filter(isC);
  for (const t of cs) {
    if (st(t, 'tos') == null) continue;
    const rest = cs.slice(); rest.splice(rest.indexOf(t), 1);
    if (entryNames(t).some(name => name !== rname && rest.some(a => st(a, 'atk') != null && entryNames(a).some(other => other !== name)))) return true;
  }
  return false;
}
function rcvPotential(g, p, c) {
  const off = g.ball.off;
  const preview=sharedRules.entryPreview(g,p,c,'receive','rcv');
  let v = preview.value - (preview.protected?0:p.restrict.rcv_minus||0);
  const gg = p.guts('receive') + (p.area.receive.length ? 1 : 0);
  if (c === 'D01-005' && gg >= 3) v += 2;
  if (c === 'P03-051' && gg >= 2) v += 2 + (g.ball.type === 'attack' && p.opp.ts.attacker && st(p.opp.ts.attacker, 'atk') === 0 ? 3 : 0);
  if (c === 'P02-001' && p.sets.length + p.opp.sets.length <= 1 && gg >= 3) v += 6;
  if (c === 'P03-046' && g.ball.type === 'serve' && off >= 6) v += 2;
  if (c === 'P01-039' && off >= 6 && p.hand.filter(isA).length >= 2) v += 1;
  const rest = p.hand.slice(); rest.splice(rest.indexOf(c), 1);
  let boost = 0;
  if (isK(c) && rest.includes('P01-013') && c !== 'P01-013') boost += 2;
  if (isA(c) && rest.includes('P01-088')) boost += 1;
  if (isA(c) && hasYear(c, 3) && rest.includes('P04-089')) boost += 1;
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
      case 'firstService': return 'serve';
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
        if (!req.combos.length) return 'receive';
        const cheap = req.combos[0] && req.combos[0].cards.length === 1;
        if (cheap) return 'block';
        const anyRcv = p.handC().some(c => g.canEnter(p,'receive',c) && rcvPotential(g, p, c).v + rcvPotential(g, p, c).boost >= g.ball.off);
        return anyRcv ? 'receive' : 'block';
      }
      case 'block': return 0;
      case 'receiver': {
        const off = g.ball.off; let best = null;
        for (const x of opts) {
          const c = x.value; const { v, boost, rest } = rcvPotential(g, p, c);
          if (v + boost < off) continue;
          if (!entryNames(c).some(name => canChain(rest, name, p.drop))) continue;
          const cost = val(c) + (v < off ? 2 : 0);
          if (!best || cost < best.cost) best = { c, cost };
        }
        if (best) return best.c;
        return byVal(opts, x => rcvPotential(g, p, x.value).v).value;
      }
      case 'setter': {
        return byVal(opts, x => {
          const t = x.value; const rest = p.hand.slice(); rest.splice(rest.indexOf(t), 1);
          let s = st(t, 'tos') * 3 - val(t) * 0.3;
          if (!g.legalEntryNames(p, 'toss', t).some(name => rest.some(a => isC(a) && st(a, 'atk') != null && entryNames(a).some(other => other !== name)))) s -= 50;
          if (legacySkill(t) && t === 'P01-006' && sharedRules.skillAllowed(g,p,t,'toss') && p.guts('toss') + (p.area.toss.length ? 1 : 0) >= 2 && rest.some(a => HIN.has(a))) s += 8;
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
          if (g.legalEntryNames(p, 'attack', a).includes('日向 翔陽')) b += p.ts.hin || 0;
          return b * 3 - val(a) * 0.5;
        }).value;
      }
      case 'skill': {
        if(req.ctx?.ineffectiveReason)return false;
        if (req.ctx && req.ctx.need != null && req.ctx.need <= 0 && ['D01-005', 'P01-039'].includes(req.ctx.card)) return false;
        return true;
      }
      case 'name': {
        const area = req.ctx.area;
        const rest = p.hand.slice(); rm(rest, 'PR-057');
        if (area === 'receive') return (opts.find(o => canChain(rest, o.value)) || opts[0]).value;
        if (area === 'toss') return (opts.find(o => rest.some(c => isC(c) && st(c, 'atk') != null && entryNames(c).some(n => n !== o.value))) || opts[0]).value;
        return (opts.find(o => o.value === '日向 翔陽') || opts[0]).value;
      }
      case 'target': {
        const active = { srv: 'serve', tos: 'toss', rcv: 'receive', atk: 'attack', blk: 'block' }[req.timing];
        return (opts.find(o => o.value === active) || opts[0]).value;
      }
      case 'parameter': {
        const key = req.ctx.target, active = { receive: 'rcv', toss: 'tos', attack: 'atk', block: 'blk', serve: 'srv' }[key] || 'blk';
        return (opts.find(o => o.value === active) || opts[0]).value;
      }
      case 'rulesChoice': if(req.ctx?.keywordOutgoing)return opts.reduce((a,b)=>Number(a.value)>Number(b.value)?a:b).value;return opts[0].value;
      case 'guts': case 'gutsCourt': return opts.slice(0, req.need).map(o => o.value);
      case 'event': {
        const cards = opts.filter(x => x.value);
        for (const x of cards) {
          const c = x.value;
          if (sharedRules.handles(c) && p.ts.used?.[c]) continue;
          if (req.timing === 'rcv' && sharedRules.handles(c) && p.ts.rcv < g.ball.off) return c;
          if (req.timing === 'blk') { if (p.ts.blk < g.ball.off) return c; continue; }
          if (req.timing === 'rcv') {
            if (p.ts.rcv < g.ball.off && ['P01-013', 'P01-088', 'P04-089'].includes(c)) return c;
            if (c === 'P03-096' && p.ts.rcv < g.ball.off && g.cardName(p, 'receive') === '日向 翔陽') return c;
            if (c === 'P03-087' && p.ts.rcv < g.ball.off && g.cardName(p, 'receive') === '影山 飛雄' && g.courtGuts(p).length >= 6) return c;
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
          if (c === 'P03-057' && !p.hand.some(x=>isC(x)&&kuroEligible(x))) continue;
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

const api = { DEF, DECKS, HIN, AREAS, AREA_ZH, EVT, Game, AI, nm, isC, st, val, sch, yr, short, canChain, recvName, atkName, isHin, entryNames, hasSchool, hasYear, validateDeck };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BreakEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
