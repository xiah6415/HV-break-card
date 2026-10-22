# BREAK 目前數字

| 項目 | 數量／清單 |
|---|---|
| 卡片／資料組 | 541／545 |
| 數值模式可組牌 | 541 |
| 嚴格模式可組牌 | 485 |
| 無技能角色 | 183 |
| 共用腳本自動技能 | 295 |
| 舊流程技能（待遷入單一核心） | 7 |
| 未自動化技能 | 56 |
| 原297張池／實際累計開放 | 297／241（含此前2張回收） |
| 已完成節點模組清單 | 25：sequence、deck_selection、numeric、selector、conditional、payment_branch、pay_guts、compare、draw、move、count_compare、retrieve、watch、uniform_affiliation、all、keyword、rename_before_entry、all_result_cards_match、move_self、mill、enter、formal_declaration_cost、ban_action、invalidate_skill、choose_modes |
| 已測參數形態／涵蓋技能卡／資料組 | 554／351／355 |
| numeric／selector／conditional／payment_branch／pay_guts／compare／draw 形態 | 77／152／1／1／16／97／5 |
| move 形態／審查必測項／已修正疑義卡 | 20／14／7（疑義均已裁定；未完成模組／入口維持鎖定） |
| P04-070 範圍裁定／開放狀態 | 本回合持續匹配，含正常及事件效果登場；待protect_numeric_decrease模組 |
| count_compare 形態／依賴技能卡 | 13／45 |
| retrieve 形態／依賴技能卡／分組約束 | 7／40／同區、不同名、共同所屬 |
| watch 形態／依賴技能卡／新增開放 | 26／41／13（登場、加牌、Loss、攔網成功、來源移動） |
| uniform_affiliation 形態／依賴技能卡／新增開放 | 18／33／9 |
| all 形態／依賴技能卡／新增開放 | 1／34／12（子條件逐項反例與短路） |
| keyword 形態／依賴技能卡／新增開放 | 15／31／21（8種效果；未支援入口維持鎖定） |
| rename_before_entry 形態／依賴技能卡／新增開放 | 25／28／25（3張卡文版本疑義維持鎖定） |
| all_result_cards_match 形態／依賴技能卡／新增開放 | 18／21／8（付款、棄牌庫、翻牌結果；空結果不成立） |
| move_self 形態／依賴技能卡／新增開放 | 6／20／1（棄牌、Event放置、牌底、回手） |
| 角色登場監聽形態／依賴卡／新增開放 | 17／18／8（來源於登場當下判定；143個入口局面） |
| mill 形態／依賴技能卡／新增開放 | 6／15／9（己／敵方、精確／最多、實際結果與費用不足） |
| enter 形態／依賴技能卡／新增開放 | 7／14／9（合法候選、Guts／棄牌／手牌、側攔、角色判定值與連鎖） |
| formal_declaration_cost 形態／依賴技能卡／新增開放 | 1／15／10（送棄牌、放Event、付Guts；只計本次付款、完整還原） |
| ban_action 形態／依賴技能卡／新增開放 | 14／16／8（角色、位置、名稱、來源、圖示、印刷值、階段及人數） |
| invalidate_skill 形態／依賴技能卡／新增開放 | 11／11／11（整體技能與關鍵字分開、聯集、改名與已結算保留） |
| choose_modes 形態／依賴技能卡／新增開放 | 1容器／9／9（子效果由既有節點執行；當下檢查有效模式、原索引回答、完整效果說明） |
| Claude 第3節必測局面 | 17項均已納入；P04-098依卡文設為6，P01-082設為7；P02-066部分費用官方未明示，沿用完整不足不扣款 |
| 已支援觸發入口 | 5：event、active、passive:self_entry、permanent_entry_name、passive:character_entry |
| 本組測卡／每卡局面／本次新開 | 241／3＋模式真假、當下數值、階段／目標、換發球、延遲、同名限次與完整Undo／9 |
| 累計路徑前7節點：節點齊備／入口與資料許可 | 31／27（測試前預估） |
| 累計路徑前10節點：節點齊備／入口與資料許可 | 96／88（測試前預估） |
| 累計路徑前13節點：節點齊備／入口與資料許可 | 133／122（測試前預估） |
| 累計路徑前20節點：節點齊備／入口與資料許可 | 225／213（測試前預估，含路徑中入口完成） |
| 累計路徑入口步驟：permanent_entry_name／passive:character_entry | 第15節點後168／第17節點後185（測試前預估） |
| 後續入口步驟 | passive:source_covered、passive:event_played、passive:self_entry_cover |
| 累計路徑下一步預估 | optional：241→243（+2）；再完成protect_numeric_decrease預估→248（待節點與逐卡驗證） |
| 路徑計數起點（不計入前7／10／13／20） | sequence＋deck_selection |
| 新UI選擇形態／逐卡SHA核准／新證據檔／計時紀錄 | 0／0／0／0（沿用既有單選／數量選擇，不新增UI形態） |
