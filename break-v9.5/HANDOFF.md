# BREAK 對練台 — 交接文件（Claude → Codex，2026-10-19）

> 最新狀態：使用者指定 1→2→6→7→3→4，目前在第 1 階段。首批完成 47 張官方資料對照與 8 個回歸修正，仍有 19 張部分技能待補。最新範圍見 RULES-AUDIT.md、card-support.json，工作順序見 ROADMAP.md。下列 Artifact、49 張及卡庫總數是歷史描述，不作目前完成度依據。

> 先讀這份，再讀 `memory.md`（完整版本歷史）。每次動工前後都要在 `memory.md` 追加紀錄（Xiah 的規定：先寫計畫再改程式，完成後寫結果），讓 Claude／Codex 雙方都看得懂做到哪。

## 1. 這是什麼
- 「ハイキュー!! バボカ!! BREAK」TCG 的**人機對戰網頁**：Xiah（玩家）vs 規則式 AI。
- 純前端單一 HTML（`index.html`），手機／桌機都能玩；AI **不用 LLM**（啟發式，0 token）。
- 目前發布為 Claude Artifact（私人連結，只有 Xiah 能開，Codex 無法發布到那裡）。Codex 端可直接用瀏覽器開 `index.html`，或改放 GitHub Pages。
- 卡片資料來源：<https://weilun2022.github.io/haikyu-cards>（repo `weilun2022/haikyu-cards`，`cards_data.js` 含技能日文原文／中譯／官方 Q&A，`images/*.webp` 卡圖）。

## 2. 檔案
```
haikyu-web/
  engine.js     規則引擎＋AI（Node 可直接 require，瀏覽器掛在 window.BreakEngine）
  ui.html       UI 模板（含 /*IMAGES*/、/*ENGINE*/ 兩個佔位）
  build.py      把 img/*.webp 轉 base64 + engine.js 填進 ui.html → index.html
  index.html    建置產物（≈1.8MB，不要手改）
  img/          47 張卡圖 300×419 webp，檔名 = 卡號去掉 "HV-"（例：P01-002.webp）
  test.js       AI vs AI 勝率（node test.js 1000）
  fuzz.js       3000 局隨機決策＋卡片守恆（每方 40 張）檢查
  e2e.js        Playwright 桌機/手機實打（路徑寫死 /opt/npm-tools/node_modules/playwright，換環境要改）
  memory.md     版本歷史 v1–v8 與規則核對紀錄
  *_bak.*       各版備份，可刪
haikyu-sim/
  sim2.py       Python 大量模擬器（牌組勝率分析用，與 engine.js 規則同步到 v3）
  memory.md     牌組分析結論（1010/1014/1014c/快攻版 vs 青城/音駒…）
  p04_cards.md  第四彈代卡辨識筆記
```
建置與測試：
```bash
python3 build.py                # 產生 index.html
node test.js 500 && node fuzz.js
node e2e.js                     # 需 playwright + chromium
```

## 3. 已確認的規則（官方 rules_sheet_v1.pdf 逐項核對）
- 40 張、Event ≤ 8、同名張數無上限。
- 準備：**擲骰決定發球權** → 抽 6 → 調度 1 次（任選張數放回洗勻、抽回同數）→ 2 張セットカード → 發球方開始。
- 回合：發球回合（只發球）／防守回合開頭選「攔網 or 接球」（發球與攔網回球**不能**選攔網）。
  - 接球回合：抽 1 → 接球 → 舉球 → 攻擊。舉球不可與接球同名；攻擊不可與舉球同名。進攻 = 舉球 + 攻擊。
  - 攔網回合：不抽牌；中攔 1 + 側攔 ≤2、不可同名、合計 ≥ 進攻即成功 → 回球 0；側攔在階段結束進棄牌區。
- 各階段：登場 → フリーステップ（Event／手牌技能，張數不限）→ 判定。
- 數值「－」不能登場該區；期間未指定的效果在エンドフェイズ消失。
- 同區疊放 → 下面變 Guts，**場上牌跨 set 保留**。付 Guts：**區內除最上面角色外任選**（v8 修正；AI 從最下面付）。
- インターバル：①雙方補到 6 ②失分方拿 1 張セットカード入手（拿不到即敗）③得分方發球。
- 玩家可在自己回合**主動 Loss**（已登場的牌留場上，可藉此濾牌）。

## 4. engine.js 架構
- `DEF[code] = [name, kind('C'|'E'), srv, blk, rcv, tos, atk, value, school, year, text]`；`code` 不含 `HV-`。
- `DECKS`：k1014、k1014c、quick、k1010、seijoh（第四彈青城）、hk_axis。`validateDecks()` 檢查 40 張／Event ≤8。
- `Game`：`run()` → `serveTurn` / `defendTurn` → `blockTurn` / `receiveTurn` → `enterAttack`、`eventLoop` / `playable` / `resolve`。
- 決策介面（async）：`agent.choose(game, player, req)`，`req = { kind, prompt, options:[{label,value,card?}], multi?, ctx?, canLoss? ... }`。
  - kind：roll, mulligan(multi, role), serve, defend, block(build:{cands,max}), ack(抽牌), receiver, setter, attacker, skill(是否發動), event(timing), discard, cost, retrieve, summon, guts(multi, need, area)。
  - 人類 agent 設 `wantsAck: true` 才會收到 ack / roll / guts 的提問。
  - 回傳 `{__loss:true}` 且 `req.canLoss` 時 → `LostSignal`（主動 Loss）。
  - block 人類回傳 `{cards, center}`，引擎用 `evalBlock()` 驗證；AI 回傳 combos 索引。
- 卡片技能目前是**逐卡 if 寫死**（約 30 張有實作），分散在 serveTurn/receiveTurn/enterAttack/playable/resolve。
- `AI` 物件：每種 kind 的啟發式（接得住且接完能舉攻的最便宜接球手、舉球分數、攻擊預估、Event 時機…）。
- `pay(p, area, n)` 為 async；`draw(p,n,why)` 紀錄抽到什麼（reveal=0 只對玩家顯示卡名）。

## 5. UI（ui.html 內聯 script）重點
- 牌桌：對手（資訊→小格→主列）／網子（來球數值）／我方（主列→小格→資訊→手牌）；主列 = 接球/舉球/攻擊大卡；小格 = 發球/攔網/Event/棄牌。
- 出牌兩段式：點或拖手牌 → 預放（半透明＋預估：接得起與否、接完能否舉攻、進攻合計）→ 確認／取消。
- 自組攔網、抽牌按鈕、技能提示顯示卡圖與原文、Guts 自選、擲骰畫面、調度檢查清單、喊 Loss（二次確認）。
- 手機：整頁不可橫向捲動（`.game` 單欄 minmax(0,1fr)、`overflow-x: clip`）；手牌 ≤6 張一列、>6 兩列。
- Artifact 的 CSP 擋外部圖片 → 卡圖必須內嵌或與頁面同源。

## 6. 下一步（Xiah 已同意的方向，尚未開工）
目標：**接上卡片資料庫的組牌功能，且全部卡都有效果與卡圖**。資料庫 541 種卡（358 張有技能），目前只定義 49 張、約 30 張技能已實作。

1. **匯入＋全卡圖＋全數值**（約 1–1.5 輪）
   - 資料庫的分享連結：`…/haikyu-cards/?deck=<LZString.compressToEncodedURIComponent(JSON)>`，JSON = `{ n: 牌組名, c: [[image_file, count], ...], k?: 顏色標籤 }`（舊格式 identifier 可能是 card_no）。用 `lz-string`（cdnjs）解碼 → image_file 對 `cards_data.js` 找 card_no。
   - 從 `cards_data.js` 產生全卡 DEF（數值、學校、年級、技能中日文）；同卡號多版本取一張圖。
   - 卡圖：240px 寬 webp q70 實測平均 15KB → 全部約 8MB；建議拆成獨立檔案按需載入（不要全塞 base64）。
   - 尚未實作技能的卡：照數值打＋顯示「技能未自動化」，提供手動調整面板（±數值、抽/棄牌）。
2. **效果引擎重構**（約 1–2 輪）：把逐卡 if 改成效果模組（登場時／各階段フリー／持續修正／費用／對手回合觸發／名稱替換如着地上手組），每張卡一個物件，含給 AI 的估值函式。
3. **逐校實作技能**（每校約 1 輪，稲荷崎／音駒／烏野剩餘約各 2 輪）。Xiah 尚未決定先做哪些學校（候選：音駒、稲荷崎、白鳥沢、伊達工業）。

## 7. 其他待辦
- AI「困難」模式（關鍵決策蒙地卡羅 rollout）；對局進度存 localStorage。
- 未實作：周りの上手さ「影山付 6 Guts 再 +2」、着地上手組名稱固定規則細節、及川 P04-016/018、岩泉 P04-020、金田一 022、花巻 025、矢巾／京谷。
- `memory.md` 同步到 GitHub 的 claude repo（Claude 端 GitHub 未連結，請 Codex 端處理）。

## 8. Xiah 的偏好
- 回覆用中文、精簡、Markdown 結構；Adobe 介面術語用英文。
- 動工前先在 memory.md 寫計畫，完成後寫結果。
- 卡片效果有疑問以資料庫（含官方 Q&A）為準；規則以官方 rules_sheet_v1 為準。


## 回合交接提示與 Loss 確認（2026-10-19 更新）
- Game 的 opts.onNotice(notice) 為可等待的展示回呼；notice 含 rally 與 type：serve（player）、turn（player/from/ball/toss/attack）、loss（player/reason/winner/final）。只含公開局面，不帶手牌或牌庫。
- serveTurn / defendTurn 在回合開始、任何選牌或 AI 行動前等待展示回呼；來球值採結算後的 ball.off，攻擊合計採對方 ts.toss/ts.atk。loss 通知在補牌、拿 set card 與下一球前等待確認。
- 引擎仍以 LostSignal 判定失分；run() 捕捉後，wantsAck 真人若尚未主動喊 Loss，先收到 kind: lossConfirm（reason, options:[{label:'喊 Loss',value:true}]，canLoss:false）。這是確定失分前的獨立玩家確認，可 Undo 回去改上一個決策；AI 不需要另一位玩家替它喊 Loss。
- ui.html 的 #turnScreen 為全螢幕確認畫面；不以計時器自動跳過。使用 inert 與 aria-hidden 隔離背景、管理焦點；#turnNext 確認，#turnUndo 使用既有 Undo／同意悔棋介面。
- UndoSession 的 onNotice(g,notice) 不記入決策歷史，重播時跳過；使用同一取消 token 隔離舊提示回呼。真正 lossConfirm 會記入決策歷史，供完整重播。
- flow.test.js 驗證暫停、取消舊提示、接球失敗確認、延後補牌、Undo 與悔棋。flow-e2e.js 使用 seed 7 的完整真實對局逐步比對畫面、來球數字與 Loss 順序；其餘 UI 測試已加入提示確認操作。


## 手動結束回合與發球標示（2026-10-19 後續更新）
- 真人在發球、成功攔網或接／托／打進攻全部完成後，新增 kind: turnEnd（outgoing:{type,off}，canLoss:true）決策；按結束回合才 return 來球並交棒，此時仍可主動 Loss 或 Undo。AI 不額外等待，卡片效果與數值不變。
- lossConfirm 改在一般操作面板顯示，保留已登場的接球角色與球場可見；不再用全螢幕蓋掉失敗接球。玩家按「喊 Loss」後仍沿用 Loss 結果全畫面、補牌與換發球流程。
- Game.server 記錄本球最初發球者，每球開始設定；ui.html 的 #rallyStatus 黏在球場上緣，整球顯示「本球發球：你／AI」及目前回合／等待結束／等待 Loss。發球原本的全螢幕提示保留。
- 手機進入 turnEnd／lossConfirm 會捲至我方主球場，角色須完整位於發球標示和操作面板之間。
- turn-end.test.js 驗證成功接托打後的暫停、主動 Loss、未交棒及留場；flow-e2e.js 新增交棒前 Loss→Undo→再按結束、發球標示持續可見、失敗角色未被遮擋。回合通知依舊不寫入決策歷史，turnEnd 與 lossConfirm 都是正式決策。
