/* BREAK 通用選擇 UI（C）：依 break.host.v1 request 的 input 自動產生介面；所有回答先經 BreakHostChoice 驗證。
   用法：BreakChoiceUI.render(容器, request, { onAnswer(answer), onLoss(), imgSrc(cardNo), onCard(cardRef) }) → { destroy() }
   卡片以實體 ID 為 key，同卡號多張分開顯示；不改規則狀態。Claude 2026-10-21。 */
(function (root) {
'use strict';
const H = root.BreakHostChoice || (typeof require !== 'undefined' ? require('./host-choice') : null);
const CSS = `
.hc{display:grid;gap:10px;min-width:0;font:inherit;color:var(--ink,#122326)}
.hc *{box-sizing:border-box}
.hc-head{display:flex;gap:10px;align-items:flex-start;min-width:0}
.hc-head .hc-src{flex:0 0 44px;width:44px}
.hc-q{font-weight:700;font-size:15px;line-height:1.4;min-width:0;overflow-wrap:anywhere}
.hc-q small{display:block;font-weight:400;font-size:12px;color:var(--muted,#566b6e);margin-top:2px}
.hc-ctx{display:flex;gap:8px;align-items:center;font-size:12.5px;color:var(--muted,#566b6e);flex-wrap:wrap}
.hc-ctx .hc-rev{width:56px}
.hc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:8px;min-width:0}
.hc-card{position:relative;border:0;padding:0;background:none;cursor:pointer;display:grid;gap:3px;min-width:0;text-align:center;color:inherit;font:inherit;border-radius:7px}
.hc-card img,.hc-src img,.hc-rev img{display:block;width:100%;aspect-ratio:300/419;object-fit:cover;border-radius:6px;background:var(--sunk,#d9e4e3)}
.hc-card span.hc-nm{font-size:11px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hc-card.on img{box-shadow:0 0 0 3px var(--court,#d96a1f)}
.hc-card[aria-pressed="false"] img{opacity:.92}
.hc-card .hc-badge{position:absolute;top:-6px;right:-4px;min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:var(--court,#d96a1f);color:#fff;font-size:12px;font-weight:700;display:grid;place-items:center}
.hc-card .hc-badge.ctr{background:var(--teal,#0e7175)}
.hc-opts{display:flex;flex-wrap:wrap;gap:8px;min-width:0}
.hc-opt{border:1px solid var(--line,#c3d3d2);background:var(--sunk,#d9e4e3);border-radius:999px;padding:9px 14px;min-height:42px;cursor:pointer;font:inherit;font-size:14px;color:inherit;text-align:left;max-width:100%;overflow-wrap:anywhere}
.hc-opt.on{background:var(--court,#d96a1f);border-color:var(--court,#d96a1f);color:#fff;font-weight:700}
.hc-opt.num{min-width:52px;text-align:center;font-size:17px;font-weight:700}
.hc-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.hc-go{border:0;border-radius:999px;padding:11px 20px;min-height:44px;background:var(--court,#d96a1f);color:#fff;font:inherit;font-weight:700;cursor:pointer}
.hc-go[disabled]{opacity:.4;cursor:not-allowed}
.hc-quiet{border:1px solid var(--line,#c3d3d2);background:transparent;border-radius:999px;padding:9px 14px;min-height:42px;font:inherit;color:inherit;cursor:pointer}
.hc-loss{margin-left:auto;border:1px solid var(--bad,#b83229);color:var(--bad,#b83229);background:transparent;border-radius:999px;padding:9px 14px;min-height:42px;font:inherit;cursor:pointer}
.hc-prog{font-size:12.5px;color:var(--muted,#566b6e)}
.hc-err{font-size:12.5px;color:var(--bad,#b83229);min-height:1em}
.hc-chips{display:flex;flex-wrap:wrap;gap:6px}
.hc-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line,#c3d3d2);border-radius:999px;padding:3px 4px 3px 10px;font-size:12.5px;background:var(--sunk,#d9e4e3)}
.hc-chip.ctr{border-color:var(--teal,#0e7175)}
.hc-chip button{border:0;background:var(--surface,#fff);color:inherit;border-radius:999px;padding:3px 9px;font:inherit;font-size:11.5px;cursor:pointer;min-height:28px}
@media (prefers-reduced-motion:no-preference){.hc-card img{transition:box-shadow .12s}}`;
function ensureCss(doc) {
  if (doc.getElementById('hc-style')) return;
  const s = doc.createElement('style'); s.id = 'hc-style'; s.textContent = CSS; doc.head.appendChild(s);
}
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const key = v => JSON.stringify(v);
const GO_LABEL = { ack: '確認', block: '確認攔網', cards: '確認', single: '確認', number: '確認' };

function render(rootEl, request, opts = {}) {
  const doc = rootEl.ownerDocument; ensureCss(doc);
  const chk = H.checkRequest(request);
  if (!chk.ok) { rootEl.innerHTML = `<div class="hc"><p class="hc-err" role="alert">無法顯示這個選擇：${esc(chk.error)}</p></div>`; return { destroy() { rootEl.innerHTML = ''; } }; }
  const t = request.input.type, imgSrc = opts.imgSrc || (() => ''), cardImg = c => `<img src="${esc(imgSrc(c.cardNo))}" alt="${esc(c.name || c.cardNo)}" loading="lazy" draggable="false">`;
  let sel = H.createSelection(request), lossArm = false, done = false;
  const byKey = new Map(request.options.map(o => [key(o.value), o]));
  const hasCards = request.options.some(o => o.card);

  function body() {
    if (t === 'ack') return '';
    if (t === 'cards' || t === 'block' || (t === 'single' && hasCards)) {
      const picked = t === 'single' ? (sel.value === undefined ? [] : [sel.value]) : sel.picked;
      return `<div class="hc-grid" role="group" aria-label="候選卡片">${request.options.map(o => {
        const i = picked.findIndex(v => key(v) === key(o.value)), on = i >= 0;
        let badge = '';
        if (on && t === 'cards' && request.input.ordered) badge = `<span class="hc-badge">${i + 1}</span>`;
        else if (on && t === 'block') badge = `<span class="hc-badge${key(sel.center) === key(o.value) ? ' ctr' : ''}">${key(sel.center) === key(o.value) ? '中' : '側'}</span>`;
        else if (on) badge = '<span class="hc-badge">✓</span>';
        const c = o.card || { cardNo: '', name: o.label };
        return `<button type="button" class="hc-card${on ? ' on' : ''}" aria-pressed="${on}" data-hc-v="${esc(key(o.value))}">${c.cardNo ? cardImg(c) : ''}<span class="hc-nm">${esc(o.label)}</span>${badge}</button>`;
      }).join('')}</div>`;
    }
    return `<div class="hc-opts" role="group">${request.options.map(o => `<button type="button" class="hc-opt${t === 'number' ? ' num' : ''}${sel.value !== undefined && key(sel.value) === key(o.value) ? ' on' : ''}" aria-pressed="${sel.value !== undefined && key(sel.value) === key(o.value)}" data-hc-v="${esc(key(o.value))}">${esc(o.label)}</button>`).join('')}</div>`;
  }
  function chips() {
    if (t !== 'block' || !sel.picked.length) return '';
    return `<div class="hc-chips">${sel.picked.map(v => { const o = byKey.get(key(v)), ctr = key(sel.center) === key(v);
      return `<span class="hc-chip${ctr ? ' ctr' : ''}">${ctr ? '中攔' : '側攔'}・${esc(o.label)}${ctr ? '' : `<button type="button" data-hc-ctr="${esc(key(v))}">設為中攔</button>`}<button type="button" data-hc-rm="${esc(key(v))}" aria-label="移除">✕</button></span>`; }).join('')}</div>`;
  }
  function ctx() {
    const c = request.context || {}, out = [];
    if (c.ball) out.push(`來球：${esc({ serve: '發球', attack: '攻擊', block: '攔網回球' }[c.ball.type] || c.ball.type)} ${esc(c.ball.off)}`);
    if (c.revealed) out.push(`<span class="hc-rev">${cardImg(c.revealed)}</span><span>翻開：${esc(c.revealed.name || c.revealed.cardNo)}</span>`);
    if (c.dice) out.push(`擲骰 ${esc(c.dice[0])} : ${esc(c.dice[1])}`);
    return out.length ? `<div class="hc-ctx">${out.join('')}</div>` : '';
  }
  function draw() {
    const ok = t === 'ack' || H.canSubmit(request, sel), prog = H.progress(request, sel);
    const src = request.source ? `<button type="button" class="hc-card hc-src" data-hc-src="1" aria-label="查看 ${esc(request.source.name || request.source.cardNo)}">${cardImg(request.source)}</button>` : '';
    const loss = request.canLoss && opts.onLoss ? (lossArm
      ? `<button type="button" class="hc-loss" data-hc-act="lossyes">確定 Loss</button><button type="button" class="hc-quiet" data-hc-act="lossno">不要</button>`
      : `<button type="button" class="hc-loss" data-hc-act="loss">喊 Loss</button>`) : '';
    rootEl.innerHTML = `<div class="hc" data-kind="${esc(request.kind)}" data-input="${t}">
      <div class="hc-head">${src}<div class="hc-q">${esc(request.prompt)}${prog ? `<small class="hc-prog">${esc(prog)}</small>` : ''}</div></div>
      ${ctx()}${body()}${chips()}
      <div class="hc-err" role="alert">${esc(sel.error || '')}</div>
      <div class="hc-bar"><button type="button" class="hc-go" data-hc-act="go" ${ok ? '' : 'disabled'}>${GO_LABEL[t]}</button>${(t === 'cards' || t === 'block') && sel.picked.length ? '<button type="button" class="hc-quiet" data-hc-act="clear">清除</button>' : ''}${loss}</div></div>`;
  }
  function onClick(e) {
    if (done) return;
    const b = e.target.closest('button'); if (!b || !rootEl.contains(b)) return;
    const d = b.dataset;
    if (d.hcSrc) { opts.onCard && opts.onCard(request.source); return; }
    if (d.hcRm) { sel = H.toggle(request, sel, JSON.parse(d.hcRm)); return draw(); }
    if (d.hcCtr) { sel = H.setCenter(request, sel, JSON.parse(d.hcCtr)); return draw(); }
    if (d.hcV !== undefined) { sel = H.toggle(request, sel, JSON.parse(d.hcV)); return draw(); }
    switch (d.hcAct) {
      case 'clear': sel = H.createSelection(request); return draw();
      case 'loss': lossArm = true; return draw();
      case 'lossno': lossArm = false; return draw();
      case 'lossyes': done = true; opts.onLoss && opts.onLoss(); return;
      case 'go': {
        const ans = H.makeAnswer(request, H.selectionValue(request, sel)), v = H.validate(request, ans);
        if (!v.ok) { sel = { ...sel, error: v.error }; return draw(); }
        done = true; opts.onAnswer && opts.onAnswer(ans); return;
      }
    }
  }
  rootEl.addEventListener('click', onClick);
  draw();
  return { destroy() { rootEl.removeEventListener('click', onClick); rootEl.innerHTML = ''; }, get selection() { return sel; } };
}
const api = { render, CSS };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BreakChoiceUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
