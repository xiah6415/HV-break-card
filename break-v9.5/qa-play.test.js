'use strict';
// 回歸：entryPreview 的預演選擇必須依 request 型態回答（單值 vs 陣列）。
// 2026-10-22 Claude 巡檢：手牌有改名卡（黒尾・山本）或預演觸發需選參數的監聽時，接球／登場預覽丟出
// "Invalid entry name" / "Invalid parameter" 讓整局中斷。以下兩組在修正前必定失敗。
const { execFileSync } = require('node:child_process');
for (const [deck, vs] of [['音駒', '稲荷崎'], ['青葉城西', '烏野']]) {
  const out = execFileSync(process.execPath, ['qa-play.js', '1', deck, vs], { cwd: __dirname, encoding: 'utf8' });
  const j = JSON.parse(out.slice(0, out.lastIndexOf('kinds')));
  const ex = Object.keys(j.groups).filter(k => k.startsWith('exception'));
  if (ex.length) throw new Error(deck + ' vs ' + vs + ': ' + ex.join(', '));
}
console.log('qa-play regression: entry preview answers by request shape (2 decks) passed');
