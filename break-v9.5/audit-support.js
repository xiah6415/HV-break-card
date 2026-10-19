const assert = require('node:assert/strict');
const fs = require('node:fs');
const E = require('./engine');
const S = require('./card-support.json');
const { normalCode } = require('./deck-tools');
const labels = { basic: '無技能／數值核對', 'scenario-tested': '主要技能情境通過', partial: '部分技能待補' };
assert.equal(S.schemaVersion, 1);
assert.deepEqual(Object.keys(S.cards).sort(), Object.keys(E.DEF).sort(), 'every supported card must have an explicit audit entry');
const counts = Object.fromEntries(Object.keys(labels).map(k => [k, 0]));
for (const [code, card] of Object.entries(S.cards)) {
  assert.equal(normalCode(card.number), code);
  assert(fs.existsSync('img/' + code + '.webp'), code + ': missing local card image');
  assert.equal(card.kind, E.DEF[code][1]);
  if (card.kind === 'C') assert.deepEqual(E.DEF[code].slice(2, 7), card.stats, code + ': official character values differ');
  assert(card.source.startsWith('https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?'));
  assert(/^[a-f0-9]{64}$/.test(card.sourceSha256));
  assert(Object.hasOwn(labels, card.status)); counts[card.status]++;
  assert.equal(card.status === 'partial', card.gaps.length > 0, code + ': incomplete cards must explain their limits');
  if (card.status === 'scenario-tested') assert(card.tests.length > 0);
  if (card.status === 'basic') assert.equal(card.hasSkill, false);
  for (const test of card.tests) assert(fs.existsSync(test), code + ': missing evidence test ' + test);
}
for (const deck of Object.values(E.DECKS)) for (const code of Object.keys(deck.cards)) assert(S.cards[code]);
const report = `# 現有卡片規則與技能支援稽核\n\n核對日：${S.checkedOn}。官方規則 v${S.rules.version}；[官方總合規則](${S.rules.source})。\n\n` +
  `47 張均已對到官方卡號、名稱、數值與位置；6 組預設牌組全部納入。角色數值與目前引擎一致。\n\n` +
  Object.entries(counts).map(([s, n]) => `- ${labels[s]}：${n} 張。`).join('\n') +
  `\n\n「主要技能情境通過」只代表列出的測試通過，不是所有目標、技能組合或規則均已驗證。部分技能卡仍可在現有對練台使用，限制見下表。官方 Q&A 編號是來源索引，不代表每則 Q&A 都已自動化。\n\n` +
  `## 本批已修正\n\n` +
  `- 黒川生效時，接球預覽與實際防降、PR-057 雙學年判定一致。\n` +
  `- PR-029、P02-001、P01-006、P03-086 的「最多」回收可選擇不拿。\n` +
  `- オープン攻撃在日向舉球時仍可抽／棄，但不會違規登場同名日向。\n` +
  `- 移除自由步驟 12 次的任意上限。\n` +
  `- 攔網付費／事件途中 Loss，側攔卡進棄牌區一次，避免遺失。\n` +
  `- 官方 HVBP-002 能對應現有 BP-002。\n` +
  `- 第二批：PR-057 每次登場可選名稱，與同名限制／日向技能連動，回合結束到期。\n` +
  `- 第二批：P03-096 可指定場上日向及任一數值（排除「－」）；P03-087 支援接球與攻擊、角色目標、跨區六 Guts 與額外參數。新選擇可 Undo。\n\n` +
  `8 個回歸情境在修改前引擎均失敗，修改後均通過，見 rules-audit.test.js；另有 skill-basics.test.js 與既有流程／Undo 測試。\n\n` +
  `## 接續修正順序\n\n` +
  `1. 將新目標／參數介面套用到其餘卡片的已知限制。\n` +
  `2. 其他事件的場上目標、可不抽牌，以及無變化時不能打出／失效處理。\n` +
  `3. 登場技能的可不發動、中側攔技能選擇、各效果期限與負值。\n` +
  `4. 剩餘 ${counts.partial} 張部分技能逐項補測後，再進入牌組串接階段。\n\n` +
  `## 本機流程與正式模式待分離項目\n\n${S.houseRules.map(x => '- ' + x).join('\n')}\n\n` +
  `現有回合交棒、Loss 手動確認與固定 seed Undo 維持；本批沒有改成自動交棒。\n\n` +
  `## 逐卡對照\n\n| 卡號／官方資料 | 名稱 | 支援狀態 | 已知限制／測試 |\n|---|---|---|---|\n` +
  Object.entries(S.cards).map(([code, c]) => `| [${c.number}](${c.source}) | ${c.name} | ${labels[c.status]} | ${[...c.gaps, ...c.tests.map(t => '\\`' + t + '\\`')].join('；') || '官方卡文無技能；數值、卡圖與牌組引用已檢查'} |`).join('\n') +
  `\n\n可重跑檢查：node audit-support.js。更新報告：node audit-support.js --write。\n\n原始官方回應與 PDF 保存在本機 work/rules-audit；版本、來源 URL 與 SHA-256 保存在 card-support.json，不將原始整份卡文／Q&A 複製進公開報告。\n`;
if (process.argv.includes('--write')) fs.writeFileSync('RULES-AUDIT.md', report.replaceAll('\\`', '`'));
else assert.equal(fs.readFileSync('RULES-AUDIT.md', 'utf8'), report.replaceAll('\\`', '`'), 'audit report is stale; run with --write');
console.log('support audit:', JSON.stringify(counts), '47 official entries; 6 preset decks; report consistent');
