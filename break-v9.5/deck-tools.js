/* BREAK v9: deck input/validation. UMD, pinned library admission. */
(function(root) {
'use strict';
// lz-string 1.5.0 (MIT, (c) 2013 pieroxy), license: library/LZ-STRING-LICENSE.txt.
// Local change: bound decoded output to 64 KiB before dictionary growth.
const LZString = (function () { var LZString=function(){var r=String.fromCharCode,o="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",n="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$",e={};function t(r,o){if(!e[r]){e[r]={};for(var n=0;n<r.length;n++)e[r][r.charAt(n)]=n}return e[r][o]}var i={compressToBase64:function(r){if(null==r)return"";var n=i._compress(r,6,function(r){return o.charAt(r)});switch(n.length%4){default:case 0:return n;case 1:return n+"===";case 2:return n+"==";case 3:return n+"="}},decompressFromBase64:function(r){return null==r?"":""==r?null:i._decompress(r.length,32,function(n){return t(o,r.charAt(n))})},compressToUTF16:function(o){return null==o?"":i._compress(o,15,function(o){return r(o+32)})+" "},decompressFromUTF16:function(r){return null==r?"":""==r?null:i._decompress(r.length,16384,function(o){return r.charCodeAt(o)-32})},compressToUint8Array:function(r){for(var o=i.compress(r),n=new Uint8Array(2*o.length),e=0,t=o.length;e<t;e++){var s=o.charCodeAt(e);n[2*e]=s>>>8,n[2*e+1]=s%256}return n},decompressFromUint8Array:function(o){if(null==o)return i.decompress(o);for(var n=new Array(o.length/2),e=0,t=n.length;e<t;e++)n[e]=256*o[2*e]+o[2*e+1];var s=[];return n.forEach(function(o){s.push(r(o))}),i.decompress(s.join(""))},compressToEncodedURIComponent:function(r){return null==r?"":i._compress(r,6,function(r){return n.charAt(r)})},decompressFromEncodedURIComponent:function(r){return null==r?"":""==r?null:(r=r.replace(/ /g,"+"),i._decompress(r.length,32,function(o){return t(n,r.charAt(o))}))},compress:function(o){return i._compress(o,16,function(o){return r(o)})},_compress:function(r,o,n){if(null==r)return"";var e,t,i,s={},u={},a="",p="",c="",l=2,f=3,h=2,d=[],m=0,v=0;for(i=0;i<r.length;i+=1)if(a=r.charAt(i),Object.prototype.hasOwnProperty.call(s,a)||(s[a]=f++,u[a]=!0),p=c+a,Object.prototype.hasOwnProperty.call(s,p))c=p;else{if(Object.prototype.hasOwnProperty.call(u,c)){if(c.charCodeAt(0)<256){for(e=0;e<h;e++)m<<=1,v==o-1?(v=0,d.push(n(m)),m=0):v++;for(t=c.charCodeAt(0),e=0;e<8;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}else{for(t=1,e=0;e<h;e++)m=m<<1|t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t=0;for(t=c.charCodeAt(0),e=0;e<16;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}0==--l&&(l=Math.pow(2,h),h++),delete u[c]}else for(t=s[c],e=0;e<h;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;0==--l&&(l=Math.pow(2,h),h++),s[p]=f++,c=String(a)}if(""!==c){if(Object.prototype.hasOwnProperty.call(u,c)){if(c.charCodeAt(0)<256){for(e=0;e<h;e++)m<<=1,v==o-1?(v=0,d.push(n(m)),m=0):v++;for(t=c.charCodeAt(0),e=0;e<8;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}else{for(t=1,e=0;e<h;e++)m=m<<1|t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t=0;for(t=c.charCodeAt(0),e=0;e<16;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}0==--l&&(l=Math.pow(2,h),h++),delete u[c]}else for(t=s[c],e=0;e<h;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;0==--l&&(l=Math.pow(2,h),h++)}for(t=2,e=0;e<h;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;for(;;){if(m<<=1,v==o-1){d.push(n(m));break}v++}return d.join("")},decompress:function(r){return null==r?"":""==r?null:i._decompress(r.length,32768,function(o){return r.charCodeAt(o)})},_decompress:function(o,n,e){var t,i,s,u,a,p,c,l=[],f=4,h=4,d=3,m="",v=[],outputSize=1,g={val:e(0),position:n,index:1};for(t=0;t<3;t+=1)l[t]=t;for(s=0,a=Math.pow(2,2),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;switch(s){case 0:for(s=0,a=Math.pow(2,8),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;c=r(s);break;case 1:for(s=0,a=Math.pow(2,16),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;c=r(s);break;case 2:return""}for(l[3]=c,i=c,v.push(c);;){if(g.index>o)return"";for(s=0,a=Math.pow(2,d),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;switch(c=s){case 0:for(s=0,a=Math.pow(2,8),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;l[h++]=r(s),c=h-1,f--;break;case 1:for(s=0,a=Math.pow(2,16),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;l[h++]=r(s),c=h-1,f--;break;case 2:return v.join("")}if(0==f&&(f=Math.pow(2,d),d++),l[c])m=l[c];else{if(c!==h)return null;m=i+i.charAt(0)}if((outputSize+=m.length)>65536)throw Error("分享資料解壓後過大");v.push(m),l[h++]=i+m.charAt(0),i=m,0==--f&&(f=Math.pow(2,d),d++)}}};return i}(); return LZString; })();
const library = typeof module !== 'undefined' && module.exports ? require('./card-library') : root.BreakCardLibrary;
function normalCode(s) { return library.code(s) || library.normal(s); }
function parseDeck(source, defs) {
  const input = typeof source === 'string' ? JSON.parse(source) : source;
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('牌組格式必須是物件');
  let pairs;
  if (Array.isArray(input.c)) pairs = input.c;
  else if (input.cards && typeof input.cards === 'object' && !Array.isArray(input.cards)) pairs = Object.entries(input.cards);
  else throw Error('找不到 c 或 cards 牌組清單');
  const cards = Object.create(null);
  for (const item of pairs) {
    if (!Array.isArray(item) || item.length !== 2) throw Error('每筆卡片須為 [卡號, 張數]');
    const code = normalCode(item[0]), count = item[1];
    library.requirePlayable(code);
    if (!Object.prototype.hasOwnProperty.call(defs, code)) throw Error('尚未收錄卡片：' + code);
    if (!Number.isSafeInteger(count) || count < 1 || count > 40) throw Error('張數無效：' + code);
    cards[code] = (cards[code] || 0) + count;
  }
  let total = 0, events = 0;
  for (const [code, n] of Object.entries(cards)) {
    total += n;
    if (defs[code][1] === 'E') events += n;
  }
  if (total !== 40) throw Error('牌組必須 40 張，目前 ' + total + ' 張');
  if (events > 8) throw Error('Event 最多 8 張，目前 ' + events + ' 張');
  return { name: String(input.n || input.name || '自訂牌組').slice(0, 60), cards: {...cards} };
}
// ---------- 查卡網站（weilun2022/haikyu-cards）分享連結
function shareCode(text) {
  const raw = String(text == null ? '' : text).trim();
  if (!raw) throw Error('請貼上分享連結');
  if (raw.length > 32768) throw Error('分享連結過長');
  const m = raw.match(/[?&#]deck=([^&#\n]+)/);
  let code = (m ? m[1] : raw).trim();
  if (!m && /^https?:\/\//i.test(raw)) throw Error('這個網址沒有 ?deck= 牌組資料');
  if (/%[0-9A-Fa-f]{2}/.test(code)) { try { code = decodeURIComponent(code); } catch (e) { /* 保留原樣 */ } }
  code = code.replace(/ /g, '+');
  if (!/^[A-Za-z0-9+\-$]+$/.test(code)) throw Error('分享碼含有不合法字元，請確認是完整的分享連結');
  return code;
}
function decodeShare(text) {
  const code = shareCode(text);
  let json = null;
  try { json = LZString.decompressFromEncodedURIComponent(code); } catch (e) { json = null; }
  if (!json) throw Error('分享連結解碼失敗，可能沒有複製完整');
  let payload;
  try { payload = JSON.parse(json); } catch (e) { throw Error('分享連結內容不是牌組資料'); }
  if (!payload || !Array.isArray(payload.c)) throw Error('分享連結內容不是牌組資料');
  return { n: typeof payload.n === 'string' ? payload.n : '分享牌組', c: payload.c };
}
function encodeShare(deck) { return LZString.compressToEncodedURIComponent(JSON.stringify({ n: deck.name, c: Object.entries(deck.cards) })); }
// 一次列出所有問題（parseDeck 遇到第一個錯誤就停）；不放寬任何開放權限
function inspectDeck(source, defs) {
  const input = typeof source === 'string' ? JSON.parse(source) : source;
  const res = { name: String((input && (input.n || input.name)) || '自訂牌組').slice(0, 60), cards: Object.create(null), total: 0, events: 0, unknown: [], locked: [], invalid: [], problems: [], ok: false };
  const pairs = Array.isArray(input && input.c) ? input.c : input && input.cards && typeof input.cards === 'object' ? Object.entries(input.cards) : null;
  if (!pairs) { res.problems.push('找不到牌組清單'); return res; }
  const locked = Object.create(null);
  for (const item of pairs) {
    if (!Array.isArray(item) || item.length !== 2) { res.invalid.push(String(item)); continue; }
    const [id, count] = item;
    if (!Number.isSafeInteger(count) || count < 1 || count > 40) { res.invalid.push(String(id)); continue; }
    if (typeof id !== 'string') { res.invalid.push('卡號必須是文字'); continue; }
    const code = normalCode(id), meta = code && library.card(code);
    res.total += count;
    if (!meta) { res.unknown.push({ id: String(id), count }); continue; }
    if (meta.kind === 'E') res.events += count;
    if (!meta.playable) { const l = locked[meta.code] || (locked[meta.code] = { code: meta.code, name: meta.name, count: 0 }); l.count += count; continue; }
    if (!Object.prototype.hasOwnProperty.call(defs, meta.code)) { res.unknown.push({ id: String(id), count }); continue; }
    res.cards[meta.code] = (res.cards[meta.code] || 0) + count;
  }
  res.locked = Object.values(locked);
  if (res.unknown.length) res.problems.push('尚未收錄的卡：' + res.unknown.map(u => `${u.id}×${u.count}`).join('、'));
  if (res.locked.length) res.problems.push(`尚未開放對戰的技能卡 ${res.locked.reduce((t, l) => t + l.count, 0)} 張：` + res.locked.map(l => `${l.name}（${l.code}）×${l.count}`).join('、'));
  if (res.invalid.length) res.problems.push('張數或格式無效：' + res.invalid.join('、'));
  if (res.total !== 40) res.problems.push(`牌組必須 40 張，目前 ${res.total} 張`);
  if (res.events > 8) res.problems.push(`Event 最多 8 張，目前 ${res.events} 張`);
  res.ok = !res.problems.length;
  res.cards = { ...res.cards };
  return res;
}
function parseShare(text, defs) { return parseDeck(decodeShare(text), defs); }
function exportDeck(deck) { return JSON.stringify({ n: deck.name, c: Object.entries(deck.cards) }, null, 2); }
const api = { normalCode, parseDeck, exportDeck, shareCode, decodeShare, encodeShare, inspectDeck, parseShare, LZString };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.BreakDeckTools = api;
})(typeof window !== 'undefined' ? window : globalThis);
