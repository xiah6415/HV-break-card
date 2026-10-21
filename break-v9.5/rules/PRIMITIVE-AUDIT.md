# BREAK 效果腳本與動作原語盤點

盤點基準：2026-10-21；297張未自動化技能，排除183無技能、54共用核准與7固定舊流程。這是規劃表，沒有新增核准或更改遊戲。

## 先看結論

- 297/297張已有觸發／條件／費用／選擇／效果／期間的第一版資料，不必重做轉譯；共301個profile，多卡文版本保留。
- 93張沒有已知core／host／review靜態阻塞，可排「沿用現有原語」批次驗證；仍非直接開放。
- 65張只缺host橋接或尚未驗證的操作形態；132張有核心能力缺口；7張先處理卡文／語意疑義（以上互斥）。
- 93張現有能力候選與舊索引一致。先前全庫缺口分類仍包含7張固定舊流程，本次已全部排除，不能把舊host／core數字直接當297張的分組。
- 核心目前有21種動作節點。本報告把需求整理成16個能力家族，仍保留54個底層節點／關鍵字變體（含條件與selector）；16是工作分類，不是宣稱16個已實作原語覆蓋全庫。

## 互斥工作分類

core＝共用效果結算；host＝選牌介面、球場數值及回合流程的串接。所有分類都仍需核對腳本語意。

| 分類 | 卡數 | 下一步 |
|---|---:|---|
| 現有原語＋橋接候選 | 93 | 分批語意／邊界驗證，批次host／Undo／手機回歸 |
| 只缺橋接／形態驗證 | 65 | 補共用選牌、數值投影或回合接點 |
| 有核心能力缺口 | 132 | 新原語／參數能力深度測試後，重跑依賴卡 |
| 卡文／判例／資料語意待確認 | 7 | 先確認規範版本及規則邊界 |

## 觸發入口

階段、觸發事件、來源區域均保留在每個腳本；以下按卡號去重。

| 入口 | 卡數 |
|---|---:|
| active | 13 |
| event | 77 |
| passive:character_entry | 18 |
| passive:event_played | 3 |
| passive:self_entry | 151 |
| passive:self_entry_cover | 2 |
| passive:source_covered | 5 |
| permanent_entry_name:before_entry | 28 |

## 原語家族（卡數可重疊）

被動觸發入口在上表；本表按實際程序節點分組，watch指效果生成的監聽。

| 家族 | 涉及卡數 | 其中現有能力候選 | 底層節點 |
|---|---:|---:|---|
| 流程組合 | 297 | 93 | sequence、conditional、optional、payment_branch |
| 條件與事實查詢 | 166 | 58 | compare、all、any、equal_fields、count_compare、uniform_affiliation、all_result_cards_match |
| 對象／選項選擇 | 187 | 69 | selector、choose_modes、retrieve_slots、each_player_optional_draw |
| Guts付款 | 109 | 46 | pay_guts |
| 移牌與回收 | 116 | 49 | move、move_self、retrieve、move_result、exchange |
| 抽牌與補手牌 | 87 | 30 | draw、draw_to_hand_size |
| 翻牌／檢索／洗牌／牌頂棄牌 | 38 | 0 | deck_selection、reveal_top、reveal_and_retrieve、shuffle、mill |
| 數值與計算式 | 202 | 80 | numeric、printed_parameter、sum_result_parameter、result_count、source_skill_maximum、parameter_absent |
| 技能登場與覆蓋 | 20 | 0 | enter、enter_self、simultaneous_entry_group、cover_source_with_guts |
| 登場前改名 | 28 | 0 | rename_before_entry |
| 生成式監聽 | 38 | 13 | watch |
| 禁止／失效／保護 | 28 | 3 | ban_action、invalidate_skill、protect_numeric_decrease |
| 階段切換 | 2 | 0 | phase_jump |
| 關鍵字 | 31 | 0 | keyword |
| 實體動作與隨機結果 | 5 | 0 | external_action |
| 判定覆寫 | 1 | 0 | force_judgment_failure |

## 能力缺口（卡數可重疊）

「單缺口卡」表示只補這一項便清除已列靜態阻塞，仍需語意／組合驗證。不是預估工作量。

| 層 | 能力 | 影響卡數 | 單缺口卡 |
|---|---|---:|---:|
| core | 非自身登場的角色被動觸發 | 28 | 14 |
| core | 登場前改名、身分與期限 | 28 | 25 |
| host | 多張選牌／數量／多目標介面 | 25 | 5 |
| core | 翻牌／檢索／剩餘牌排序／洗牌 | 24 | 20 |
| host | 技能登場的球場／數值／觸發投影 | 19 | 4 |
| core | 新增事實查詢／覆蓋前角色資訊 | 17 | 9 |
| host | 跨區／指定區Guts選擇 | 15 | 8 |
| host | 牌頂棄牌數量與公開結果 | 15 | 6 |
| host | 技能失效保存與查詢 | 11 | 4 |
| core | 關鍵字：doshat | 10 | 8 |
| host | 固定數值投影 | 10 | 2 |
| host | 關鍵字／跳階段與回合控制銜接 | 10 | 7 |
| host | 效果模式選單 | 9 | 5 |
| host | 新禁止範圍／期限接入動作入口 | 9 | 4 |
| core | 多槽／配對／交換的選牌約束 | 7 | 3 |
| review | 卡文版本／語意待確認 | 7 | 0 |
| host | 新目的區域／牌序／收牌者投影 | 6 | 0 |
| core | 實體動作／擲幣結果與確認 | 5 | 1 |
| core | 關鍵字技能篩選與失效 | 5 | 0 |
| host | 其他監聽事件通知與保存 | 5 | 1 |
| core | 每區各付指定Guts | 4 | 0 |
| host | 每區付款選牌介面 | 4 | 0 |
| host | 多角色／球／跨回合保護 | 4 | 0 |
| core | 同時登場／Guts覆蓋 | 3 | 0 |
| core | 關鍵字：a_pass | 3 | 2 |
| core | 關鍵字：back_attack | 3 | 0 |
| core | 關鍵字：blockout | 3 | 1 |
| core | 雙方分別選擇是否抽牌 | 2 | 0 |
| core | 參數不存在／強制判定失敗 | 2 | 0 |
| core | 關鍵字：feint | 2 | 1 |
| core | 複合來源區域 | 2 | 0 |
| host | 付款數量選單 | 2 | 1 |
| core | 關鍵字：multi_attack | 1 | 0 |
| core | 關鍵字：two_attack | 1 | 0 |
| core | 單一技能加值上限 | 1 | 0 |
| core | 持續對象集合的取樣時點 | 1 | 0 |

## 若補一組能力，可新增多少靜態候選

這是相依分析，並非建議一次實作所有能力；有其他缺口或疑義的卡不算解鎖。

| 能力工作包 | 觸及卡數 | 可新增靜態候選 |
|---|---:|---:|
| 選牌／數量／跨區付款與組合約束 | 53 | 27 |
| 登場前改名與身分期限 | 28 | 25 |
| 非自身登場被動＋新增事實查詢 | 45 | 23 |
| 翻牌／檢索／排序／洗牌＋牌頂棄牌橋接 | 39 | 26 |
| 全部既有核心能力的遊戲橋接 | 108 | 65 |

## 現有能力候選的原語組合

按原語集合分組，不再按完整腳本雜湊或學校拆成近百家族；相同原語集合的順序／條件仍各自保留。

| 卡數 | 原語組合 | 卡號 |
|---:|---|---|
| 8 | draw、move、numeric、payment_branch、selector、sequence | P01-056、P01-091、P02-085、P02-094、P03-052、P03-061、P04-074、P04-077 |
| 5 | numeric、pay_guts、payment_branch、sequence | P01-054、P02-052、P04-049、BP-009、PR-026 |
| 4 | conditional、count_compare、numeric、pay_guts、payment_branch、selector、sequence | P01-016、P04-006、P04-079、PR-048 |
| 4 | move、numeric、pay_guts、payment_branch、retrieve、selector、sequence | P02-002、P02-024、P04-061、P04-066 |
| 4 | compare、conditional、numeric、pay_guts、payment_branch、sequence | P02-012、P02-057、P02-061、P03-075 |
| 4 | compare、conditional、move、numeric、payment_branch、selector、sequence | P03-038、P04-065、D03-002、PR-046 |
| 4 | compare、conditional、move、numeric、pay_guts、payment_branch、selector、sequence | P03-067、P04-018、P04-030、PR-025 |
| 3 | move_self、numeric、selector、sequence | P01-031、P02-011、P02-035 |
| 3 | conditional、count_compare、numeric、selector、sequence | P01-065、P02-014、P02-042 |
| 3 | compare、conditional、move、numeric、pay_guts、payment_branch、retrieve、selector、sequence | P02-073、P03-021、D03-001 |
| 2 | retrieve、selector、sequence | P01-086、P03-089 |
| 2 | conditional、count_compare、draw、numeric、selector、sequence | P02-006、P04-084 |
| 2 | numeric、pay_guts、payment_branch、retrieve、selector、sequence | P02-056、P04-050 |
| 2 | draw、numeric、pay_guts、payment_branch、sequence | P02-071、P03-069 |
| 2 | compare、conditional、retrieve、selector、sequence | P02-099、PR-078 |
| 2 | move、numeric、payment_branch、selector、sequence | P03-026、PR-047 |
| 1 | compare、conditional、draw、pay_guts、payment_branch、sequence | D01-003 |
| 1 | numeric、pay_guts、payment_branch、sequence、watch | D02-001 |
| 1 | all_result_cards_match、conditional、numeric、pay_guts、payment_branch、sequence | D04-001 |
| 1 | conditional、numeric、pay_guts、payment_branch、retrieve、selector、sequence、uniform_affiliation | P01-018 |
| 1 | draw、sequence、watch | P01-057 |
| 1 | compare、conditional、draw、numeric、retrieve、selector、sequence、watch | P01-079 |
| 1 | conditional、count_compare、numeric、pay_guts、payment_branch、retrieve、selector、sequence | P02-017 |
| 1 | compare、conditional、numeric、sequence | P02-021 |
| 1 | draw、move、pay_guts、payment_branch、selector、sequence | P02-025 |
| 1 | draw_to_hand_size、pay_guts、payment_branch、sequence | P02-058 |
| 1 | all_result_cards_match、conditional、numeric、pay_guts、payment_branch、sequence、watch | P02-074 |
| 1 | compare、conditional、draw、move、numeric、selector、sequence、watch | P02-082 |
| 1 | compare、conditional、draw、numeric、selector、sequence、uniform_affiliation、watch | P02-086 |
| 1 | compare、conditional、count_compare、draw、move、retrieve、selector、sequence | P02-092 |
| 1 | compare、conditional、draw、move、numeric、payment_branch、selector、sequence | P02-098 |
| 1 | all、conditional、count_compare、numeric、pay_guts、payment_branch、selector、sequence、uniform_affiliation、watch | P03-003 |
| 1 | conditional、count_compare、numeric、pay_guts、payment_branch、selector、sequence、watch | P03-005 |
| 1 | all、conditional、count_compare、draw、numeric、pay_guts、payment_branch、selector、sequence、uniform_affiliation | P03-007 |
| 1 | conditional、move、numeric、payment_branch、selector、sequence、uniform_affiliation | P03-023 |
| 1 | all、compare、conditional、numeric、protect_numeric_decrease、sequence | P03-041 |
| 1 | move_self、retrieve、selector、sequence | P03-056 |
| 1 | compare、conditional、numeric、pay_guts、payment_branch、retrieve、selector、sequence | P03-071 |
| 1 | conditional、count_compare、draw、numeric、selector、sequence、uniform_affiliation、watch | P03-082 |
| 1 | numeric、sequence、watch | P04-004 |
| 1 | all、all_result_cards_match、compare、conditional、numeric、pay_guts、payment_branch、sequence、sum_result_parameter | P04-007 |
| 1 | conditional、count_compare、move_self、retrieve、selector、sequence | P04-031 |
| 1 | all、compare、conditional、numeric、pay_guts、payment_branch、sequence | P04-053 |
| 1 | all、compare、conditional、move、numeric、pay_guts、payment_branch、selector、sequence | P04-060 |
| 1 | all、all_result_cards_match、compare、conditional、numeric、pay_guts、payment_branch、sequence | P04-063 |
| 1 | draw、move、numeric、pay_guts、payment_branch、selector、sequence | P04-067 |
| 1 | ban_action、conditional、count_compare、draw、selector、sequence | P04-078 |
| 1 | compare、conditional、draw、retrieve、selector、sequence | P04-086 |
| 1 | compare、conditional、draw、numeric、sequence、watch | P04-090 |
| 1 | compare、conditional、numeric、selector、sequence、uniform_affiliation、watch | P04-097 |
| 1 | all、compare、conditional、draw、numeric、selector、sequence、watch | PR-031 |
| 1 | all、compare、conditional、numeric、pay_guts、payment_branch、retrieve、selector、sequence | PR-049 |
| 1 | all、compare、conditional、draw、equal_fields、numeric、selector、sequence | PR-084 |
| 1 | all、ban_action、compare、conditional、numeric、selector、sequence | BP-013 |
| 1 | compare、conditional、draw、numeric、selector、sequence | BP-014 |

## 分級驗證與建議順序

1. 先從93張挑30–50張只用已核准原語及橋接形態的卡；依付款／抽牌／數值／單張回收組合分層，家族內優先四校。這是提案，尚未選定或開工。
2. 每張保留獨立卡文預期與完整profile SHA，跑條件真假、錯階段、費用不足／拒絕、無目標／禁止、精確實體等生成反例；同組共用host／Undo／Loss／手機回歸，避免逐卡重建整套工具。
3. 新原語、新參數形態及已知判例例外才走完整深測；原語修改後重跑所有依賴卡，包含已核准卡。批次失敗可拆出問題卡，其他通過的卡按SHA成批核准。
4. 牌庫公開／私看、非抽牌加牌、Event放置≠打出、角色代次、觸發排序、持續期限等差異保留，不能因標籤同族而抹掉。
5. 每批完成仍提交／推送／部署並回報數值／嚴格可組牌、自動化技能數；本輪僅盤點，遊戲版本保持。

## 表達能力的界線

全profile的Kernel admission通過：162張；沒有已列core缺口：160張；沒有core／host缺口：93張。這些是不同層次，不能把preflight通過稱為整卡可用。
掃描完整program與formal_cost.steps，沿用coverage逐節點阻塞檢查，另檢查多張回收group_constraints（核心目前未讀取）。P01-021、P01-076、P03-088、P03-097四張因此從舊host分類移至core分類；本輪僅列出缺口，尚未修正結算。單張PR-078的single_area約束自然成立，不誤列為核心缺口。原語存在但某些參數／約束未執行也算缺口。未窮舉所有局面，仍可能發現新的語意／橋接問題。
效果腳本JSON保留原始日文／譯文、完整profile指紋、觸發、費用、程序、期間、規則ID及QA追溯ID；QA不是直接綁定卡號的程式分支。尚未將本輪資料標記為已驗證。

## 重現

`node rules/primitive-audit.js /absolute/output-directory`

輸出primitive-audit.json（逐卡＋腳本＋缺口）、primitive-audit.md（本報告）、primitive-cards.md（逐卡工作表）。來源指紋保存在JSON；腳本不修改卡庫／權限／runtime。
