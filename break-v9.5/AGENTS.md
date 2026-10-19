# AGENTS.md
- 先讀 `HANDOFF.md`（架構、規則、下一步），再讀 `memory.md`（版本歷史）。
- 動工前在 `memory.md` 追加「計畫」，完成後追加「結果＋測試」；Claude 與 Codex 共用這份紀錄。
- 改完：`python3 build.py && node fuzz.js && node test.js 300`；UI 改動再跑 `node e2e.js`（調整 playwright 路徑）。
- 不要手改 `index.html`（建置產物）。回覆 Xiah 用中文。
