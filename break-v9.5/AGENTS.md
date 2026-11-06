# AGENTS.md
- 先讀 `HANDOFF.md`（架構、規則、下一步），再讀 `memory.md`（版本歷史）。
- 動工前在 `memory.md` 追加「計畫」，完成後追加「結果＋測試」；Claude 與 Codex 共用這份紀錄。
- 依使用者2026-11-07指示，按改動範圍驗證：未動到牌局相關功能時，只驗證改動功能及相關回歸，不必跑牌局測試。涉及牌局核心／規則時再跑 `python3 build.py && node fuzz.js && node test.js 300`；相關UI驗證調整 playwright 路徑。
- 不要手改 `index.html`（建置產物）。回覆 Xiah 用中文。
