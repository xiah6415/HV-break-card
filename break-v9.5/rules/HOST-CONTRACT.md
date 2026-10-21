# BREAK 主機決策契約 v1（供 claude/generic-choice）

日期：2026-10-21。協定 `break.host.v1`。此契約先提交；新核心試點在另一提交。搭配STATE-CONTRACT。
Claude 的C範圍：依下列schema產生選牌/數量/模式UI與合法AI基礎決策；D腳本預演評分延後。不得更改規則、移動實體卡或新增93張核准。

2026-10-21整合決議：維持v1；`option.card.effectiveName`、name、zone為相容新增的可見資料。核心產生block選項時必須給effectiveName，元件不以label裁定同名。`context.ball`的標準形狀為`{kind,offense,owner}`，元件可相容舊fixture的type/off。多槽slots、cards.groups、cards.constraints改列v2提案，本輪不實作；v1遇到這些尚未支援的限制欄位必須拒絕，不可忽略後核准答案。

## Canonical request / answer

```js
{
  protocol:'break.host.v1', matchId:'m1', requestId:'m1:epoch:decisionIndex',
  epoch:1, revision:12, decisionIndex:4, actor:0, origin:'game'|'kernel',
  kind:'payment_cards', prompt:'選1張手牌', timing:'receive',
  source:{id:'c7',incarnation:1,cardNo:'HV-D01-007'},
  input:{type:'cards',min:1,max:1,ordered:false},
  options:[{id:'c3',value:'c3',label:'角色',card:{id:'c3',incarnation:0,cardNo:'HV-D01-009'}}],
  context:{destination:'self.drop'}, canLoss:true, canManual:false
}
// answer封套；value型態由input決定，不能靠kind或中文label猜測
{matchId:'m1',requestId:'m1:epoch:decisionIndex',epoch:1,actor:0,value:['c3']}
```

- 必填：protocol/matchId/requestId/epoch/revision/decisionIndex/actor/origin/kind/prompt/input/options/canLoss/canManual。timing/source/context 可缺；不存在來源時source=null。
- options 是目前合法候選，不是整個手牌/牌庫；每個id唯一，value為JSON值。必須保留true/false/0/null的差別。
- card只含可見的印刷資訊與實體ref；未翻牌的牌頂不能先放進request的context/options/source。
- `input.type`：ack（value=true）、single（選一個option.value）、cards（value為ID陣列）、number（選合法數量option.value）、block（value={cards:[id],center:id}）。
- cards 的min/max為實際已算妥界線；固定數量min=max。optional不是任意null，必須明示null選項或min=0。ordered=true時順序就是答案的一部分。
- block提供context.block={maxCount,distinctEffectiveNames:true,centerRequired:true}；input.min/max是合法人數，不以預估是否攔得住禁用按鈕。
- UI可依input通用渲染；kind只用於提示、特定展示和除錯。未知input拒絕，不猜答。

## 所有現有Game request

下表「舊answer」是現有engine.js/UI的相容格式；新v1必須使用input列的格式。C可提供legacy adapter，但不能將兩種格式混用。所有single/number均須精確命中options.value。

| kind | input／必要context與選項 | 舊answer | 核心驗證與例子 |
|---|---|---|---|
| firstService | single；context.dice,winner；serve/receive | 'serve'/'receive' | 僅擲骰勝者；擲骰選先發/先接 |
| roll | ack；dice,winner,choice,server | true | 只確認顯示，不重擲骰 |
| mulligan | cards min0/max手牌數；context.role | 手中索引陣列 | ID唯一且在該玩家手牌；先發方先調度 |
| serve | single；合法角色ref | 卡號字串 | 來源hand、發球非dash、登場限制 |
| defend | single；context.ball；receive/block | 字串 | 只有attack來球可攔；不以預估成功作合法性 |
| block | block；context.block,ball；合法攔網角色 | 推薦索引或{cards:卡號[],center:卡號} | 新版只交實體IDs；1中攔＋≤2側攔，不同有效名 |
| ack | ack；context.ball | true | 玩家抽牌確認，通過一次才抽1 |
| receiver | single；ball與合法角色ref | 卡號 | 接球非dash；接不起仍可出牌後喊Loss |
| setter | single；合法角色ref | 卡號 | 不與接球角色有效名相同 |
| attacker | single；合法角色ref | 卡號 | 不與舉球角色有效名相同 |
| event | single；timing；可用卡ref與null；可附canManual | 卡號/null/{__manual:...} | 階段/權限/可結算性在核心；事件放置與技能失效分層 |
| turnEnd | ack；context.outgoing；可canLoss/canManual | true/{__manual:...} | 確認前不交棒；可Loss/Undo |
| lossConfirm | ack；context.reason | true | 已無法繼續的Loss確認；保留已出牌；不可重複Loss |
| skill | single；boolean選項；source/target/need可附 | boolean | 是否付款或發動；D01-007、PR-022等 |
| name | single；context.area/source；有效名選項 | 名稱字串 | PR-057；名單由核心生成，不能自由輸入 |
| target | cards min=max1；context.targetScope | 區域key | 新版實體ref；P01-013；與Kernel同名kind依input統一 |
| parameter | single；合法五參數長名 | srv/blk/rcv/tos/atk | dash排除；PR-044；相容層將短名轉長名 |
| guts | cards min=max需付數；context.areas | 區內索引陣列 | 各區頂角色排除；D01-001 |
| gutsCourt | cards min=max需付數；context.areas | 合併候選索引陣列 | P03-087跨區Guts；明確映射實體，不用卡號定位 |
| discard | single；合法手牌ref | 卡號 | 棄牌者本人選；不能代選對方私手 |
| cost | single；context.destination/source | 卡號 | 舊相容kind；PR-044付款Event放置≠正常打出 |
| retrieve | single；合法來源卡ref/null | 卡號/null | PR-029、P01-006；精確一張或明示不取 |
| summon | single；context.destination；來源卡ref | 卡號 | P01-078；登場與觸發由核心執行 |
| reveal | ack；source；不含未揭露牌頂 | true | P01-006，玩家翻牌動作 |
| revealResult | ack；context.revealed,reason,result | true | 未命中/禁加牌/空牌庫給提示，不暗中跳過 |
| rulesChoice | input來自原始Kernel request；context.nativeKind | 原始可選value | legacy橋接相容kind，不能僅靠label推斷boolean/數量/卡片 |

## 所有現有Kernel request

Kernel native options目前為原始ID/值，canonical options包裝成{id,value,label,card?}；raw型態只在相容邊界存在，不傳給通用UI。

| kind | input／必要context | native合法answer | 驗證與例子 |
|---|---|---|---|
| target | cards；min/max、targetScope | ID陣列 | 單/多/全體由scope決定；P01-013、P03-064 |
| target_count | number；合法0..N | integer | 多目標upto；P03-064；數量不可超候選 |
| payment_cards | cards；count,destination | count個唯一ID | D01-007/PR-044；付款完整且不含來源本體 |
| move_cards | cards；count,destination | count個唯一ID | P01-086；公開區由控制者選，對方手牌由本人選 |
| move_count | number；合法0..N | integer | 最多N張；PR-078；選0不執行移牌 |
| guts | cards；count,areas | count個唯一ID | D01-001；頂角色不能付，側攔來源正確 |
| payment_count | number；allowedCounts | integer | PR-080(2或3)、PR-081(1或2)；不是連續範圍 |
| guts_destination | single；有角色的區域 | serve/block/receive/toss/attack/side:N | P02-079；所選區必須存在角色 |
| parameter | single；target與合法參數 | serve/block/receive/toss/attack | PR-044/P03-045；不得選dash |
| draw_count | number；合法0..可抽數 | integer | upto抽牌；受禁加牌與剩餘張數限制 |
| mill_count | number；合法0..牌庫數 | integer | P02-041等牌頂棄牌；結果須公開/提示 |
| activate_payment | single；boolean；context.payment | boolean | D01-007、Guts被動；拒絕不扣費 |
| optional | single；boolean | boolean | P01-003；拒絕不執行該分支 |
| mode | single；模式描述option | integer選項索引 | P03-001；不能自行組合不同模式 |
| entry_count | number；合法0..N | integer | 技能最多登場N；P04-014 |
| entry | cards；count,destination,asSideBlocker | ID陣列 | P01-078/P02-083；來源與合法名、dash/登場禁令 |
| trigger_order | single；job ID與公開來源 | queue job ID | P04-088與自身被動同時觸發；只選本人待結算job |

這是既有API inventory，不代表所有範例已核准或已整合。93候選一律暫緩；有些例子專供C製作fixture，不能因此取得遊戲執行權限。

## 驗證、取消與重演（適用全部kind）

1. 主機驗證matchId/requestId/epoch/actor與當前pending完全一致；操作者不能代答對手。只有目前決策者收到私密options。
2. 驗證value的JSON型態、option成員、唯一性、數量、順序、當前實體incarnation、zone、條件與費用；canonical單卡single與cards不可互換。
3. 非法回答回傳錯誤並保留原pending；不扣費、不消耗RNG、不增加decisionIndex、不發布事件。重複/過期回答同樣拒絕。
4. Loss是獨立命令，只有canLoss=true可用；legacy {__loss:true}只在舊相容入口轉譯。manual同理轉成命令，不是任意選項value。
5. Undo/同意悔棋恢復完整checkpoint、待續交易及RNG，提升session epoch；舊UI Promise/callback不能再寫狀態。對方回合需請求並由對方同意。
6. 重演按decisionIndex比對kind、actor、input、合法options與已記答案；requestId的epoch允許不同，不能因此改選項。無效前綴立即停止並報錯，不回退第一個選項。
7. 呈現通知（回合/發球/翻牌動畫）在重播時不重發；真正ack/付款/選牌/turnEnd仍按歷史執行。checkpoint中的完整私密狀態不能提供給對手UI/AI。
8. AI基礎決策也走同一validator：cards選足合法ID、number只選allowedCounts、block同名/人數合法、optional可拒絕；未知schema報錯。C不做D的腳本預演評分、不讀對手手牌/真實牌序。

## C元件驗收與整合界線

- 一套元件按input產生單選、多選、精確/最多數量、離散數量、模式、參數與攔網；選滿、取消、空池、有序選牌與錯誤回覆都有fixture。
- 卡牌使用實體ID做key，同卡號多張不可合併付款；顯示cardNo/圖/區域/必要原文。
- 390/320px與橫向手機不溢出、不遮手牌；不靠overflow hidden掩蓋控制項；翻開的牌與未命中提示可見。
- AI與UI均只能回覆schema，不改模型。最低先測PR-044付款Event、PR-080離散付款數、P03-001模式、PR-029多槽、PR-057名稱、P01-006翻牌；後三種實作能力尚未完成時用隔離fixture，不宣稱正式支援。
- 試點入口可能只發Game子集與self-entry request；剩餘kind契約仍固定，後續核心逐步接入。C不能依試點暫時未發出而刪除kind。
- 已認證節點之外的卡不能因UI能顯示就自動核准；B的認證、卡文預期、組合測試與完整指紋仍由核心側決定。
