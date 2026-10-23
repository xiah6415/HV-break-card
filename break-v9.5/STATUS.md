# BREAK 目前數字

| 項目 | 數量／清單 |
|---|---|
| 卡片／資料組 | 541／545 |
| 數值模式可組牌 | 541 |
| 嚴格模式可組牌 | 533 |
| 無技能角色 | 183 |
| 共用腳本自動技能 | 343 |
| 舊流程技能（待遷入單一核心） | 7 |
| 未自動化技能 | 8 |
| 原297張池／實際累計開放 | 297／289（含此前2張回收） |
| 已完成節點模組清單 | 44：sequence、deck_selection、numeric、selector、conditional、payment_branch、pay_guts、compare、draw、move、count_compare、retrieve、watch、uniform_affiliation、all、keyword、rename_before_entry、all_result_cards_match、move_self、mill、enter、formal_declaration_cost、ban_action、invalidate_skill、choose_modes、optional、any、equal_fields、result_count、sum_result_parameter、draw_to_hand_size、exchange、each_player_optional_draw、protect_numeric_decrease、phase_jump、enter_self、external_action、shuffle、move_result、reveal_top、simultaneous_entry_group、cover_source_with_guts、force_judgment_failure、parameter_absent |
| 已測參數形態／涵蓋技能卡／資料組 | 587／351／355 |
| numeric／selector／conditional／payment_branch／pay_guts／compare／draw 形態 | 77／153／1／1／16／97／5 |
| move 形態／審查必測項／已修正疑義卡 | 20／14／7（疑義均已裁定；未完成模組／入口維持鎖定） |
| P04-070 範圍裁定／開放狀態 | 本回合持續匹配，含正常及事件效果登場；已開放，來源被覆蓋或離場後保護仍持續到本回合結束 |
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
| optional 形態／依賴技能卡／新增開放 | 2（自己／對手）／7（原297池6）／2；無可執行效果時略過，P02-004對手決定、P02-064不足2張直接歸零 |
| Claude長尾完成節點／參數形態／新增開放 | 7／8／9（any、equal_fields、result_count、sum_result_parameter、draw_to_hand_size、exchange、each_player_optional_draw）；shuffle待主機亂數接線 |
| protect_numeric_decrease 形態／依賴技能卡／新增開放 | 5／7／6（球總值、角色單值／全值、持續匹配；P04-021本批隨source_covered開放） |
| Claude 第3節必測局面 | 17項均已納入；P04-098依卡文設為6，P01-082設為7；P02-066依總則7-7-3完整費用不足不扣款 |
| Claude 第4節入口審查 | 10張審查已整合；source_covered五張及event_played兩張已開放；P03-039依結算當下Event區選費用（含剛打出且仍在場者，屬推論）；P03-047待上限模組 |
| 失效角色手牌技能 | 不再提供發動選項，失效Event仍可打出；seed29卡死修正 |
| 已支援觸發入口 | 8：event、active、passive:self_entry、permanent_entry_name、passive:character_entry、passive:source_covered、passive:event_played、passive:self_entry_cover |
| 本組測卡／每卡局面／本次新開 | 289／3以上；中攔參數不存在一張、6組正式牌桌／15完整Undo邊界／新核心判定與重演／1 |
| 累計路徑前7節點：節點齊備／入口與資料許可 | 31／27（測試前預估） |
| 累計路徑前10節點：節點齊備／入口與資料許可 | 96／88（測試前預估） |
| 累計路徑前13節點：節點齊備／入口與資料許可 | 133／122（測試前預估） |
| 累計路徑前20節點：節點齊備／入口與資料許可 | 225／213（測試前預估，含路徑中入口完成） |
| 累計路徑入口步驟：permanent_entry_name／passive:character_entry | 第15節點後168／第17節點後185（測試前預估） |
| 後續入口步驟 | 本輪指定的source_covered／event_played／self_entry_cover均已完成 |
| source_covered 形態／新增開放 | 5／5（被蓋前位置與新角色有效名／所屬；玩家排序、Guts來源失效免疫、離場後保留、費用與期限） |
| event_played 形態／新增開放 | 3／2（Event本身結算後、手牌打出／效果放置分開、階段／名稱／所屬／來源角色、重複出牌；P03-047待source_skill_maximum） |
| self_entry_cover 形態／新增開放 | 2／2（被蓋前有效名快照、正常／效果登場、中攔／側攔分開、五參數選擇與缺失參數排除） |
| phase_jump 形態／依賴卡／新增開放 | 1／2／2（自己／抽牌階段開頭、同一回合與來球、原窗口取消、原限制保留、後續接球加值） |
| enter_self 形態／依賴卡／新增開放 | 3／5／5（接球／攻擊／側攔、宣告棄牌後身分、限制下玩家可付費／AI拒付無效費用、部分效果繼續結算） |
| external_action 形態／依賴卡／新增開放 | 5／5／4（系統擲幣並確認結果、口號／動作確認、共用亂數checkpoint、預覽不耗亂數；P02-027待parameter_absent） |
| external_action | 動作確認：沿用ack，合法回答true；拒絕在前一層發動選項，本機Undo重演 |
| external_result | 擲幣結果確認：沿用ack，合法回答true；結果由共用RNG產生且不可指定，Undo與預覽不重抽 |
| shuffle 形態／依賴卡／新增開放 | 2／4／4（自己／對手、實體牌Fisher-Yates、先回牌再洗再抽、可選／所屬條件、共用亂數與Undo；0或1張不消耗亂數） |
| reveal_top／move_result 形態／依賴卡／新增開放 | 1＋1／3／3（先按翻牌、公開實際卡、結果確認、同目標加值／選參數、條件與回底提示、空牌庫／失效／期限；全程不耗亂數） |
| 累計路徑下一步預估 | 參數不存在已開放289；printed_parameter預估289→290（+1），待節點與逐卡驗證 |
| 路徑計數起點（不計入前7／10／13／20） | sequence＋deck_selection |
| 新UI選擇形態／逐卡SHA核准／新證據檔／計時紀錄 | 0／0／0／0（沿用既有單選／數量選擇，不新增UI形態） |
| simultaneous_entry_group 形態／依賴卡／檢查點 | 1／2；整組在場後檢查登場觸發，原技能完成後玩家選順序（QA1368–1371／1901–1902） |
| cover_source_with_guts 形態／依賴卡／放置行為 | 1／1；精確姓名Guts作費用、角色身分改變、不產生登場事件、來源被蓋後後排攻擊監聽仍持續本回合（QA1785–1788） |
| force_judgment_failure 形態／依賴卡／判定點 | 1／1；下個對手回合攔網判定時防禦6以下失敗，Event後再計算，One Touch先跳轉；AI不推薦已知失敗組合（QA1310–1311） |
| parameter_absent 形態／依賴卡／範圍 | 1／1；下個對手回合持續匹配中攔，含新登場／替換，參數條件不成立且不計防禦，One Touch仍可使用；組攔預覽按指定中攔排除數值（QA1287–1292） |
