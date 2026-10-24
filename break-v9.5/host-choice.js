/* BREAK 通用玩家選擇（C）：依 rules/HOST-CONTRACT.md（break.host.v1）驗證回答、管理選取狀態、產生 AI 基礎合法決策。
   純函式、不碰 DOM、不改規則狀態；UI（choice-ui.js）與 AI 共用同一套驗證。Claude 2026-10-21。 */
(function (root) {
'use strict';
const PROTOCOL = 'break.host.v1';
const INPUT_TYPES = ['ack', 'single', 'cards', 'number', 'block'];
const REQUIRED = ['protocol', 'matchId', 'requestId', 'epoch', 'revision', 'decisionIndex', 'actor', 'origin', 'kind', 'prompt', 'input', 'options', 'canLoss', 'canManual'];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fail = error => ({ ok: false, error });
const OK = { ok: true, error: null };

// ---------- request 本身的形狀
function checkRequest(req) {
  if (!req || typeof req !== 'object') return fail('request 不是物件');
  for (const k of REQUIRED) if (!(k in req)) return fail('request 缺少欄位：' + k);
  if (req.protocol !== PROTOCOL) return fail('不支援的協定：' + req.protocol);
  const input = req.input;
  if (!input || !INPUT_TYPES.includes(input.type)) return fail('未知的 input.type：' + (input && input.type));
  if (['slots','groups','constraints'].some(k => Object.prototype.hasOwnProperty.call(input,k) || Object.prototype.hasOwnProperty.call(req,k))) return fail('此限制屬於尚未支援的 v2 契約');
  if (!Array.isArray(req.options)) return fail('options 必須是陣列');
  const ids = new Set();
  for (const o of req.options) {
    if (!o || typeof o !== 'object' || !('value' in o) || !('id' in o)) return fail('option 缺少 id 或 value');
    if (ids.has(o.id)) return fail('option id 重複：' + o.id);
    ids.add(o.id);
  }
  if (input.type === 'cards' || input.type === 'block') {
    if (!Number.isInteger(input.min) || !Number.isInteger(input.max) || input.min < 0 || input.max < input.min) return fail('cards/block 的 min/max 不合法');
    if (input.max > req.options.length) return fail('max 超過候選數');
  }
  if (input.type === 'block') {
    const b = req.context && req.context.block;
    if (!b || !Number.isInteger(b.maxCount)) return fail('block 缺少 context.block.maxCount');
  }
  return OK;
}

// ---------- 回答封套
function checkEnvelope(req, answer) {
  if (!answer || typeof answer !== 'object') return fail('回答不是物件');
  for (const k of ['matchId', 'requestId', 'epoch', 'actor']) if (answer[k] !== req[k]) return fail('回答的 ' + k + ' 與目前決策不符（可能已過期）');
  if (!('value' in answer)) return fail('回答缺少 value');
  return OK;
}

// 有效名：卡片可見印刷資訊的名稱；沒有時退回 label
const effName = o => (o && o.card && (o.card.effectiveName || o.card.name)) || (o && o.label) || '';

function distinctEntryNames(options) {
  const groups=options.map(o=>o?.card?.entryNames||[effName(o)]);
  const visit=(i,used)=>i===groups.length||groups[i].some(n=>!used.includes(n)&&visit(i+1,[...used,n]));
  return visit(0,[]);
}
// ---------- value 驗證（UI 與 AI 共用）
function checkValue(req, value) {
  const r = checkRequest(req); if (!r.ok) return r;
  const { input, options } = req;
  switch (input.type) {
    case 'ack':
      return value === true ? OK : fail('確認只能回答 true');
    case 'single':
    case 'number': {
      if (Array.isArray(value)) return fail('這一題只能選一個');
      if (input.type === 'number' && !Number.isInteger(value)) return fail('數量必須是整數');
      return options.some(o => same(o.value, value)) ? OK : fail('不是合法選項');
    }
    case 'cards': {
      if (!Array.isArray(value)) return fail('必須回答卡片 ID 陣列');
      const legal = new Set(options.map(o => JSON.stringify(o.value)));
      const seen = new Set();
      for (const v of value) {
        const key = JSON.stringify(v);
        if (!legal.has(key)) return fail('包含不在候選裡的卡');
        if (seen.has(key)) return fail('同一張卡不能選兩次');
        seen.add(key);
      }
      if (value.length < input.min) return fail(`至少要選 ${input.min} 張`);
      if (value.length > input.max) return fail(`最多只能選 ${input.max} 張`);
      return OK;
    }
    case 'block': {
      if (!value || typeof value !== 'object' || !Array.isArray(value.cards)) return fail('攔網回答必須是 {cards, center}');
      const b = req.context.block, byVal = new Map(options.map(o => [JSON.stringify(o.value), o]));
      const seen = new Set(), names = new Set();
      for (const v of value.cards) {
        const key = JSON.stringify(v), o = byVal.get(key);
        if (!o) return fail('包含不能攔網的角色');
        if (seen.has(key)) return fail('同一張卡不能選兩次');
        seen.add(key);
        if (b.distinctEffectiveNames && !distinctEntryNames(value.cards.slice(0,seen.size).map(v=>byVal.get(JSON.stringify(v))))) return fail('攔網不能派同名角色');
      }
      const n = value.cards.length;
      if (n < Math.max(input.min, 1)) return fail('至少要派 1 人攔網');
      if (n > Math.min(input.max, b.maxCount)) return fail(`最多 ${Math.min(input.max, b.maxCount)} 人攔網`);
      if (b.centerRequired !== false && !value.cards.some(v => same(v, value.center))) return fail('要指定 1 位中攔，而且必須是出場的攔網手');
      return OK;
    }
  }
  return fail('未知的 input.type');
}
function validate(req, answer) { const e = checkEnvelope(req, answer); return e.ok ? checkValue(req, answer.value) : e; }
function makeAnswer(req, value) { return { matchId: req.matchId, requestId: req.requestId, epoch: req.epoch, actor: req.actor, value }; }

// ---------- 選取狀態（給 UI 用；不可變更新）
function createSelection(req) {
  const t = req.input.type;
  return { type: t, picked: [], center: null, value: undefined };
}
// Restore only legal candidate identities; never submit or restore an error.
function restoreSelection(req, saved) {
  let s=createSelection(req);if(!saved||saved.type!==req.input.type)return s;
  const legal=v=>req.options.some(o=>same(o.value,v));
  if(['single','number'].includes(req.input.type))return legal(saved.value)?toggle(req,s,saved.value):s;
  for(const value of saved.picked||[])if(legal(value)&&!s.picked.some(v=>same(v,value)))s=toggle(req,s,value);
  if(req.input.type==='block')s=setCenter(req,s,saved.center);
  return {...s,error:null};
}
function toggle(req, sel, optionValue) {
  const t = req.input.type, key = JSON.stringify(optionValue);
  if (t === 'single' || t === 'number') return { ...sel, value: optionValue, error: null };
  if (t !== 'cards' && t !== 'block') return sel;
  const has = sel.picked.some(v => JSON.stringify(v) === key);
  if (has) {
    const picked = sel.picked.filter(v => JSON.stringify(v) !== key);
    const center = sel.center !== null && JSON.stringify(sel.center) === key ? (picked[0] === undefined ? null : picked[0]) : sel.center;
    return { ...sel, picked, center, error: null };
  }
  const max = t === 'block' ? Math.min(req.input.max, req.context.block.maxCount) : req.input.max;
  if (sel.picked.length >= max) {
    if (max === 1) return { ...sel, picked: [optionValue], center: t === 'block' ? optionValue : sel.center, error: null }; // 單張時直接換
    return { ...sel, error: `最多只能選 ${max} 張` };
  }
  if (t === 'block' && req.context.block.distinctEffectiveNames) {
    const o = req.options.find(x => JSON.stringify(x.value) === key), n = effName(o);
    if (!distinctEntryNames([...sel.picked.map(v=>req.options.find(x=>same(x.value,v))),o])) return { ...sel, error: '攔網不能派同名角色：' + n };
  }
  const picked = [...sel.picked, optionValue];
  return { ...sel, picked, center: t === 'block' && sel.center === null ? optionValue : sel.center, error: null };
}
function setCenter(req, sel, optionValue) {
  if (req.input.type !== 'block' || !sel.picked.some(v => same(v, optionValue))) return sel;
  return { ...sel, center: optionValue, error: null };
}
function selectionValue(req, sel) {
  switch (req.input.type) {
    case 'ack': return true;
    case 'single': case 'number': return sel.value;
    case 'cards': return sel.picked.slice();
    case 'block': return { cards: sel.picked.slice(), center: sel.center };
  }
}
function canSubmit(req, sel) { const v = selectionValue(req, sel); return v !== undefined && checkValue(req, v).ok; }
function progress(req, sel) {
  const i = req.input;
  if (i.type === 'cards') return i.min === i.max ? `已選 ${sel.picked.length} / ${i.max}` : `已選 ${sel.picked.length}（${i.min}–${i.max} 張）`;
  if (i.type === 'block') return `攔網 ${sel.picked.length} 人（最多 ${Math.min(i.max, req.context.block.maxCount)}）`;
  return '';
}

// ---------- AI 基礎合法決策：只讀 request 可見資訊，結果一定通過 validator
const PREFER_TRUE = new Set(['skill', 'activate_payment', 'optional']);
const PREFER_MAX = new Set(['draw_count', 'entry_count', 'move_count', 'target_count']);
const PREFER_MIN = new Set(['mill_count']);
function aiValue(req) {
  const r = checkRequest(req); if (!r.ok) throw Error(r.error);
  if(req.context?.ineffectiveReason&&req.options.some(o=>o.value===false))return false;
  const { input, options, kind } = req;
  if (!options.length && input.type !== 'ack' && !(input.type === 'cards' && input.min === 0)) throw Error('沒有合法選項：' + kind);
  switch (input.type) {
    case 'ack': return true;
    case 'single': {
      if (kind === 'firstService') { const s = options.find(o => o.value === 'serve'); if (s) return s.value; }
      if (kind === 'defend') { const s = options.find(o => o.value === 'receive'); if (s) return s.value; }
      if (PREFER_TRUE.has(kind)) { const s = options.find(o => o.value === true); if (s) return s.value; }
      const real = options.find(o => o.value !== null && o.value !== false);
      return (real || options[0]).value;
    }
    case 'number': {
      const nums = options.map(o => o.value).filter(Number.isInteger).sort((a, b) => a - b);
      if (PREFER_MIN.has(kind)) return nums[0];
      if (PREFER_MAX.has(kind)) return nums[nums.length - 1];
      return nums[0];
    }
    case 'cards': {
      if (kind === 'mulligan') return input.min ? options.slice(0, input.min).map(o => o.value) : [];
      return options.slice(0, input.min).map(o => o.value);
    }
    case 'block': {
      const b = req.context.block, max = Math.min(input.max, b.maxCount), pick = [], names = new Set();
      for (const o of options) {
        if (pick.length >= Math.max(1, input.min)) break;
        const n = effName(o); if (b.distinctEffectiveNames && !distinctEntryNames([...pick.map(v=>options.find(x=>same(x.value,v))),o])) continue;
        names.add(n); pick.push(o.value);
      }
      if (pick.length > max) pick.length = max;
      return { cards: pick, center: pick[0] };
    }
  }
  throw Error('未知的 input.type');
}
function aiAnswer(req) {
  const ans = makeAnswer(req, aiValue(req));
  const v = validate(req, ans); if (!v.ok) throw Error('AI 回答未通過驗證：' + v.error);
  return ans;
}

const api = { PROTOCOL, INPUT_TYPES, checkRequest, checkEnvelope, checkValue, validate, makeAnswer, createSelection, restoreSelection, toggle, setCenter, selectionValue, canSubmit, progress, aiValue, aiAnswer, effName };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BreakHostChoice = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
