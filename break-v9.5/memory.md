# BREAK 對練台（バボカ!! BREAK 人機對戰網頁）

## 目標
Xiah 要跟 AI 對打的網頁版模擬器，可跨裝置使用 → 純前端（規則引擎＋AI 都在瀏覽器），發布成 Artifact 連結。
對手 AI 不用 LLM（0 token）；之後可選配本地 LLM（Ollama）做賽後覆盤。

## 來源
- 規則與卡片效果：沿用 /home/claude/haikyu-sim/sim2.py（Python 模擬器，已驗證多場勝率）
- 卡片資料：weilun2022/haikyu-cards cards_data.js ＋ 第四彈代卡辨識 p04_cards.md

## 架構
- engine.js：純 JS 規則引擎，async 決策介面 `agent.choose(game, player, req)`；人類＝UI 等點擊，AI＝啟發式（從 sim2 移植）
- ui：單一 HTML（engine 內嵌），Node 可單獨跑 engine 做 AI vs AI 驗證
- 規則假設（與 sim2 相同）：發球/攔網回球不可攔網；場上牌跨 set 保留；牌庫空則跳過抽牌

## MVP 範圍
- 我方牌組：1014、1014c、快攻版、1010
- AI 牌組：新青城（P04/D04）、日向影山軸、鏡像
- 尚未：音駒、舊青城、角川/伊達工等新隊伍、蒙地卡羅 AI、本地 LLM 覆盤

## 狀態
- [x] engine.js ＋ Node 驗證（AI vs AI 1000 場：1014 vs 新青城 23.7%、快攻 35.5%、1014c 45.2%，比 sim2 低 5–10%；3000 場隨機 fuzz 無錯誤、卡片張數守恆）
- [x] UI（ui.html）＋ 組裝 index.html ＋ Playwright 桌機/手機實打至終局無錯誤
- [x] 發布 Artifact：https://claude.ai/artifact/LkuRsUG56mHGVvCFjMrjSr（v1 2026-10-18；v2 部分調度＋卡圖＋手機版面；v3 規則校正；v4 2026-10-19 Guts/棄牌/Event 可見＋抽牌紀錄與 NEW 標記）
- 建置：python 把 engine.js 填進 ui.html 的 /*ENGINE*/ → index.html；測試 test.js / fuzz.js / e2e.js
- [ ] 同步 GitHub claude repo（GitHub 未連結，待 Xiah 提供 owner/repo 或在 claude.ai 連結 GitHub）

## 待辦（下一版）
- AI「困難」：關鍵決策（攔/接、接球手）做蒙地卡羅 rollout
- 加牌組：音駒、舊青城、角川、伊達工、自訂牌組（貼卡號清單）
- 攔網階段的 Event（日向夏）、月島攔網時讓玩家選中攔
- 對局進度存 localStorage（同裝置中斷可續）

## v3 規則校正（2026-10-19，Xiah 指出規則有誤後重讀官方規則與卡片原文）
- 來源：総合ルール v1.03（WebFetch 只讀到 5-4，5-5 之後讀不到；takaratomy 被 proxy 擋）、water 總合ルール解説⑤、TCG推進協議会 note、卡片 JP 原文＋官方 Q&A
- 修正：
  - インターバル順序：雙方先補到 6 張，「再」由失分方把セットカード加入手牌（舊版先拿再補 → 失分方少 1 張）
  - 先決定發球權，再從發球方開始調度
  - 攔網階段補上フリーステップ（日向夏 [ブロック] 可加攔網）→ ジャッジ；側攔在攔網階段結束才進棄牌區
  - 西谷 P03-051：付 2 Guts 全烏野時，若對手攻擊手原始攻擊 0 → 對手進攻 −3（舊版漏掉）
  - 俺も思った☆：條件改為「發球區或舉球區有及川」即可打（Q&A），舉球 +1 只在舉球手是及川時生效
  - 黒川：登場的 2/3 年烏野接球 +2 且數值不會被降低（可抵ドンピシャ!!! 的 −1）
- 仍未實作：周りの上手さ「影山付 6 Guts 再 +2」；着地上手組改名固定（接球=西谷、攻擊=日向）
- 規則仍是推定：場上牌跨 set 保留（TCG推進協議会文章也說留在場上）
- 2026-10-19：Xiah 上傳官方 rules_sheet_v1.pdf，逐項核對 v3 引擎全部一致：
  勝利條件（對手セットエリア空時再取 1 set 即勝）、準備（決定發球權→抽 6→調度 1 次挑牌放回→2 張セット→發球方開始）、
  インターバル（①雙方補到 6 ②失分方拿セット，拿不到即敗 ③取 set 方得發球權）、攔網（中攔 1 人後最多 2 側攔、同名不可、合計 ≥ 進攻即成功、回球 0、側攔進棄牌區）、
  發球與攔網回球不能選攔網、Event 在抽牌後或各階段登場後可打且同階段張數不限、「－」數值不能登場該區、期間未指定的效果在エンドフェイズ消失。
  インターバル步驟沒有清場 → 場上牌跨 set 保留的推定成立。
- v4（Xiah：看不到 Guts、棄牌去哪，抽牌內容也要顯示）：
  - 引擎：draw() 記錄抽到的牌（reveal=0 只對你顯示卡名，AI 只顯示張數）、標明來源（抽牌階段/技能名/インターバル/起手/調度）；pay() 紀錄付了哪些 Guts 進棄牌區；側攔進棄牌區、セットカード加入手牌也記錄；newCount 供 NEW 標記
  - UI：每區下方列出 Guts 名稱（最新在上，最多 3 張＋n）；Event 區／棄牌區改成縮圖＋最新兩張名稱，點開看整疊（最新在前）；手牌剛抽到的標 NEW；紀錄中抽牌（藍綠）與 Guts 移動（斜體）分色
- v5（Xiah：手機排版、接球舉球攻擊一列）：版面改成牌桌配置——每方「接球／舉球／攻擊」大卡一列（我方 98px、對手 76px；≥700px 放大），發球／攔網／Event／棄牌縮成同一列小格；對手由上而下：資訊→小格→主列，我方：主列→小格→資訊→手牌
- v6（Xiah：手機仍可左右滑，場地不該變寬）：實測 320/360/390 寬 scrollWidth 達 600–800px。根因：`.game` grid 沒設欄寬→隱式 auto 欄被 nowrap 文字（ticker、Guts 名、strip）撐開。修：`.game{grid-template-columns:minmax(0,1fr)}`、所有 side/net/strip 子元素 min-width:0、html/body overflow-x:clip 保險；手牌改成「不捲動」grid（≤6 張一列，>6 張兩列），卡寬依螢幕自動縮
- v7 計畫（Xiah：操作太直來直往 → 選了「點了就打出」「系統替我決定太多」「缺實體出牌手感」）：
  - 出牌改兩段式：點/拖手牌 → 卡先「預放」到目標區（半透明＋預估數值、接得起與否、接完能否舉攻）→ 確認／取消
  - 拖曳：手牌可拖到接球/舉球/攻擊/發球/攔網區、Event 區、棄牌區；合法目標高亮
  - 攔網改自己組：逐張點選攔網手（第 1 張中攔，可改中攔），即時顯示總攔網 vs 進攻（引擎 evalBlock；AI 仍走 combos）
  - 抽牌階段改成自己點「抽 1 張」（agent.wantsAck；AI 不受影響）
  - 技能是否發動的提示顯示卡圖與技能原文
  - 登場動畫、數值變化動畫
- v7 完成（2026-10-19）：上述全部實作；引擎新增 evalBlock/blockCands/blockMax、block 回傳 {cards,center}、wantsAck 抽牌確認、匯出 canChain/recvName/atkName/isHin/EVT；Node 400 局人工攔網測試、3000 局 fuzz、Playwright 桌機（含拖曳）/手機各 3 局皆無錯誤、無橫向捲動
- v8 計畫（Xiah 2026-10-19）：
  1. Guts 付費改成自己選要付哪幾張（區內除了最上面那張角色以外任選；AI 仍從最下面付）。之前「從最下面付」是誤解
  2. 開局擲骰決定發球（雙方 d6，大的發球，平手重擲），有擲骰畫面；調度時依「發球方／接發球方」給檢查清單提示（發球手、能否接對手最高發球、舉球、攻擊）
  3. 主動 Loss：自己回合的任何決策點都能喊 Loss（二次確認），已登場的牌留在場上 → 可藉此濾牌
- v8 完成（2026-10-19）：引擎 pay() 改 async，人類可多選要付的 Guts（kind 'guts'，need=n；AI/「從最下面付」維持舊行為）；run() 擲骰（d6 平手重擲）＋ kind 'roll' 畫面；mulligan 帶 role，UI 顯示保留後的發球/接球/舉球/攻擊檢查清單（含對手最高發球）；ask() 帶 canLoss（只在自己回合），回傳 {__loss:true} → LostSignal「主動 Loss」；測試：500 局隨機 Loss＋自選 Guts 卡片守恆 OK、fuzz 3000、e2e 桌機/手機
- 2026-10-19：Xiah 決定交給 Codex 接手 → 新增 HANDOFF.md、AGENTS.md，打包 haikyu-web＋haikyu-sim 給 Xiah

## v9 開工計畫（2026-10-19，GPT-6 接手）
- 目標：建立全卡資料匯入與牌組分享解碼的基礎，優先保持 v8 規則／UI 向下相容。
- 先檢查 cards_data.js 資料結構及目前 DEF/DECKS，新增可重跑的轉換腳本及匯入入口；不可直接手改 index.html。
- 現有技能的實作不能被資料庫文字覆寫；未實作技能須明確標示，不能假裝已生效。
- 完成後執行 build、test、fuzz；將結果與尚未完成項目記錄於此。

## v9 第一階段結果（2026-10-19）
- 新增 `deck-tools.js`（UMD）：讀取 `{n,c:[[card_no,count]]}` 或 `{name,cards:{...}}`，支援 `HV-` 前綴與 `.webp` 後綴正規化、重複卡號加總，嚴格驗證已收錄卡、40 張及 Event ≤8；可匯出標準 JSON。
- 修改 `ui.html`：選牌組頁新增「匯入／編輯自訂牌組」，以現有牌組作草稿，驗證成功後注入 `DECKS.custom`，存 localStorage，下次載入仍可使用；既有遊戲引擎／AI 不變。
- `build.py` 加入 `/*DECKTOOLS*/` 建置，仍由 build 產出 index.html；新增 `deck-tools.test.js`。
- 測試：`python3 build.py` 成功（47 張內嵌圖）；`node deck-tools.test.js` 通過；`node test.js 300` 通過；`node fuzz.js` 3000 局通過。
- `node e2e.js` **未通過環境啟動**：交接程式寫死的 `/opt/npm-tools/node_modules/playwright` 在本環境不存在（MODULE_NOT_FOUND），因此未聲稱 UI E2E 驗證完成。
- 阻塞：本環境無法連線下載外部 `cards_data.js`，**尚未匯入 541 種卡、尚未完成 LZString 分享網址解碼、完整卡圖與效果模組化**。本版僅能匯入現有 DEF 已定義卡，未知卡明確拒絕，避免牌局數值失真。
- 下一步：取得官方資料庫 `cards_data.js` 本地檔，建立轉換＋圖片資產索引；補上分享網址解碼；再補「未自動化效果」面板。

## v9.1 修復計畫（2026-10-19，使用者反映預覽文字與 UI 不符）
- 比對原始 v8 與 v9 的 ui.html、engine.js、產物，維持 v8 排版與內容，不重新設計。
- 修正 v9 自訂牌組初始化在 `store` 宣告前呼叫造成的 JavaScript TDZ 啟動錯誤。
- 重建 index.html，比對版面差異，執行 Node 測試與可用的瀏覽器啟動檢查，結果追加在下方。

## v9.1 修復結果（2026-10-19）
- 根因：`store.get` 在 `const store` 宣告之前呼叫，觸發 TDZ ReferenceError，使 UI 啟動中斷；已調整初始化順序。
- 原版與修正版 engine.js 完全一致；UI CSS 與原 v8 一致。v9 僅加了自訂牌組入口和匯入邏輯。
- `python3 build.py`、`node deck-tools.test.js`、`node test.js 300`、`node fuzz.js`（3000 局）通過。
- Python Playwright + Chromium 啟動畫面（390px、1280px）：無 pageerror；選牌組 4 個選項與開始對戰按鈕正常出現；390px 無橫向溢出。
- 進入實際對戰的額外 Playwright 嘗試超時（未算通過），後續需補完整 E2E。
- 未更動規則或卡片資料；如果仍有文字或美術差異，需以使用者截圖逐項核對。

## v9.2 開工計畫（2026-10-19，iPhone 預覽亂碼與桌機三欄）
- 使用者 iPhone 預覽截圖顯示中文為替代字元、桌機三欄被縮放；檢查發現 UI 缺少標準 HTML document/head、UTF-8 charset 與 device-width viewport。
- 在 ui.html 補上 HTML5 結構及 meta charset/viewport，保持原 CSS、介面與 JS 原貌；重新 build 並以 Playwright 裝置 viewport 查核。
- 執行 build、deck-tools.test、test、fuzz；記錄結果與限制。

## v9.2 修復結果（2026-10-19）
- 使用者截圖所示亂碼與錯誤桌機三欄模式，根因為上一版本產物以 `<title>` 開頭、缺少 `<!doctype html>`、`<html>`、`<head>`、`<meta charset="UTF-8">`、`<meta name="viewport" content="width=device-width, initial-scale=1">`，行動預覽依舊以桌機 layout viewport 顯示、且無法保證自動辨識 UTF-8。
- 已在 ui.html 補入標準 HTML5 結構（含 viewport-fit=cover），保留既有 CSS、牌桌、規則與 JS，build.py 重新輸出 index.html。
- `deck-tools.test.js` 通過；`test.js 100` 通過；`fuzz.js` 3000 局通過。
- Playwright 本次環境的 Chromium 執行被政策擋下（net::ERR_BLOCKED_BY_ADMINISTRATOR；file:// 和 localhost 均被擋），故**沒有完成真機或瀏覽器視覺驗證**。需使用者以 iOS Safari 再測試修正版。

## v9.3 開工計畫（2026-10-19，預設牌組選項修復）
- 使用者指出 v9.2 沒有原本預設牌組。檢查 engine.js 中六套內建 DECKS 完整存在，但 ui.html MY_DECKS 與 AI_DECKS 各僅露出子集。
- 將六套內建牌組同步列在玩家及 AI 下拉選單，不改動任何既有牌組內容、遊戲規則或手機 CSS。
- 更新 index.html，執行 Node 單測與 fuzz，將實際結果追加至本檔。
- 提醒自訂牌組 localStorage 無法自動跨獨立 HTML 檔案搬移。

## v9.3 修復結果（2026-10-19）
- `ui.html` 玩家與 AI 牌組下拉選單均顯示原 engine.js 六套內建牌組：烏野1014、1014c、烏野快攻版、烏野1010、青葉城西（第四彈）、烏野 日向影山軸。
- 沒有修改 `engine.js` 內任何牌組內容／規則，保留 v9.2 UTF-8、viewport 與原 CSS。
- `python3 build.py` 成功，47 張內嵌卡圖；`node deck-tools.test.js` 通過；`node test.js 300` 完成；`node fuzz.js` 3000 局通過。
- 限制：若使用者指的是 Claude Artifact 中另外儲存的自訂牌組，不包含在交接 ZIP 的原始碼；不同 HTML 來源的 localStorage 不能自動同步。需要使用者提供舊牌組 JSON／分享網址才能恢復。

## v9.4 開工計畫（2026-10-19，iPhone 下拉選單空白）
- 使用者回報 v9.3 牌組選項仍空白。以 Playwright set_content 在 Chromium 檢查 v9.3，雙方各六項成功顯示，表示載入環境存在差異。
- 將六套內建選項直接寫進 ui.html 靜態 HTML 作為 fallback，即使嵌入預覽環境限制 JS 也能看見選項；保留 JS 對自訂選項的動態填入。
- 驗證 JavaScript 開啟與關閉兩種情形、測試引擎與 Fuzz，完成後追加紀錄。

## v9.4 修復結果（2026-10-19）
- 已將雙方六套內建牌組 option 寫成靜態 HTML，JS 不執行也有可見選項，原動態選單及規則未改。
- build.py 通過，deck-tools.test.js 通過，test.js 100 局完成，fuzz.js 3000 局通過。
- Chromium 的 JS on/off 雙模式測試逾時，未驗證；須由 iPhone 預覽確認。

## v9.5 修復計畫（2026-10-19，開工前）
- 使用者回報 v9.4 手機預覽選單雖顯示但無法開始對戰。
- 先用真實 Chromium 逐步重現：JavaScript 初始化、牌組選項、開始按鈕、進入對局。
- 僅修復阻止啟動的問題，不更動 v8 規則與既有 UI；重新建置並測試。
- 實測、剩餘問題與交接資訊於完成後追加本檔。

## v9.5 結果（2026-10-19）
- 核對 v9.4 打包輸出：4 個 script 經 `node --check` 驗證語法正確，47 張卡圖已內嵌。
- 症狀（JS 動態選單空白，改靜態選單後按鈕仍無反應）與受限檔案預覽環境不執行 JavaScript 相符；未取得使用者裝置上的錯誤記錄，尚不能斷言唯一根因。
- 新增顯示在靜態 HTML 的啟動狀態指示：若腳本不執行，會停留警告；若執行則隱藏，若開始遊戲拋同步錯誤則顯示訊息。
- 測試：`node deck-tools.test.js` 通過，`node test.js 100` 通過，`node fuzz.js` 3000 局通過；Python build.py 產生 47 張內嵌卡圖。
- Chromium Playwright 受執行環境政策 `net::ERR_BLOCKED_BY_ADMINISTRATOR` 阻止 file:/// 與 localhost 開啟，故仍無法驗證互動瀏覽器開始對戰。
- 下一步：在允許 JavaScript 的 HTTPS 網頁（建議 GitHub Pages）驗證，或提供使用者設備上診斷提示截圖。GitHub 尚未推送。

## 2026-10-19 GitHub Pages 部署計畫（Codex，實作前）
- 使用者提供 haikyu-v9.5-diagnostic.zip，授權延續既有方案部署至 xiah6415/HV-break-card 的 break-v9.5/ 子目錄，保留既有卡牌查詢首頁。
- 已讀 HANDOFF.md、AGENTS.md 與本 memory.md；先寫本計畫再建置、測試與部署。
- 檢查 gh 登入、repo/master、遠端最新狀態與 Pages 設定；以獨立 clone 避免覆蓋其他工作。
- 不修改遊戲規則、UI、engine.js、ui.html、deck-tools.js；不手改 index.html，執行 build.py、fuzz.js、test.js 300、deck-tools.test.js，核對 ZIP 與建置產物雜湊。
- 僅新增 break-v9.5/ 完整靜態專案與交接文件，檢查差異後提交並正常推送；不強制推送。
- 等 Pages 成功後驗證公開 HTTPS 與產物一致、檢查瀏覽器開始對戰；更新本檔實際結果並另提交推送。iPhone Safari 真機操作仍需使用者驗證。
- 同步原始 ZIP、完整專案與交接紀錄到使用者指定 iCloud 01_Projects/BREAK-v9.5/。

## GitHub Pages 部署前驗證結果（2026-10-19，Codex）
- ZIP SHA-256：86af7935c371dc90fa8aad042bf05ecc9aff3309ec538c468b0947708af82ca2。
- 建置成功：47 張內嵌卡圖；index.html SHA-256：3dd675e47cc4e7f34338b6866c6e96ab00553ca95797d92b3eb31f0b04deec35。
- 除本 memory.md 外，所有專案檔案（含重新建置的 index.html）均與 ZIP 原檔逐一 SHA-256 比對一致；未修改規則、UI、引擎或牌組。
- deck-tools.test.js 通過；fuzz.js 3,000 局卡片守恆通過；test.js 300 六組配對共 1,800 局及範例對局完成；四個內嵌 script 均通過 node --check。
- v9.5 使用 bk_custom_deck / bk_my / bk_ai / bk_speed，與既有查詢頁 hv_decks / hv_deck_colors / hv-deck-simple 不衝突。遊戲腳本及圖片皆內嵌，外部僅 Google Fonts 字型。
- 獨立 clone 初始工作目錄乾淨；origin 為 xiah6415/HV-break-card，master 基準 3716bff9e387e1514654f5b143463848ff26d14f。gh 帳號 xiah6415 具 ADMIN 權限；Pages 仍為 master 根目錄，不需修改設定。
- 公開網址驗證與瀏覽器操作結果待部署後補入；尚未宣稱 iPhone Safari 真機測試完成。
- 本機瀏覽器已實際點擊「開始對戰」，成功進入擲骰畫面；點擊「開始調度」後，顯示 6 張起手牌與「全部保留」，確認 JavaScript 初始化與基本開局互動正常。尚未進行完整瀏覽器終局測試；本次沒有 UI 改動。

## GitHub Pages 部署完成（2026-10-19，Codex）
- 公開遊戲網址：https://xiah6415.github.io/HV-break-card/break-v9.5/ 。請以 iPhone Safari 開啟測試。
- repo：https://github.com/xiah6415/HV-break-card ，分支 master，Pages 來源 master 根目錄；本專案位於 break-v9.5/。
- 部署提交：7afd811fde77ab3f20b0ad5237c74d1674b0c44f，已正常推送；Pages build / deploy 工作 39193863578 成功：https://github.com/xiah6415/HV-break-card/actions/runs/39193863578 。
- CLI GET 公開網址得到 HTTP 200；線上 HTML 與原始 ZIP、重新建置產物逐 byte 一致，SHA-256：3dd675e47cc4e7f34338b6866c6e96ab00553ca95797d92b3eb31f0b04deec35。
- 公開 HTTPS 頁面實際瀏覽器操作：雙方六套預設牌組正常顯示；開始對戰 → 擲骰 → 開始調度 → 6 張起手牌與全部保留按鈕，均正常出現。
- 原 repo 首頁 index.html 與原基準 3716bff 內容一致；本次只新增 break-v9.5/，沒有改卡牌規則、UI、引擎或既有網站。
- 原始 ZIP 與完整 Git checkout 將保存於 /Users/suyan/Library/Mobile Documents/com~apple~CloudDocs/01_Projects/BREAK-v9.5/；checkout 名稱 HV-break-card，專案在 HV-break-card/break-v9.5/。根目錄 memory.md 記錄此任務交接與最終提交資訊。
- 本部署結果另以文件提交推送；其提交 hash 由 git log 查閱（文件不嵌入自身 hash）。
- 後續：iPhone Safari 真機開啟與操作由使用者驗證；本次沒有執行完整瀏覽器終局 E2E，未宣稱全部操作或 iOS 相容性已驗證。
- 下次修改前先讀本檔與 HANDOFF.md、AGENTS.md；檢查 git status、目前分支與遠端最新版本，再寫計畫。勿手改 index.html，勿 force push，勿把其他專案工作混入提交。
