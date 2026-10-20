# GitHub Pages部署交接

> 最新14事件批次已部署 cc81bd2。數值541／嚴格226，共用36＋舊7（既有限制）、未自動化315；公開index與14張卡圖均核對一致。下方較早版本為歷史。

> 2026-10-21權限改造已完成回歸並部署57602b1，公開三尺寸已驗證；最新index SHA256 `37ae5c8c1aa4f510908af48d4ffa21eef6493b665a9175c6e6f847728e4dc77c`。下方舊發布描述為歷史，結果見文末與最新memory。

> 2026-10-21第4步先發／先接選擇已完成回歸，已部署d7723d9並完成18組公開頁操作核對；最新遊戲index SHA256 `d00327a2f0c1fd069496859be4338f6df46cd6aaf60a79ee8e8b743bf67afdff`。下方3fc2023／b5395cc是前批數值模式公開驗證，最新部署結果見文末及memory。

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

## 第4步先發／先接公開部署結果（2026-10-21）
- 實作提交d7723d9e315a3d3c4a0acc75a4fdd718d450f5b3已推送master，Pages built／無錯誤；公開網址https://xiah6415.github.io/HV-break-card/break-v9.5/?v=d7723d9，HTTP200、index 3260448bytes、SHA256 d00327a2f0c1fd069496859be4338f6df46cd6aaf60a79ee8e8b743bf67afdff與已測本機完全一致。
- 公開頁再跑18組開局操作：桌機1280、手機390／320×兩模式×先發／先接／AI勝出，Undo同骰點重選、實際調度與首球提示、80實體及無頁面錯誤／橫向溢出全通過。Chrome模擬，非Safari真機。
- 第4步完成。可組牌數值541／嚴格212，自動技能22共用SHA核准＋7舊流程（部分有限制）不變，14事件未開放。更新交接結果後以純文件提交推送，不改已測index；最後文件提交建置核對記於外層outputs/BREAK-first-service-evidence.json。
- 下一步第5步權限來源改造（完整SHA＋固定舊技能白名單＋無技能），完成後再恢復14有限事件；多人、多人Undo、AI難度延後。

## 第5步權限來源改造公開部署結果（2026-10-21）
- 實作提交57602b14c040d5cf4540afee53efd72da47f5b8c已推送master且Pages built／無錯誤，公開網址https://xiah6415.github.io/HV-break-card/break-v9.5/?v=57602b1；HTTP200、index 3347980bytes、SHA256 37ae5c8c1aa4f510908af48d4ffa21eef6493b665a9175c6e6f847728e4dc77c與已測本機完全一致。
- 公開頁Chrome1280／390／320確認四種來源shared／legacy／basic／unapproved、22／7／183／329數量、卡庫／runtime authority一致、修改playable也無法取得嚴格權限；另驗證兩方數值分享匯入／重載保存、嚴格212、卡圖與開始對戰及無頁面錯誤／溢出。為Chrome手機模擬，非Safari真機。
- 權限改造完成，可組牌數值541／嚴格212，自動技能22共用SHA核准＋7舊流程（既有限制）不變；沒有新增14張核准。最後交接結果以純文件提交推送，最終建置核對保存在outputs/BREAK-authority-evidence.json，不更改已測遊戲index。
- 下一批恢復14有限事件，依結構化資料、完整語意／host／Undo驗證後逐筆寫完整SHA；card-support只補支援說明，不能代替授權。多人、多人Undo與AI難度仍延後。

## 14張有限事件公開部署結果（2026-10-21）
- 實作提交cc81bd249eae54e652e5d65ffa70ecc5499cb84b已推送master且Pages built／無錯誤。公開網址https://xiah6415.github.io/HV-break-card/break-v9.5/?v=cc81bd2，HTTP200、index 3408160bytes、SHA256 41ba6d3d46c943f313628a63a4a5037e93f3f00f820007bf384247d4ff9d4b30與已測本機逐位元組一致。新增14事件卡圖公開HTTP200且各自SHA與本機一致。
- 公開頁Chrome1280／390／320確認數值541／嚴格226、共用36／舊7／無技能183／未自動化315、14事件皆shared且可由橋接處理；卡庫與runtime權限一致、偽造playable不能取得權限。雙方分享匯入／保存、未自動化標記、圖片、開始對戰及無溢出／頁面錯誤通過。Chrome手機模擬，非Safari真機。
- 本批完成：14事件正式自動化，共用36＋7舊流程（既有限制）。最後交接紀錄以純文件提交推送，不改已測index；最後提交／Pages核對保存外層outputs/BREAK-finite-events-evidence.json。下一步依機制家族擴充，家族內優先四校，多人及AI難度延後。
