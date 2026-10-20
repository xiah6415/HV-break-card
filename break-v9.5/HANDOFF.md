# BREAK 對練台 — 交接文件（Claude → Codex，2026-10-19）

> 最新接球／舉球登場（2026-10-20，實作提交eb92636）：P03-051／P02-001／P01-039／P01-033完整程序改走資料，來球總值投影、可選實體回收與任意參數選擇；刪除舊效果及西谷歸零下限，依總合0-2-9保留負進攻。日向可回收剛付掉的Guts，及川對手棄牌由對方選。53情境（含1個封存全卡核心隔離驗證）、57完整Undo還原點及三尺寸操作通過。核准18張，其餘29卡舊控制器；支援18無技能、22主要情境、7部分。下一批接A-pass／翻牌等未整合關鍵字，不能直接擴大核准。尚未推送部署，下方數字為歷史。

> 最新攻擊登場／下回合權限（2026-10-20，實作提交0eb91c6）：P01-002／P01-003／P01-035／D04-002改走資料，共用ban處理原始接球≥6登場禁止／最多2人攔網／禁止技能加牌，來源離場／回合結束／Loss期限已接host權限。P01-003依原文及總合7-7-3補完整後段可選分支，來源／重建／語意檢查同步，80資料／64契約檢查。核准14張，其餘33卡舊控制器；支援18無技能、20主要情境、9部分。34情境／三種限制44完整Undo還原點、三尺寸操作通過；下一批接剩餘接球／舉球登場的回收、球總值與關鍵字。未部署，下方10張等為歷史。

> 最新自身登場被動同列（2026-10-20，實作提交29cd702）：D01-005／P03-046／BP-002／P02-003依資料進入共用佇列，可與監聽選本人順序；Guts／手牌精確付款、月島可拒絕與中側攔選擇、真實攔網合計已接。核准10張，其餘37卡沿用原控制器。34新情境、13完整Undo還原點及三尺寸操作通過；支援18無技能、19主要情境、10部分。下一批逐步接其餘登場被動及下回合限制；其他舊被動仍在監聽後，不能直接全部核准。未部署，下方6張等為歷史。

> 最新登場／保護（2026-10-20，實作提交821192d）：P03-057與P04-088改走資料程序，核准6張，其餘41張舊路徑。真正登場收據／批次監聽、角色實體防降保護、回合玩家先結算及多監聽排序已接；黒川僅抽牌階段、多張可累加，不對舊角色追溯。29新情境、10完整Undo還原點與三尺寸畫面通過；47卡支援18無技能、18主要情境、11部分。下一批整合角色自身登場被動與監聽的完整排序；目前舊被動固定在共用登場監聽後處理，不能直接核准其他登場機制。未部署，公開版af6d8c6。下方4張等為歷史。

> 最新共用監聽（2026-10-20，實作提交948735b）：P01-087已依共用資料接入及川目標與下回合非抽牌加牌監聽；核准4張，其餘43張舊路徑。sharedRulesState保存watch／序號／收據，sharedRulesPending保存可重演命令／基準／答案／待選／工作佇列；legacyEffect讓整個舊技能完成後才觸發，來源離場、到期與Loss處理已接合。watch.test20情境、watch-undo12個完整還原點通過，詳細驗證見最新memory與rules/README。尚未部署；其他監聽事件族／登場／保護及多人續接仍待整合。下方3張核准與「佇列尚未整合」為歷史。

> 最新持續身分／期限（2026-10-20，實作提交d2d77d3）：identity.js已接原引擎所有實際移牌與首批3張共用結算，Game.cardState跨結算保存ID／角色代次；新增lifecycle.js保存既有6種下回合限制，正常結束／Loss清理，修正restrict到期後仍可能影響回合外加牌。17身分／期限情境、原Undo加入完整cardState與turnEffects比對；詳細驗證見memory.md及rules/README.md。新核心跨回合watch／佇列／登場控制器仍未整合；核准仍3張，未推送部署。下方暫時ID描述是前批歷史。

> 最新本機整合（2026-10-20，實作提交f8b3cc9）：P01-013、P01-088、P04-089改走資料驅動共用結算，舊三張效果移除；其餘44張維持原流程。approvals.json以完整資料組指紋核准，runtime-data.json只含47張印刷身分與3技能，原全卡封存資料核准仍0。decisions.js／legacy.js接現有玩家選擇、Loss與Undo，測試／界線見rules/README.md及最新memory.md。本批尚未推送部署；下方「尚未接入」是隔離核心批次歷史。

> 本機保存：實作提交a0490f9，尚未推送或部署，公開版仍af6d8c6。rules/source及rules/rebuild.py可獨立重建本批資料；後續請同步來源、data與manifest，避免只改外層副本。

> 最新結算核心（2026-10-20）：新增repo內rules/core.js、core.test.js、README.md、rebuild.py、source/及data/，可在此repo離線重建，不依賴外層工作目錄。21種動作節點與部分條件可執行；54個局面情境及600次狀態操作／還原比對通過。已處理權限分層、支付／實體、同名限次、觸發順序、期間監聽、ワンタッチ跳階段及Loss清理；Loss切到loss_set，不把原階段限制帶入。原build／fuzz3000／test300通過，engine／UI／index指紋不變，尚未接入公開遊戲。

> 本批界線：live技能核准仍0，實際卡片只在sandbox驗證；只完成one_touch關鍵字，其他關鍵字、改名登場、交換、翻牌選牌、永久固定值等明確停止；來源不是自身登場的角色被動及無中攔特殊側攔亦待擴充。Loss停在間隔入口，完整比賽控制／手機非同步選擇／舊Undo及47卡接入尚未完成。rules/README.md有詳細限制，外層outputs/BREAK-settlement-update.md／validation.json是成果。下一批先接控制器及非同步選擇，再逐機制核准47卡，勿同時執行新舊技能邏輯。

> 最新補正（2026-10-20）：完成資料規格v2，見外層outputs/BREAK-card-contract-update.md。PR-081已改為動作層one_of_exact／[1,2]；359個直接作用目標節點明示single／multiple／all，P04-070為全體但membership=unresolved並禁止runtime核准；12個被動觸發資料組名稱格式已統一。545個資料組／3,132節點通過嚴格檢查，79項資料檢查、63項契約正反情境及既有94參考情境通過。沒有接入遊戲或部署。下方「PR-081未修正」為補正前分析。

> 重建：外層work/card-mapping/build.py→verify.py→contract_tests.py；schema.py是封閉欄位及跨欄位語意檢查，contract_reference.py只做已篩選ID的少量選擇參考判定，不是完整遊戲執行器。補正前資料在baseline-before-contract-v2，原風險證據保留，work/current-risk-audit.py改產出獨立followup。下一批建立共用結算／局面測試，再以現有47卡接入；資料與工具尚在外層，交接時不能只帶遊戲repo。

> 現況風險分析（2026-10-20）：見外層outputs/BREAK-current-risk-review.md及證據JSON。已確認PR-081可選1／2張的數量欄位誤放篩選條件、動作仍固定1張；未修正。P04-070全體保護的量詞／對象匹配待明定；效果期限、觸發佇列、同卡實體與多人Undo及資料版本交接需先完成。P04-084條件範圍已依實際JSON排除疑點。建議先補共用規格／完整情境，再由現有47卡分批接入。新資料／遊戲仍未整合提交部署，本次僅分析及交接紀錄。

> 最新實作進度（2026-10-19）：已完成541卡結構化映射第一輪，358張有技能（362卡文版本）及183張無技能全部建檔，保留713筆來源紀錄／707個不重複卡圖。外層 outputs/BREAK-card-rule-mapping.md／json 為主成果，BREAK-card-mapping-validation.md／json 有74項資料與條件檢查通過；卡片引用共用規則及參數，所有技能仍標記首次轉譯、runtime_approved=false。遊戲尚未讀取資料，不能宣稱全卡技能可玩。

> 共用規則最新為131條（新增效果放置不等於明示登場），來源仍602問答／614關聯；26組獨立參考判定／94情境通過，涵蓋45條契約的部分規則，其餘86條尚無可執行參考驗證。下一階段驗證資料執行與共用引擎整合，維持舊逐卡修補清單暫停。

> 工作檔：外層 work/shared-rules/build.py→verify.py，再 work/card-mapping/build.py→verify.py。card-mapping/model.py為共用資料建構器、programs.py為一次性結構化卡片資料，未供對戰時按卡號分支。例外見 outputs/BREAK-card-mapping-exceptions.md：四個卡文差異、P03-047來源技能加值上限與OPEN-EVENT-NO-CHANGE。P03-028放上方已依總合1-4-5／8-3分開處理，沒有冒用登場。PR-013官方JSON學年錯字已用官方卡圖核對。既有對練設定、引擎／UI／公開頁未改，未提交部署。

> 先前分析背景（2026-10-19）：已暫停逐卡補正，分析 541 卡／713 版本並產出分類候選與報告（外層 outputs/BREAK-card-engine-analysis.md）。目前依上方最新調整，先以官方問答歸納共用規則，尚未修改引擎。下方 47 張與 16 張缺口是目前已發布版本狀態，不是本次新實作指令。

> 判例追加：官方 31 頁共 602 則（552 卡片、50 通用）已完整取得；552 則日文問答與資料庫逐一比對一致。分類草案已連到 242 個卡號的全部判例，另整理 30 個重點情境。見外層 outputs/BREAK-card-rulings-analysis.md 與索引；語意／引擎仍待覆核，不能把已連結判例當作已實作。

## 翻牌操作更新（2026-10-19）
- P01-006 技能付費後呼叫 `revealTop(p, source, eligible)`。真人先收到 `kind: reveal` 的「翻開牌庫頂」，不帶隱藏卡號；按下才揭露卡片。符合且可加手牌：`kind: retrieve`，`ctx: {revealed,source,reason}`，選加入或置底。
- 不符合或禁止加入時自動置底，接著 `kind: revealResult` 顯示卡圖、牌名與原因，按「看完了，繼續」才往下；空牌庫也用此確認但不翻出卡片。上述決策保留本回合 Loss 和 Undo。
- 非 wantsAck 的 AI 自動選擇後送公開 `onNotice({type:'reveal',player,card,source,reason,result})`，本機玩家看完再繼續。只含公開牌；Undo 展示重播與取消沿用既有機制。多人真人的觀戰傳輸未接入。
- UI 公開結果可點卡圖放大，選加入手牌直接確認，不使用角色登場預放。`reveal.test.js` 驗證翻前等待、五種結果、重複卡頂精準移動、AI 暫停、Undo 與過期回覆；`reveal-e2e.js` 桌機及兩種手機驗證六種實際畫面。

> 最新狀態：使用者指定 1→2→6→7→3→4，目前在第 1 階段。47 張官方資料已核對，第二批補完 PR-057、P03-087、P03-096 的主要情境，支援狀態為 18 張無技能、13 張主要技能情境通過、16 張部分技能待補。最新範圍見 RULES-AUDIT.md、card-support.json，工作順序見 ROADMAP.md。下列 Artifact、49 張及卡庫總數是歷史描述，不作目前完成度依據。

## 名稱、角色目標與跨區費用（2026-10-19 第二批）
- `enterCharacter` 在 PR-057 登場前送 `kind: name`，先排除與接球／舉球角色同名的選項。`cardName(p,key)` 取場上有效名稱；手牌、棄牌與 Guts 仍用卡面名稱。`entryNames` 供 AI／預覽預估合法名稱，不能把 PR-057 固定視作日向或西谷。
- `p.effects[key] = {card,name?,mods}` 以區域綁定目前角色，側攔用 side:0 等 key。`place`／替換攻擊角色會清除原區效果；`finishTurn` 在真人結束確認後清除效果並設 `ts.finished`，保留 ts.toss/atk 結果供來球提示。Loss 結算亦清除。下一回合 `beginTurn` 補做上一回合清除。
- `courtTargets` 不含 Guts；`chooseTarget` 送 kind: target，options 的 value 是區域 key、card 是展示卡圖；UI 直接選目標，不預放到手牌區。`chooseParameter` 送 kind: parameter，排除「－」、保留 0。`boostParameter` 同時更新對應活動中的接／托／攻與攔網合計，其他參數存入效果並顯示在球場。
- P03-096 可指定任一場上名稱為日向翔陽的角色（含側攔／PR-057 選日向），再選一參數；沒有日向但能抽牌仍可使用。P03-087 的全隊條件依非空場上角色、精確烏野／ユース所屬判定，Guts 不參與；接球／攻擊均可選任一角色攻擊 +1，選影山且有 6 Guts 時可選擇額外付費再選其參數 +2。
- `payCourt` 送 kind: gutsCourt、multi:true、need:6；選項是跨區 Guts 的平面索引，標記區域與卡圖，每區頂牌不可付。精確選 6 張後按區內索引倒序移動；無效代理回覆沿用既有費用介面的確定性自動選擇，絕不多付或移走頂牌。
- `skill-targets.test.js` 涵蓋名稱／期限／替換、指定角色與參數、側攔、禁加牌與無目標、跨區六費用／拒絕／不足、所屬、真正接球判定與非法回覆；`skill-targets-undo.test.js` 比較 7 次完整局面／紀錄還原；`skill-targets-e2e.js` 在三種尺寸實際操作與 Undo。

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
