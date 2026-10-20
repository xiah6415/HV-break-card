# GitHub Pages部署交接

> 2026-10-21第4步先發／先接選擇已完成回歸，正在提交部署；最新遊戲index SHA256 `d00327a2f0c1fd069496859be4338f6df46cd6aaf60a79ee8e8b743bf67afdff`。下方3fc2023／b5395cc是前批數值模式公開驗證，最新部署結果見文末及memory。

日期：2026-10-20。數值模式批次已完成全部回歸、提交推送與公開核對。實作提交`3fc202359d07ec81bc379cb51ad241cb77b6ad38`，Pages built／無錯誤，公開index與本機SHA一致；本文件結果會再以純交接提交推送。前一版871c9cfe2aeab70d389ab55cb7a5dcd648e4756e已built，公開index與本機SHA一致，含Claude分享匯入ac6d6bc及手機／提示修正。

公開遊戲：https://xiah6415.github.io/HV-break-card/break-v9.5/?v=3fc2023

| 指標 | 本批內容 |
|---|---:|
| 數值可組牌（預設）／嚴格可組牌 | 541／212 |
| 共用自動技能／舊流程技能 | 22完整SHA核准／7，仍有部分限制 |
| 未自動化技能 | 329，嚴格拒絕、數值可組牌 |
| 卡庫／資料組／卡圖 | 541／545／541 |
| index bytes | 3258939 |
| index SHA256 | `0f265c1feeb3c02711f85e24496d891230d5854402fa15bb643f33754d8e5bf0` |

目標repo xiah6415/HV-break-card，master；Pages沿用master根目錄legacy建置。git與官方GitHub CLI使用既有xiah6415帳號／ADMIN權限，不強推、不保存token。提交前已重新fetch並檢查遠端，避免覆蓋其他工作。

36單元套件、build、fuzz3000、6組各300對戰、150場新增角色數值對戰與9組桌機手機瀏覽器套件通過；封存14來源／7產物可重建一致。Chrome手機模擬並非iPhone Safari真機。541卡圖在第1步全數公開HTTP200／SHA核對，後續資產清單與圖片不變，本批公開index／代表圖SHA與三尺寸瀏覽器啟動也驗證通過。

Claude分享連結已合併，claude-handoff/已刪除並保留外層bundle備份；手機網子狀態列不黏頂，回合／發球預設1秒自動提示，可改手動，Loss／翻牌仍確認。詳見NUMERIC-MODE.md、REVIEW-PLAN.md及外層outputs/BREAK-numeric-mode-evidence.json。

下一步第4步先發先接選擇，之後第5步權限來源改造，才恢復14事件。沒有新增技能核准、多人或AI難度。

公開頁三尺寸已實測：預設數值／嚴格212切換、雙方分享匯入／重載保存、技能未自動化標記、卡圖及開始對戰，無頁面錯誤或橫向溢出。公開index HTTP200，共3258939bytes。最終純交接提交建置核對見外層outputs/BREAK-numeric-mode-evidence.json；不改本批遊戲指紋。
