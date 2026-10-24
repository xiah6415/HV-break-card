/* BREAK 通用選擇 UI（C）：依 break.host.v1 request 的 input 自動產生介面；所有回答先經 BreakHostChoice 驗證。
   用法：BreakChoiceUI.render(容器, request, { onAnswer(answer), onLoss(), imgSrc(cardNo), onCard(cardRef) }) → { destroy() }
   卡片以實體 ID 為 key，同卡號多張分開顯示；不改規則狀態。Claude 2026-10-21。 */
(function (root) {
'use strict';
const H = root.BreakHostChoice || (typeof require !== 'undefined' ? require('./host-choice') : null);
const CSS = `
.hc[data-kind]{display:grid;gap:10px;min-width:0;font:inherit;color:var(--ink,#122326)}
.hc[data-kind] *{box-sizing:border-box}
.hc-content{display:grid;gap:10px;min-width:0;min-height:0}
.hc-head{display:flex;gap:10px;align-items:flex-start;min-width:0}
.hc-head .hc-src{flex:0 0 44px;width:44px}
.hc-q{font-weight:700;font-size:15px;line-height:1.4;min-width:0;overflow-wrap:anywhere}
.hc-q small{display:block;font-weight:400;font-size:12px;color:var(--muted,#566b6e);margin-top:2px}
.hc-ctx{display:flex;gap:8px;align-items:center;font-size:12.5px;color:var(--muted,#566b6e);flex-wrap:wrap}
.hc-ctx .hc-rev{width:56px}
.hc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:8px;min-width:0}
.hc-item{min-width:0;display:grid;align-content:start;gap:4px}
.hc-info{font:inherit;font-size:11px;border:1px solid var(--line,#c3d3d2);border-radius:6px;background:transparent;color:inherit;min-height:28px;cursor:pointer}
.hc-card{position:relative;border:0;padding:0;background:none;cursor:pointer;display:grid;gap:3px;min-width:0;text-align:center;color:inherit;font:inherit;border-radius:7px}
.hc-card img,.hc-src img,.hc-rev img{display:block;width:100%;aspect-ratio:300/419;object-fit:cover;border-radius:6px;background:var(--sunk,#d9e4e3)}
.hc-card span.hc-nm{font-size:11px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hc[data-kind="trigger_order"] .hc-nm{white-space:normal;overflow:visible;overflow-wrap:anywhere}
.hc-zone{font-size:10px;color:var(--muted,#566b6e)}
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
.hc-timing{font-size:13px;font-weight:700;color:var(--ev,#8a5900)}
.hc-timing.ready{color:#936000}
.hc-ready img{outline:3px solid #e4ac20;outline-offset:1px;box-shadow:0 0 12px #e4ac2080}
@keyframes hc-pulse{50%{box-shadow:0 0 20px #e4ac20bb}}
@media (prefers-reduced-motion:no-preference){.hc-ready img{animation:hc-pulse 1.6s ease-in-out infinite}}
@media (prefers-reduced-motion:no-preference){.hc-card img{transition:box-shadow .12s}}`;
function ensureCss(doc) {
  if (doc.getElementById('hc-style')) return;
  const s = doc.createElement('style'); s.id = 'hc-style'; s.textContent = CSS; doc.head.appendChild(s);
}
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const key = v => JSON.stringify(v);
const GO_LABEL = { ack: '確認', block: '確認攔網', cards: '確認', single: '確認', number: '確認' };

// Presentation only: the core still determines candidates, affordability and effects.
const zoneNames={hand:'手牌',deck:'牌庫',deck_top:'牌庫頂',deck_bottom:'牌庫底',drop:'棄牌區',event:'Event區',serve:'發球區',block:'攔網區',receive:'接球區',toss:'舉球區',attack:'攻擊區',court:'球場','side:0':'側攔區','side:1':'側攔區'};
function zoneText(zone){const parts=String(zone||'').split('.');return parts.at(-1)==='guts'?(zoneNames[parts.at(-2)]||'指定區域')+' Guts':zoneNames[parts.at(-1)]||'指定區域';}
function describePayment(node){
 if(!node||typeof node!=='object')return '';
 if(node.kind==='sequence')return (node.steps||[]).map(describePayment).filter(Boolean).join('；再');
 const count=Number.isInteger(node.count)?String(node.count):'指定數量',quantity=node.count_mode==='upto'?'至多 '+count:count;
 switch(node.kind){
  case 'pay_guts':return (node.areas==='source_area'?'從此卡所在區域':node.areas==='court'?'從球場':Array.isArray(node.areas)?'從'+node.areas.map(zoneText).join('、'):'')+'支付 '+(node.count_mode==='one_of_exact'?'可選數量的':quantity+' 張')+' Guts';
  case 'move_self':return node.destination==='owner.drop'?'將此卡送到棄牌區':'將此卡放到'+zoneText(node.destination);
  case 'move':return '從'+zoneText(node.pool?.zone)+'選'+(node.count_mode==='all'?'全部':quantity+' 張')+'符合條件的牌，放到'+zoneText(node.destination);
  case 'mill':return '將牌庫頂'+quantity+' 張送到棄牌區';
  case 'cover_source_with_guts':return '從'+zoneText(node.pool?.zone)+'選'+quantity+' 張符合條件的牌，覆蓋此卡';
  case 'external_action':return node.action==='coin'?'擲 1 次硬幣':node.action==='tilt_card'?'傾斜此卡':'完成卡上指定的口號／動作';
  default:return '支付卡上指定的費用';
 }
}
const quantityActions={draw_count:['抽牌','不抽牌'],move_count:['移動／回收卡片','不移動卡片'],mill_count:['將牌庫頂的牌送到棄牌區','不送出牌庫的牌'],payment_count:['支付費用','不支付此項費用'],entry_count:['讓角色登場','不讓角色登場'],target_count:['選擇效果對象','不選擇對象']};
function requestPrompt(request){
 // Preserve card-specific instructions and ordering supplied by the core.
 if(request.prompt&&request.prompt!=='請選擇合法選項')return request.prompt;
 if(request.context?.selectionAction==='exchange')return '是否交換兩側各1張？';
 const action=quantityActions[request.kind];
 if(action)return request.kind==='target_count'?'選擇本次效果的對象數量':'選擇本次'+action[0]+'的張數';
 if(request.kind==='guts_destination')return '選擇 Guts 放置區域';
 return request.prompt||'請選擇合法選項';
}
function optionLabel(request,option){
 if(request.context?.selectionAction==='exchange'&&request.kind==='move_count')return option.value===0?'不交換':option.value===1?'交換兩側各1張':option.label;
 if(quantityActions[request.kind]&&Number.isInteger(option.value)&&option.label===String(option.value)){
  const unit=request.kind==='target_count'?' 個對象':' 張',zero=quantityActions[request.kind][1];
  return option.value+unit+(option.value===0?'（'+zero+'）':'');
 }
 if(request.kind==='guts_destination'&&zoneNames[option.value])return zoneText(option.value);
 return option.label;
}
function requestDetail(request){
 if(request.kind==='activate_payment')return describePayment(request.context?.payment);
 if(quantityActions[request.kind]&&request.context?.selectionAction!=='exchange')return '請從目前提供的數量中選擇，再按確認；下一步依此數量結算。';
 if(['move_cards','payment_cards','entry'].includes(request.kind)&&request.context?.destination)return '目的地：'+zoneText(request.context.destination);
 return '';
}

function timingHint(request){
 const c=request.context||{};
 if(['receiver','setter','attacker','serve'].includes(request.kind)&&c.entrySkillIds?.length)return {label:'登場技能可觸發',active:true,candidates:true,ids:c.entrySkillIds};
 if(request.kind==='event'&&request.options.some(o=>o.card))return {label:'卡片／技能可使用',active:true,candidates:true};
 if(request.kind==='activate_payment'&&request.options.some(o=>o.value===true))return c.ineffectiveReason?{label:'效果可能無效，請確認費用',active:false}:{label:'技能可發動',active:true};
 if(request.kind==='optional'&&request.options.some(o=>o.value===true))return {label:'可選效果',active:true};
 if(request.kind==='trigger_order')return {label:'觸發效果待結算',active:true,candidates:true};
 return null;
}
function render(rootEl, request, opts = {}) {
  const doc = rootEl.ownerDocument; ensureCss(doc);
  const chk = H.checkRequest(request);
  if (!chk.ok) { rootEl.innerHTML = `<div class="hc"><p class="hc-err" role="alert">無法顯示這個選擇：${esc(chk.error)}</p></div>`; return { destroy() { rootEl.innerHTML = ''; } }; }
  const timing=timingHint(request);
  const t = request.input.type, imgSrc = opts.imgSrc || (() => ''), cardImg = c => `<img src="${esc(imgSrc(c.cardNo))}" alt="${esc(c.name || c.cardNo)}" loading="lazy" draggable="false">`;
  let sel = H.restoreSelection(request, opts.selection), lossArm = false, done = false;
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
        const parts=String(c.zone||'').split('.'),zone=parts.length===2?parts[1]:parts[0],labels={hand:'手牌',deck:'牌庫',drop:'棄牌',event:'Event',serve:'發球',block:'中攔',receive:'接球',toss:'舉球',attack:'攻擊','side:0':'側攔','side:1':'側攔'};
        const location=labels[zone]?(parts.length===2?(+parts[0]===request.actor?'我方 ':'對方 '):'')+labels[zone]:'';
        return `<div class="hc-item"><button type="button" class="hc-card${timing?.active&&timing.candidates&&o.card&&(!timing.ids||timing.ids.includes(o.value))?' hc-ready':''}${on ? ' on' : ''}" aria-pressed="${on}" data-hc-v="${esc(key(o.value))}">${c.cardNo ? cardImg(c) : ''}<span class="hc-nm">${esc(o.label)}</span>${location?`<small class="hc-zone">${esc(location)}</small>`:''}${badge}</button>${o.card&&opts.onCard?`<button type="button" class="hc-info" data-hc-info="${esc(o.id)}" aria-label="查看 ${esc(o.label)} 卡片">查卡</button>`:''}</div>`;
      }).join('')}</div>`;
    }
    return `<div class="hc-opts" role="group">${request.options.map(o => `<button type="button" class="hc-opt${t === 'number' ? ' num' : ''}${sel.value !== undefined && key(sel.value) === key(o.value) ? ' on' : ''}" aria-pressed="${sel.value !== undefined && key(sel.value) === key(o.value)}" data-hc-v="${esc(key(o.value))}">${esc(optionLabel(request,o))}</button>`).join('')}</div>`;
  }
  function chips() {
    if (t !== 'block' || !sel.picked.length) return '';
    return `<div class="hc-chips">${sel.picked.map(v => { const o = byKey.get(key(v)), ctr = key(sel.center) === key(v);
      return `<span class="hc-chip${ctr ? ' ctr' : ''}">${ctr ? '中攔' : '側攔'}・${esc(o.label)}${ctr ? '' : `<button type="button" data-hc-ctr="${esc(key(v))}">設為中攔</button>`}<button type="button" data-hc-rm="${esc(key(v))}" aria-label="移除">✕</button></span>`; }).join('')}</div>`;
  }
  function ctx() {
    const c = request.context || {}, out = [], detail=requestDetail(request);
    if(detail)out.push(`<span class="hc-detail">${esc(detail)}</span>`);
    if (c.ball) { const kind=c.ball.kind || c.ball.type, value=c.ball.offense ?? c.ball.off; out.push(`來球：${esc({ serve: '發球', attack: '攻擊', block: '攔網回球' }[kind] || kind)} ${esc(value)}`); }
    if (c.revealed) out.push(`<span class="hc-rev">${cardImg(c.revealed)}</span><span>翻開：${esc(c.revealed.name || c.revealed.cardNo)}</span>`);
    if (c.dice) out.push(`擲骰 ${esc(c.dice[0])} : ${esc(c.dice[1])}`);
    return out.length ? `<div class="hc-ctx">${out.join('')}</div>` : '';
  }
  function draw() {
    const scrollTop=rootEl.querySelector('.hc-content')?.scrollTop||0;
    const ok = t === 'ack' || H.canSubmit(request, sel), prog = H.progress(request, sel);
    const src = request.source ? `<button type="button" class="hc-card hc-src${timing?.active?' hc-ready':''}" data-hc-src="1" aria-label="查看 ${esc(request.source.name || request.source.cardNo)}">${cardImg(request.source)}</button>` : '';
    const loss = request.canLoss && opts.onLoss ? (lossArm
      ? `<button type="button" class="hc-loss" data-hc-act="lossyes">確定 Loss</button><button type="button" class="hc-quiet" data-hc-act="lossno">不要</button>`
      : `<button type="button" class="hc-loss" data-hc-act="loss">喊 Loss</button>`) : '';
    rootEl.innerHTML = `<div class="hc" data-kind="${esc(request.kind)}" data-input="${t}">
      <div class="hc-content"><div class="hc-head">${src}<div class="hc-q">${esc(requestPrompt(request))}${prog ? `<small class="hc-prog">${esc(prog)}</small>` : ''}</div></div>
      ${timing?`<div class="hc-timing${timing.active?' ready':''}" role="status">✦ ${esc(timing.label)}</div>`:''}${ctx()}${body()}${chips()}
      <div class="hc-err" role="alert">${esc(sel.error || '')}</div></div>
      <div class="hc-bar"><button type="button" class="hc-go" data-hc-act="go" ${ok ? '' : 'disabled'}>${esc(opts.goLabel || GO_LABEL[t])}</button>${(t === 'cards' || t === 'block') && sel.picked.length ? '<button type="button" class="hc-quiet" data-hc-act="clear">清除</button>' : ''}${loss}</div></div>`;
    rootEl.querySelector('.hc-content').scrollTop=scrollTop;
  }
  function choose(value) { if (done) return; sel = H.toggle(request, sel, value); draw(); opts.onSelection && opts.onSelection(sel); }
  function onClick(e) {
    if (done) return;
    const b = e.target.closest('button'); if (!b || !rootEl.contains(b)) return;
    const d = b.dataset;
    if (d.hcInfo) { const o=request.options.find(o=>o.id===d.hcInfo); if(o?.card)opts.onCard?.(o.card);return; }
    if (d.hcSrc) { opts.onCard && opts.onCard(request.source); return; }
    if (d.hcRm) { sel = H.toggle(request, sel, JSON.parse(d.hcRm)); draw(); opts.onSelection && opts.onSelection(sel); return; }
    if (d.hcCtr) { sel = H.setCenter(request, sel, JSON.parse(d.hcCtr)); draw();opts.onSelection?.(sel);return; }
    if (d.hcV !== undefined) return choose(JSON.parse(d.hcV));
    switch (d.hcAct) {
      case 'clear': sel = H.createSelection(request); draw(); opts.onSelection && opts.onSelection(sel); return;
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
  return { destroy() { rootEl.removeEventListener('click', onClick); rootEl.innerHTML = ''; }, select: choose, get selection() { return sel; } };
}
const api = { render, CSS, describePayment, requestDetail, requestPrompt, optionLabel, timingHint };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BreakChoiceUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
