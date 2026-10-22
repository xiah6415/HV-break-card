# 實戰巡檢（Claude，2026-10-22）

`node qa-play.js [每組局數] [牌組字] [對手字]`：以嚴格模式可組的 10 校牌組（烏野、音駒、青葉城西、稲荷崎、白鳥沢、伊達工業、梟谷、ユース、角川、条善寺；技能卡優先、Event 各 2×4）互打，AI 與決定性隨機代理混合，檢查例外、卡死（>4000 決策）、80 實體／每方 40 張守恆、負值。

## 結果（master a5e712d）

| 輪次 | 局數 | 例外 |
|---|---:|---|
| 修正前 | 192 | 8：`Invalid entry name`×6、`Invalid parameter`×2 |
| 修正後 | 1,499 | 1：`Entry restriction or No legal entry name`（另一個問題，見下） |

### 已修：接球／登場預覽中斷整局（rules/legacy.js 一行）
`entryPreview` 的預演 `k.choose` 對所有決策都回 `[options[0]]`（陣列）。遇到單值決策——手牌有改名卡（例：黒尾・山本的 `name`）、或預演時觸發需選參數的監聽（例：入畑 P01-085 生成的 `parameter`）——核心判定非法並丟出例外，整局中斷（人類玩家同樣會遇到）。改為依 request 型態回答：`target／payment_cards／move_cards／guts／entry` 回陣列，其餘回單值。`qa-play.test.js` 重現兩組（修正前必失敗、修正後通過）。

### 待 Codex：back_attack 在不可登場時仍提供付費
重現：`node qa-play.js 12 音駒 ユース`（seed 11，AI 對 AI）。P0 舉球「黒尾 鉄朗」後，攻擊手只有夜久（攻 0）；系統詢問「黒尾 鉄朗：是否支付 1 Guts，發動登場效果？」→ 付 Guts 後 `_keyword(back_attack)` 呼叫 `_enter` 讓黒尾進攻擊區，但登場不合法（`Entry restriction or No legal entry name`，推測為攻擊區已有角色／名稱或登場限制）→ 例外中斷。建議：付費前先預檢 back_attack 能否合法登場，不能就不提供／視為無法發動；並補 AI 不付無效費用。

### 觀察（非錯誤）
- 17 局出現負的攔網／接球值（例：攔網 −1），來自對手減值效果；與 QA「數值可為負」一致。
- 平均 3.69 球／局，無卡死、無守恆錯誤。
