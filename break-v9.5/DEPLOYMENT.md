# BREAK v9.5 GitHub Pages

- 入口：https://xiah6415.github.io/HV-break-card/break-v9.5/
- 儲存庫：xiah6415/HV-break-card；Pages 來源：master 根目錄。
- 此資料夾與既有卡牌查詢首頁共存，規則與 UI 沿用使用者提供的 haikyu-v9.5-diagnostic.zip。
- 先讀 HANDOFF.md、AGENTS.md 與 memory.md；變更前後更新 memory.md。
- 修改 ui.html / engine.js / deck-tools.js / undo-tools.js 後，以 python3 build.py 建置，勿直接編輯 index.html。
- 檢查：node deck-tools.test.js、node undo-tools.test.js、node fuzz.js、node test.js 300；UI 改動另依 AGENTS.md 驗證，Undo 改動另跑 node undo-e2e.js（沿用下列 Playwright 環境變數）。
- UI E2E：node e2e.js，需可用的 Playwright 與瀏覽器；可用 PLAYWRIGHT_MODULE 指定模組路徑、PLAYWRIGHT_EXECUTABLE 指定既有瀏覽器，E2E_OUTPUT_DIR 指定截圖目錄。包含桌機、375px 與 320px 手機尺寸、面板收合／調度選牌與完整對戰檢查。
- 正常提交與推送 master 後，GitHub Pages 自動建置；不要使用 force push。
- 初次部署原版 index.html SHA-256：3dd675e47cc4e7f34338b6866c6e96ab00553ca95797d92b3eb31f0b04deec35；後續手機 UI 修正由 ui.html 建置，實際版本以 Git 提交及 memory.md 結果為準。
- 實際部署提交與驗證結果見 memory.md；iPhone Safari 真機結果由使用者補充。
- Undo 與多人連線的同意／拒絕介面、主機同步及隱藏資訊界線見 [UNDO.md](UNDO.md)。目前發布的是 AI 對練 Undo，尚未接入多人連線。
