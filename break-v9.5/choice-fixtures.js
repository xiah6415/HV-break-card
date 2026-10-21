/* C 通用選擇元件的 fixture：依 HOST-CONTRACT 範例卡建立 break.host.v1 request（僅供元件測試，不代表核准或已接入）。 */
(function (root) {
'use strict';
let seq = 0;
const ref = (cardNo, name, n = seq++) => ({ id: 'c' + n, incarnation: 0, cardNo, name });
const cardOpt = (cardNo, name, label) => { const card = ref(cardNo, name); return { id: card.id, value: card.id, label: label || name, card }; };
const opt = (value, label) => ({ id: 'o:' + JSON.stringify(value), value, label });
function req(kind, prompt, input, options, extra = {}) {
  const i = seq++;
  return Object.assign({ protocol: 'break.host.v1', matchId: 'demo', requestId: 'demo:1:' + i, epoch: 1, revision: i, decisionIndex: i, actor: 0, origin: 'kernel', kind, prompt, timing: null, source: null, input, options, context: {}, canLoss: false, canManual: false }, extra);
}
const F = [];
F.push(req('firstService', '你擲骰獲勝，選擇先發或先接', { type: 'single' }, [opt('serve', '先發球'), opt('receive', '先接球')], { origin: 'game', context: { dice: [5, 2], winner: 0 } }));
F.push(req('mulligan', '起手調度：選要放回牌庫的牌（0～6 張）', { type: 'cards', min: 0, max: 6, ordered: false }, [
  cardOpt('HV-P01-004', '日向 翔陽'), cardOpt('HV-P01-004', '日向 翔陽'), cardOpt('HV-P01-006', '影山 飛雄'),
  cardOpt('HV-D01-005', '西谷 夕'), cardOpt('HV-P01-078', 'オープン攻撃'), cardOpt('HV-P01-013', '縁下 力')], { origin: 'game', context: { role: 'receive' } }));
F.push(req('payment_cards', '犬岡：從手牌放 1 張音駒 Event 到 Event 區', { type: 'cards', min: 1, max: 1, ordered: false }, [
  cardOpt('HV-P01-082', 'これが "繋ぐ"ということだ'), cardOpt('HV-P01-082', 'これが "繋ぐ"ということだ'), cardOpt('HV-P03-088', '山本 あかね・灰羽 アリサ')],
  { source: ref('HV-PR-044', '犬岡 走'), context: { destination: 'self.event' }, canLoss: true }));
F.push(req('parameter', '犬岡：選擇要 +3 的數值', { type: 'single' }, [opt('block', '攔網'), opt('receive', '接球'), opt('toss', '舉球'), opt('attack', '攻擊')], { source: ref('HV-PR-044', '犬岡 走'), canLoss: true }));
F.push(req('payment_count', '日向：支付 2 或 3 Guts', { type: 'number' }, [opt(2, '付 2 張'), opt(3, '付 3 張')], { source: ref('HV-PR-080', '日向 翔陽'), context: { allowedCounts: [2, 3] }, canLoss: true }));
F.push(req('mode', '日向（疑似ユース）：選擇一個效果', { type: 'single' }, [opt(0, '抽 1 張牌'), opt(1, 'Event 區 6 張以上：從 Event 區回收 1 張')], { source: ref('HV-P03-001', '日向 翔陽'), canLoss: true }));
F.push(req('name', '着地上手組。：選擇登場後的名稱', { type: 'single' }, [opt('日向 翔陽', '日向 翔陽'), opt('西谷 夕', '西谷 夕')], { origin: 'game', source: ref('HV-PR-057', '着地上手組。'), context: { area: 'receive' }, canLoss: true }));
F.push(req('reveal', '影山：翻開牌庫頂 1 張', { type: 'ack' }, [], { origin: 'game', source: ref('HV-P01-006', '影山 飛雄'), canLoss: true }));
F.push(req('revealResult', '翻到オープン攻撃，加入手牌', { type: 'ack' }, [], { origin: 'game', source: ref('HV-P01-006', '影山 飛雄'), context: { revealed: ref('HV-P01-078', 'オープン攻撃'), result: 'added' }, canLoss: true }));
F.push(req('guts', '日向：從攻擊區付 2 Guts（最上面的角色不能付）', { type: 'cards', min: 2, max: 2, ordered: false }, [
  cardOpt('HV-P01-002', '日向 翔陽'), cardOpt('HV-P01-004', '日向 翔陽'), cardOpt('HV-P02-013', '菅原 孝支'), cardOpt('HV-P01-006', '影山 飛雄')],
  { source: ref('HV-D01-001', '日向 翔陽'), context: { areas: ['attack'] }, canLoss: true }));
F.push(req('block', '組攔網：進攻 7', { type: 'block', min: 1, max: 3 }, [
  cardOpt('HV-P02-003', '月島 蛍'), cardOpt('HV-P01-004', '日向 翔陽'), cardOpt('HV-P01-002', '日向 翔陽'), cardOpt('HV-P01-006', '影山 飛雄')],
  { origin: 'game', context: { ball: { type: 'attack', off: 7 }, block: { maxCount: 3, distinctEffectiveNames: true, centerRequired: true } }, canLoss: true }));
F.push(req('payment_cards', '二口：從手牌棄 2 張伊達工業的牌', { type: 'cards', min: 2, max: 2, ordered: false }, [
  cardOpt('HV-P02-041', '作並 浩輔'), cardOpt('HV-P02-036', '青根 高伸'), cardOpt('HV-P02-036', '青根 高伸')],
  { source: ref('HV-P03-064', '二口 堅治'), context: { destination: 'self.drop' }, canLoss: true }));
F.push(req('activate_payment', '縁下：棄 1 張手牌，接球 +3？', { type: 'single' }, [opt(true, '發動'), opt(false, '不發動')], { source: ref('HV-D01-007', '縁下 力'), context: { payment: 'discard_1' }, canLoss: true }));
F.push(req('trigger_order', '同時觸發：選擇先結算哪一個', { type: 'single' }, [opt('job:7', 'ドンピシャ!!! 的監聽'), opt('job:8', '西谷 夕（自身登場）')], { canLoss: true }));
F.push(req('move_cards', '（示範）把翻開的 3 張依序放回牌庫頂（先選的在最上面）', { type: 'cards', min: 3, max: 3, ordered: true }, [
  cardOpt('HV-P01-002', '日向 翔陽'), cardOpt('HV-P01-078', 'オープン攻撃'), cardOpt('HV-P01-006', '影山 飛雄')], { context: { destination: 'self.deck_top' } }));
F.push(req('guts_destination', '谷地：把烏野角色放到哪一區當 Guts', { type: 'single' }, [opt('receive', '接球區'), opt('toss', '舉球區'), opt('attack', '攻擊區')], { source: ref('HV-P02-079', '谷地 仁花') }));
F.push(req('draw_count', '最多抽 2 張', { type: 'number' }, [opt(0, '0'), opt(1, '1'), opt(2, '2')], { canLoss: true }));
F.push(req('move_cards', '挑戦者たち：從任一區的 1 年 Guts 最多 1 張加入手牌', { type: 'cards', min: 0, max: 1, ordered: false }, [
  cardOpt('HV-P01-004', '日向 翔陽'), cardOpt('HV-P02-013', '菅原 孝支')], { source: ref('HV-PR-078', '挑戦者たち'), context: { destination: 'self.hand' }, canLoss: true }));
const api = { fixtures: F, req, ref, opt, cardOpt };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BreakChoiceFixtures = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
