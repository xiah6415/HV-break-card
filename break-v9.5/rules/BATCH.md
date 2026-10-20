# 用索引批次驗證候選

索引供開發時選批次，執行核心仍讀結構化程序。這兩層不等於技能核准，也沒有改變正式47卡庫或公開頁。

## 重建及整批執行

在break-v9.5執行：

```sh
node rules/batch-index.js > /tmp/break-index.json
node rules/batch-smoke.js > /tmp/break-smoke.json
node rules/batch-smoke.js --conditions > /tmp/break-conditions.json
node rules/batch-index.test.js
node rules/batch-smoke.test.js
node rules/batch-conditions.test.js
```

索引包含545資料組，可按category、phase、tag、polarity、mechanism、rule、runtime及family查詢。同欄位多值是OR，跨欄位是AND；不存在的詞得到空集合，錯誤欄名會報錯。phase表示明示宣告／自身登場入口，不表示後續監聽作用階段，也不自動包含對練額外接球前窗口。

```js
const {buildIndex,query}=require('./rules/batch-index');
const {runBatch}=require('./rules/batch-smoke');
const index=buildIndex();
const filters={category:'reuse_candidate',phase:['receive','toss'],mechanism:'pay_guts'};
console.log(query(index,filters).map(id=>index.profiles[id].card_no));
const result=runBatch({index,filters});
const withConditions=runBatch({index,filters,conditioned:true});
```

query可查全庫；runBatch只接reuse_candidate，拒絕把已核准或缺機制的資料混入候選測試。來源檔案或完整profile指紋不同會拒用舊索引。profile_sha256與approvals.json的Python排序／空格／Unicode格式相同，供後續明確核准時核對；工具不寫入approvals。

## 家族與測試缺口

目前125候選分110家族。家族以完整activation、formal_cost、limit、program、practice_override及flags的結構分組，去除追溯註記，僅抽象整數幅度（保留正／零／負）及名稱／所屬／年級清單值。保留順序、條件運算、角色、目標量詞、期限、權限範圍與各清單長度。

同家族可共用測試樣本，但不同數量、名稱或年級仍須驗證；家族不是兩卡等價的證明。每個profile另保留不抽象值的contract_sha256和完整profile_sha256。同家族已有核准卡會列在approved_witnesses，便於沿用局面。

批次使用五種局面：資源充足／選前項、資源充足／選後項、拒絕可選分支、缺資源、禁止技能加手牌。每個入口階段均測雙方玩家，呼叫實際playEvent／useSkill／enter入口；測失敗原子還原、成功重演同狀態、實體守恆，以及結束回合／Loss清理。

原五局面基準保留：125候選、1,530局面，1,374次宣告／登場完成、156次無變化Event宣告被保守拒絕、0執行錯誤。119張至少完成一次宣告／登場，其中96張至少一次被核心回報技能動作生效（仍可能只付款，不能證明全部後段）；其餘23張只完成登場／宣告，另6張全為無變化Event。基準有65張未走到動作、61張條件真假未齊，聯集73張。

現在加上`--conditions`，工具會為上述29張追加234局面（全部入口階段、雙方、條件成立／拒絕可選／禁加牌），合計1,764局面：1,602次完成、162次無變化Event保守拒絕、0執行錯誤及0建構缺口。125張至少一次回報技能動作；39張仍有未走到動作、46張條件真假未齊，重疊36／聯集49張。這些數字不包含獨立102項效果／反例測試的額外分支，不能當完整覆蓋。

`batch-fixtures.js`只在sandbox建立條件局面：從原印刷資料找出指定名稱／所屬／年級／位置／圖示的真實卡片，建立Event數量、不同名棄牌、精確Guts、手牌／得分門檻及技能登場原因。條件反映Event已正常放入後的計數、角色離開手牌後的張數，不改任何印刷身分，不按卡號加效果。無法表示的篩選／數量回報FIXTURE_GAP；不能把建構失敗當核心壞掉或當通過。這是局部測試狀態，不是完整40張牌組或正式匯入。

`batch-conditions.test.js`另以封存日文卡文人工寫出的預期結果，測29張所有入口階段及雙方：精確數值／抽牌／回收／Guts、同一實體後段加值、主動技能來源棄置、Event區容納角色牌、1年Guts而非場上角色，以及不成立門檻／缺複合費用不先扣手牌。另真的觸發百澤後續加值、和久谷南下回合接球−2／−3、發球造成接球登場禁止及宮治的防降，共102項。沒有發現需修改核心的錯誤。

- `status: sandbox_smoke_pass`只表示至少一次結算成功且本批無錯誤，不代表卡文語意驗證。
- `skill_performed`取核心技能回傳值，與角色登場本身分開；true仍可能只付款／移牌，不表示所有預期加值已測到。
- `status: inert_in_all_probes`在原基準有六張；啟用條件局面後為0，原6張及其餘23張均測到技能動作。
- `outcome`保留實際新效果、加手牌事件與實體區域移動，不只保留核心的performed布林值。
- `fixture_gap`表示建構器尚不能表達局面；單獨計數，原始錯誤保留。
- 任何一個局面有建構缺口，該profile標為`needs_fixture_work`，不列入sandbox_smoke_pass；它與真正執行錯誤分開。
- `unvisited_action_nodes`是未觀察到執行嘗試的動作；已觀察亦可能只是付款可行性探測或最後回滾的交易，不代表成功套用。
- `missing_condition_outcomes`列出條件缺的true／false結果；未觸發的監聽後段也會留下缺口。
- `needs_probe_review`表示真錯誤或局面不足引起的錯誤，保留原code／message，不能直接當成卡文錯誤。測試有注入故障驗證這條報告路徑。

下一輪依剩餘49張的動作／條件缺口分組處理，並接全庫數值／圖片／組牌匯入。正式核准22／卡庫47不變；尤其來源由技能登場的情境，只驗證core入口，不表示host已能用其他技能叫出該角色。全庫卡文／QA、延期監聽、組合、host投影、手機選擇與完整Undo仍須相應驗證；不以本工具直接核准125張。這次節省的是測試準備及重複執行，沒有測得開發工時倍數，也未宣稱遊戲執行加速。
