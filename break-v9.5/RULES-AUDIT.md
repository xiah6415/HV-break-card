# 現有卡片規則與技能支援稽核

核對日：2026-10-19。官方規則 v1.06；[官方總合規則](https://www.takaratomy.co.jp/products/haikyuvobacabreak/rules/pdf/rules_general_v1.06.pdf)。

47 張均已對到官方卡號、名稱、數值與位置；6 組預設牌組全部納入。角色數值與目前引擎一致。

- 無技能／數值核對：18 張。
- 主要技能情境通過：17 張。
- 部分技能待補：12 張。

「主要技能情境通過」只代表列出的測試通過，不是所有目標、技能組合或規則均已驗證。部分技能卡仍可在現有對練台使用，限制見下表。官方 Q&A 編號是來源索引，不代表每則 Q&A 都已自動化。

## 本批已修正

- 黒川生效時，接球預覽與實際防降、PR-057 雙學年判定一致。
- PR-029、P02-001、P01-006、P03-086 的「最多」回收可選擇不拿。
- オープン攻撃在日向舉球時仍可抽／棄，但不會違規登場同名日向。
- 移除自由步驟 12 次的任意上限。
- 攔網付費／事件途中 Loss，側攔卡進棄牌區一次，避免遺失。
- 官方 HVBP-002 能對應現有 BP-002。
- 第二批：PR-057 每次登場可選名稱，與同名限制／日向技能連動，回合結束到期。
- 第二批：P03-096 可指定場上日向及任一數值（排除「－」）；P03-087 支援接球與攻擊、角色目標、跨區六 Guts 與額外參數。新選擇可 Undo。

8 個回歸情境在修改前引擎均失敗，修改後均通過，見 rules-audit.test.js；另有 skill-basics.test.js 與既有流程／Undo 測試。

## 接續修正順序

1. 將新目標／參數介面套用到其餘卡片的已知限制。
2. 其他事件的場上目標、可不抽牌，以及無變化時不能打出／失效處理。
3. 登場技能的可不發動、中側攔技能選擇、各效果期限與負值。
4. 剩餘 12 張部分技能逐項補測後，再進入牌組串接階段。

## 本機流程與正式模式待分離項目

- 抽牌事件在接球判定前也可使用，以及接不起球後手動按 Loss，保留使用者指定操作。
- 開局目前由擲骰勝者直接發球；官方規則另有選擇先發球與否，尚未實作。

現有回合交棒、Loss 手動確認與固定 seed Undo 維持；本批沒有改成自動交棒。

## 逐卡對照

| 卡號／官方資料 | 名稱 | 支援狀態 | 已知限制／測試 |
|---|---|---|---|
| [HV-P01-013](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-P01-013&voba=N) | 縁下 力 | 主要情境通過 | 本機共用結算：宣告棄牌後選任一場上烏野角色接球+2；含側攔、Guts排除與Undo。；`rules-audit.test.js`；`rules/legacy.test.js`／`rules/legacy-undo.test.js`／`rules/legacy-e2e.js` |
| [HV-P02-003](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-P02-003&voba=%E9%A0%82) | 月島 蛍 | 部分技能待補 | 目前會自動使用月島技能並指定中攔；仍需補上可不發動及側攔技能的選擇。 |
| [HV-D01-005](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-D01-005&voba=D) | 西谷 夕 | 主要技能情境通過 | `skill-basics.test.js` |
| [HV-P01-011](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-P01-011&voba=R) | 西谷 夕 | 無技能／數值核對 | 官方卡文無技能；數值、卡圖與牌組引用已檢查 |
| [HV-PR-033](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-PR-033&voba=P) | 西谷 夕 | 無技能／數值核對 | 官方卡文無技能；數值、卡圖與牌組引用已檢查 |
| [HV-P02-001](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-P02-001&voba=S) | 日向 翔陽 | 主要技能情境通過 | `rules-audit.test.js` |
| [HV-P03-051](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-P03-051&voba=N) | 西谷 夕 | 部分技能待補 | 接球加成已實作；對手進攻減值目前有歸零下限，需依總規核對負值處理。 |
| [HV-PR-022](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-PR-022&voba=P) | 澤村 大地 | 部分技能待補 | 目前自動套用 A 傳球，尚未讓玩家分別選擇兩個可使用的效果。 |
| [HV-PR-057](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-PR-057&voba=P) | 着地上手組。 | 主要技能情境通過 | `skill-targets.test.js`；`skill-targets-undo.test.js`；`skill-targets-e2e.js` |
| [HV-D01-009](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-D01-009&voba=D) | 菅原 孝支 | 無技能／數值核對 | 官方卡文無技能；數值、卡圖與牌組引用已檢查 |
| [HV-P01-006](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-P01-006&voba=%E9%A0%82) | 影山 飛雄 | 部分技能待補 | 公開卡可選擇不拿已修正；PR-057 的名稱判定仍依固定名稱，需隨名稱模組補全。；`rules-audit.test.js` |
| [HV-P03-048](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-P03-048&voba=R) | 影山 飛雄 | 無技能／數值核對 | 官方卡文無技能；數值、卡圖與牌組引用已檢查 |
| [HV-PR-032](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-PR-032&voba=P) | 影山 飛雄 | 無技能／數值核對 | 官方卡文無技能；數值、卡圖與牌組引用已檢查 |
| [HV-PR-043](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-PR-043&voba=P) | 影山 飛雄 | 無技能／數值核對 | 官方卡文無技能；數值、卡圖與牌組引用已檢查 |
| [HV-PR-054](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-PR-054&voba=P) | 影山 飛雄 | 無技能／數值核對 | 官方卡文無技能；數值、卡圖與牌組引用已檢查 |
| [HV-P01-002](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-P01-002&voba=%E9%A0%82) | 日向 翔陽 | 主要技能情境通過 | `skill-basics.test.js` |
| [HV-P01-004](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-P01-004&voba=R) | 日向 翔陽 | 無技能／數值核對 | 官方卡文無技能；數值、卡圖與牌組引用已檢查 |
| [HV-P01-003](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-P01-003&voba=S) | 日向 翔陽 | 部分技能待補 | 條件及加成已實作；目前會自動使用，尚未提供符合條件時不發動的選擇。 |
| [HVBP-002](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HVBP-002&voba=P) | 日向 翔陽 | 主要技能情境通過 | `skill-basics.test.js`；`deck-tools.test.js` |
| [HV-PR-053](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-PR-053&voba=P) | 日向 翔陽 | 無技能／數值核對 | 官方卡文無技能；數值、卡圖與牌組引用已檢查 |
| [HV-D01-004](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-D01-004&voba=D) | 山口　忠 | 無技能／數值核對 | 官方卡文無技能；數值、卡圖與牌組引用已檢查 |
| [HV-P03-046](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-P03-046&voba=N) | 赤木 路成 | 主要技能情境通過 | `skill-basics.test.js` |
| [HV-P03-057](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-P03-057&voba=N) | 黒川 広樹 | 部分技能待補 | 目前採玩家指定的接球前延長時機，且以接球防降為主；正式抽牌時機與各參數防降待分離核對。；`rules-audit.test.js`；`events-timing.test.js` |
| [HV-D01-012](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-D01-012&voba=D) | ブロード攻撃 | 部分技能待補 | 目前只加本次攻擊角色；需提供場上烏野角色指定，並核對混校牌組的目標限制。 |
| [HV-P01-074](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-P01-074&voba=N) | 烏養 一繋 | 部分技能待補 | 額外加成條件已實作；目前僅指定本次攻擊角色，尚未提供其他場上角色。 |
| [HV-P01-078](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-P01-078&voba=S) | オープン攻撃 | 部分技能待補 | 抽棄、次數及同名舉球限制已補測；PR-057 的可選名稱仍待名稱模組處理。；`rules-audit.test.js` |
| [HV-P03-086](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-P03-086&voba=N) | プレーは大分 おりこうさんよな | 主要技能情境通過 | `rules-audit.test.js` |
| [HV-P03-090](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-P03-090&voba=S) | おれにバレーボール教えてくれて ありがとう | 部分技能待補 | 回收與每回合次數已實作；目前只在可回收時提供，尚未分開處理打出事件與技能無效。 |
| [HV-PR-029](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-PR-029&voba=P) | 鬼と 鬼だな | 部分技能待補 | 最多各一張可選擇不拿已修正；目前只在可回收時提供，空目標打出尚未提供。；`rules-audit.test.js`；`events-timing.test.js` |
| [HV-P03-096](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-P03-096&voba=N) | 日向 夏 | 主要技能情境通過 | `skill-targets.test.js`；`skill-targets-undo.test.js`；`skill-targets-e2e.js` |
| [HV-P03-087](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-P03-087&voba=N) | 周りの上手さに引っ張られる | 主要技能情境通過 | `skill-targets.test.js`；`skill-targets-undo.test.js`；`skill-targets-e2e.js` |
| [HV-P01-033](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-P01-033&voba=%E9%A0%82) | 及川 徹 | 部分技能待補 | 目前只加發球／舉球階段數值，尚未提供任一參數的選擇。 |
| [HV-D04-003](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-D04-003&voba=D) | 及川 徹 | 無技能／數值核對 | 官方卡文無技能；數值、卡圖與牌組引用已檢查 |
| [HV-P04-027](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-P04-027&voba=R) | 渡 親治 | 無技能／數值核對 | 官方卡文無技能；數值、卡圖與牌組引用已檢查 |
| [HV-P01-039](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-P01-039&voba=N) | 渡 親治 | 主要技能情境通過 | `skill-basics.test.js` |
| [HV-D04-010](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-D04-010&voba=D) | 国見 英 | 無技能／數值核對 | 官方卡文無技能；數值、卡圖與牌組引用已檢查 |
| [HV-P04-026](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-P04-026&voba=N) | 花巻 貴大 | 無技能／數值核對 | 官方卡文無技能；數值、卡圖與牌組引用已檢查 |
| [HV-P01-035](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-P01-035&voba=S) | 岩泉 一 | 主要技能情境通過 | `skill-basics.test.js` |
| [HV-D04-004](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-D04-004&voba=D) | 岩泉 一 | 無技能／數值核對 | 官方卡文無技能；數值、卡圖與牌組引用已檢查 |
| [HV-D04-002](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-D04-002&voba=D) | 岩泉 一 | 主要技能情境通過 | `skill-basics.test.js` |
| [HV-D04-011](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-D04-011&voba=D) | 京谷 賢太郎 | 無技能／數值核對 | 官方卡文無技能；數值、卡圖與牌組引用已檢查 |
| [HV-D04-006](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-D04-006&voba=D) | 松川 一静 | 無技能／數值核對 | 官方卡文無技能；數值、卡圖與牌組引用已檢查 |
| [HV-P04-024](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-P04-024&voba=N) | 松川 一静 | 無技能／數值核對 | 官方卡文無技能；數值、卡圖與牌組引用已檢查 |
| [HV-P01-087](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-P01-087&voba=N) | 俺も思った☆ | 主要情境通過 | 本機共用資料：選任一場上及川舉球+1，保存下回合非抽牌加手牌監聽；完整技能後逐張觸發，由效果持有人排順序、受影響玩家選棄牌。；`rules/watch.test.js`／`rules/watch-undo.test.js`／`rules/watch-e2e.js` |
| [HV-P04-088](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-P04-088&voba=S) | ドンピシャ!!! | 主要技能情境通過 | `skill-basics.test.js` |
| [HV-P04-089](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-P04-089&voba=N) | 3年間ありがとう!!! | 主要情境通過 | 本機共用結算：抽牌、指定場上青城三年角色，可選棄牌費用對同一目標追加+2，保留同名限次。；`rules/legacy.test.js`／`rules/legacy-undo.test.js`／`rules/legacy-e2e.js` |
| [HV-P01-088](https://www.takaratomy.co.jp/products/haikyuvobacabreak/cardlist/card.html?no=HV-P01-088&voba=N) | お前達は 強いよ | 主要情境通過 | 本機共用結算：抽0／1張、指定場上青城角色，結算時手牌≤3同一目標追加+1；無變化分支保守停用。；`rules/legacy.test.js`／`rules/legacy-undo.test.js`／`rules/legacy-e2e.js` |

可重跑檢查：node audit-support.js。更新報告：node audit-support.js --write。

原始官方回應與 PDF 保存在本機 work/rules-audit；版本、來源 URL 與 SHA-256 保存在 card-support.json，不將原始整份卡文／Q&A 複製進公開報告。
