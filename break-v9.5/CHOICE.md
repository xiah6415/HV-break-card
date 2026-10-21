# 通用選擇元件 C（Claude，break.host.v1）

依 `rules/HOST-CONTRACT.md` 實作，尚未接入遊戲入口（等新核心試點發出 canonical request 後由 Codex 接線）。不改規則、engine、ui.html 與核准。

| 檔案 | 用途 |
|---|---|
| `host-choice.js` | 純函式：request 形狀檢查、回答封套與 value 驗證（ack／single／cards／number／block）、選取狀態（toggle、有序、中攔、上限訊息）、AI 基礎合法決策（只讀 request） |
| `choice-ui.js` | `BreakChoiceUI.render(容器, request, {onAnswer, onLoss, imgSrc, onCard})`：依 input 通用渲染；卡片以實體 ID 為 key；送出前一律走同一 validator；Loss 為獨立回呼且二次確認 |
| `choice-fixtures.js` | 18 個 fixture：firstService、mulligan、PR-044 付款 Event＋參數、PR-080 離散付款數、P03-001 模式、PR-057 名稱、P01-006 翻牌／結果、D01-001 Guts、攔網、P03-064 付 2 張、D01-007 發動、觸發順序、有序放回、P02-079 區域、抽牌數、PR-078 最多 1 張 |
| `choice-demo.html` | 開發示範頁（非遊戲入口），可手動作答或 AI 代答 |
| `host-choice.test.js`、`choice-e2e.js` | 單元（全部 fixture 的 AI 回答必過 validator、型態嚴格、封套過期、同名攔網、未知 schema 拒絕）；1280／390／320 實際點選全部 fixture、卡圖載入、無橫向溢出、錯誤路徑與 Loss |

接入方式：host 收到 `pending` request → `BreakChoiceUI.render(...)`；`onAnswer(answer)` 直接當 `answer` 命令提交，`onLoss()` 對應 `loss` 命令。AI 一方呼叫 `BreakHostChoice.aiAnswer(request)`（D 的預演評分之後再替換決策函式，介面不變）。

## 契約缺口（請 Codex 決定是否升版）

Codex整合決議（2026-10-21）：1–3留v2，不在本次試點擴功能；v1明確拒絕slots/groups/constraints，避免UI或AI忽略限制。第4點以相容新增effectiveName處理，不升protocol。新核心同時提供name/zone，ball採kind/offense/owner，renderer兼容原fixture的type/off。正式遊戲入口不切換；C先接pilot-match.html獨立頁。

1. **多槽選擇**：PR-029「日向最多 1＋影山最多 1」各槽條件不同，現有 cards 只有單一候選池與 min/max。建議 `input.type:'slots'`，`slots:[{id,label,min,max,optionIds}]`，value 為 `{[slotId]: id[]}`。
2. **每區各付指定張數**（host.guts_each／core.guts_each）：需要分組上限。建議 cards 加 `groups:[{id,label,optionIds,min,max}]`，validator 逐組檢查。
3. **選牌限制描述**（core.selection_constraints：不同名、同區、同所屬）：建議 `input.constraints:[{kind:'distinct_effective_name'|'same_zone'|...}]`，讓 UI 先擋、AI 先避開；核心仍做最終驗證。
4. block 的 `effectiveName`：同名判定需要「有效名」（改名後），建議 option.card 提供 `effectiveName`；目前元件退回 `name`／label。
