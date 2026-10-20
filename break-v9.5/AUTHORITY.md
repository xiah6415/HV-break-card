# 自動結算權限來源

組牌與技能執行分開判定。數值模式可組牌541；嚴格模式226＝183無技能＋36共用技能＋7舊技能。315張未自動化技能在數值模式依印刷數值使用，Event由玩家手動處理；不因可組牌而取得自動執行權限。

## 三種開放來源

- shared：rules/approvals.json內每筆profile都必須存在、只有一個已明確選定卡文版本、有技能程序，且完整64位SHA256吻合。核對完整profile，包括程序、費用、限制、印刷資料與其他欄位；不是用profileId中的短指紋授權。
- legacy：rules/legacy-skills.json固定7張，rules/authority.py固定集合再次驗證；每張同樣鎖定profileId與完整profile SHA。保持原本部分效果限制，不代表效果全部完善。與shared重疊、增減白名單或資料變動皆停止建置，需要明確審查後遷移。
- basic：封存資料明確標記NO_SKILL_BASE_DATA，且只有一個profile、無程序／發動／費用／限次，所有代表版本皆為角色。單純把技能程序設空不會被當無技能。

其他卡一律unapproved。card-support.json只提供支援程度與缺口說明；添加條目、把status改為basic或已測試、刪掉既有說明，都不會授予或撤銷執行權限。

## 建置與執行

rules/authority.py一次驗證全部核准，產生共同的authority.cards／counts／sources。孤兒、錯誤／不完整SHA、重複profile、卡文版本未決與shared／legacy衝突都拒絕。library/build.py與rules/build_runtime.py使用同一份判定；runtime會核對library所有來源指紋與完整authority一致，避免只重建其中一份。

card-library.json schemaVersion=2，playable保留嚴格模式的相容顯示值；程式入口讀permission／strictAllowed的凍結副本，不依playable或支援文字授權。runtime只攜帶36個共用完整程序，其餘只有541印刷metadata；authority附在runtime且納入fingerprint。

共用橋接只有shared來源、對應profile、runtime_approved與程序均有效才handles。engine的事件、直接resolveLegacy、改名登場、A-pass與舊影山翻牌分支均檢查legacy來源；未核准卡無法落入舊分支。數值手動路徑明確使用unapproved，不能將手動放Event當成自動結算。

新授權應先完成該機制的語意、host、選擇與Undo驗證，再寫完整SHA的shared核准；不能為快速開卡而添加legacy或改card-support。授權增減會由共同規則推算嚴格卡數，不固定寫死226。4張多卡文版本仍不授權；未自動選一份技能執行。

## 驗證與下一步

node authority.test.js包括獨立暫存建置的25項正反檢查：偽造說明、失效／孤兒／短SHA、固定白名單、來源衝突、刪除技能資料不變基本卡、撤銷核准後嚴格226→225與程序移除、漏重建拒絕；另檢查541張執行來源、凍結權限、修改playable無法放行、兩模式直接舊路徑繞過拒絕。暫存目錄使用原圖唯讀連結，沒有更改真實核准或支援表。

14張有限事件已通過語意、host、Undo及操作測試並寫入完整SHA核准；詳見FINITE-EVENTS.md。下一批按共用機制家族擴充，多人／多人Undo／AI難度延後。
