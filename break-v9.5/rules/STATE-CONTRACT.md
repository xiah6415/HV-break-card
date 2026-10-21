# BREAK 單一核心狀態契約 v1

日期：2026-10-21。狀態：A+B 試點契約；正式遊戲尚未切換。搭配 HOST-CONTRACT.md。
本文件先提交給 Claude/Codex 共用。v1 相容欄位可新增；改變答案語意、區域順序、事件順序或亂數消耗須升版，不得靜默修改。

## 所有權與入口

- `rules/match.js`（本輪新增的隔離試點入口）擁有持續存在的 Kernel；完整可變狀態只放在 `kernel.state`。
- `state.match` 是完整對局流程資料，`state.turn`／`zones`／`cards`／`effects`／`queue` 是同一物件的結算資料。兩個不同層次分別表示完整對局與技能結算，不互相複製。
- engine/UI/AI 只接收深複製、依玩家裁切的 view 與 request，提交命令；不得寫 `players.hand/area/ts/effects/restrict` 副本再投影回核心。
- 舊 Game 只作獨立比對 oracle。試點不匯入 Game 的牌桌狀態、不呼叫 legacy.transaction、不把新核心結果寫回 Game。
- 初始化局部陣列、唯讀 view、Undo checkpoint 與隔離預演快照不是第二份可寫正式牌桌；它們不得直接提交結果。

## 可保存狀態

```js
{
  version: 1, fingerprint, executionMode, rulesOptions,
  revision, next,
  cards: { [id]: { id, owner, cardNo, profileId, printed, zone, incarnation } },
  zones: { '0.deck': [id], '0.hand': [id], /* player 1 likewise */ },
  turn: { id, player, phase, step, blockEntries },
  stage, effects: [], queue: [], locks: [], ball,
  decisions: [], events: [], publicLog: [],
  match: {
    contractVersion: 'break.state.v1', hostVersion: 'break.host.v1',
    id, mode, rulesVersion, catalogFingerprint, phase,
    seed, rng: { algorithm: 'mulberry32-v1', word, calls },
    pc, rally, server, firstServer, dice, diceWinner, firstServiceChoice,
    loser, lossReason, winner, outgoing, roleTotals,
    pending, decisionIndex, history: [], notices: [],
    continuation: null
  }
}
```

- `id` 指實體卡，不是卡號；同卡號多張必須可分辨。`incarnation` 在角色身分失效／重建時變動，效果綁定 `{id, incarnation}`。
- 區域：`deck/hand/drop/event/sets/serve/block/receive/toss/attack/side:0/side:1`。陣列尾是牌頂／最上方角色，`deck_bottom` 轉成 deck 索引 0；側攔獨立區域。
- hand 是有序實體 ID；禁止以卡號去重來實際付款。選項可為閱讀便利合併，但 answer 必須還原確定實體。
- 數值由印刷資料與當前有效 effects 計算；不得另存會被逐次累加的投影副本。`roleTotals` 僅保存判定/回球所需的歷史結果，與即時角色數值的用途不同。
- effects 保存來源、目標代次、控制者、持續期限與生效回合；queue 保存觸發事件、來源、控制者、程序與順序。
- `pending` 是目前唯一可回答的 request；`continuation` 若使用決策重演，保存不可變 transaction baseline、已答 request/answer 與目前 pc，不含 Promise、callback、DOM 或函式。
- `revision` 用於模型狀態；對外 session epoch 在 restore/Undo 後必須提升，不得因還原舊 revision 而接受舊回覆。
- `match.phase`：setup/rally/loss/interval/finished；現有 `stage` 是技能結算階段 rally/loss_triggers/interval。全域 match.phase 決定能否開始一球；stage 決定能否結算技能，兩者需有明確一致性檢查。

## 命令

| 命令 | 輸入與合法性 | 狀態結果 |
|---|---|---|
| createMatch | matchId、seed、mode、兩副40張牌組；Event≤8；核對 authority | 建立80實體、洗牌、擲骰，產生第一個 request |
| answer | HOST-CONTRACT 的回答封套；完全符合目前 pending | 執行至下一個決策或對局結束 |
| loss | actor=current player 且 pending.canLoss；取消待續回覆 | 進入明確 Loss 確認/結果與換局流程，不偷跳發球 |
| manual | 只在 numeric 且 request.canManual；adjust/ball/draw/discard | 同一核心驗證與移牌，記錄 origin=manual；可Undo |
| requestTakeback | actor、目標 decisionIndex、epoch | 暫停後續回答，等待對方同意 |
| resolveTakeback | requestId、responder、boolean、epoch | 拒絕則續原局；同意則還原並提升 epoch |
| restore | 版本、matchId、catalog/policy/核心版本一致的 checkpoint | 驗證80實體與程序游標後原子還原；舊回覆失效 |

試點可只實作 createMatch/answer/snapshot/restore 子集；未實作命令必須回報 `UNSUPPORTED_COMMAND`，不得當成功或靜默略過。E 的7張舊技能在真正遷移前拒絕，不以數值模式偷渡嚴格技能。

## 完整流程與提交邊界

1. 洗兩副牌 → 擲骰（平手重擲）→ 勝者選先發／先接 → 發球方先調度 → 各抽6、任選調度、各置2張set card。
2. 本球發球提示 → 發球角色登場 → 登場觸發 → 自由步驟 → 判定/結束回合。
3. 對方接來球：attack 可選攔網或接球；serve/block回球只能接球。
4. 攔網：不抽牌；合法中/側攔先登場，處理觸發/自由步驟，才算成敗；低印刷值不禁止嘗試。
5. 接球：抽1與抽牌窗口 → 接球登場/觸發/自由步驟/判定 → 舉球 → 攻擊 → 明確結束回合。
6. 無法繼續也保留可見已出牌，等待真人喊Loss；結果提示後補手至6、失分方取1張set card、得分方發球；無set card可取則敗。
7. 場上角色/Guts跨球保留；側攔與期限效果依結算點清理；原先「抽牌事件接球前可開」選項仍是明示 rulesOptions。

通知是呈現事件，不應額外消耗規則決策；ack/turnEnd/lossConfirm 等真正玩家確認是 request，必須可重演。規則判定不依賴 UI 動畫是否播放。
付款/選牌中的 Loss/Undo 需保留先前已提交選擇、取消未提交分支與舊回覆；不得在移入核心時縮減使用者既有的可喊Loss時機。試點未涵蓋的中途取消路徑需明列，不得宣稱全遷移完成。

## 事件

共用封套 `{type, matchId, revision, index, actor, visibility, payload}`；同一已提交事件只送出一次。重演/預演不再對外發布。

| 類型 | 必要 payload | 公開性/時序 |
|---|---|---|
| match_started/dice_rolled/service_chosen | seed政策、骰點、勝者/發球方 | 洗牌後擲骰；seed及牌序不得提供對手view |
| card_moved | id、from、to、origin、reason | 隱藏區域對外遮蔽ID/卡號；資料層保留完整記錄 |
| cards_drawn | player、count、ids | 抽牌者看卡；對方只看數量；draw不誤觸非抽牌加牌監聽 |
| card_revealed/reveal_acknowledged | id、cardNo、source、eligible、reason | flip前request不帶牌頂；flip後公開結果；無目標置底並說明 |
| character_entered | ref、role、origin、controller | 真正登場才觸發；同次通知冪等，不因其他移牌重新觸發 |
| effect_registered/expired/trigger_queued/resolved | effect/job ID、source、duration | 依回合玩家優先與玩家排序；避免重複支付 |
| phase_changed/turn_started/turn_ended | from/to、player、ball | 先觸發再判定；未按turnEnd不得交棒 |
| loss_confirmed/interval_started/match_finished | loser、reason、server、winner | Loss確認後才補牌/下一球；勝負全局只提交一次 |
| decision_requested/answered/takeback | requestId、kind、actor、epoch | 私密選項只交給決策者；重演不重發副作用 |

## 亂數與重播

使用與現有engine相同 mulberry32：word 初值 `seed >>> 0`，每次抽樣先加 `0x6D2B79F5` 再做既有整數混合，calls加1。以Fisher-Yates從陣列尾至1洗牌；先0號再1號牌組，之後才擲骰。
checkpoint 必須包含 word/calls，不只seed。預覽與AI預演只用隔離快照，不能前進正式rng。還原後下一抽樣、下一張牌及決策必須一致。
保存版本/核心/資料指紋不相容時拒絕續局；試點先保留舊版重播器，正式切換需另做舊紀錄政策。

## 試點驗收與未完成範圍

- 一局固定seed的完整真實40張對戰：比對骰點/調度/每個決策/卡牌區域與順序/角色值/來球/回合/發球/換局/勝負；新核心不得呼叫舊Game來執行規則。
- 至少驗證snapshot從中途重演至結束、亂數還原、非法及過期answer不改狀態、80實體與所有權守恆。
- 技能支援必須逐項實際觸發；沒有跑到的54共用、7舊技能、全部Undo中斷及手機UI不得列作已遷移。
- 公開遊戲繼續使用已驗收舊入口；試點不更改UI或新增93張候選核准。後續B認證必須綁核心/契約版本與完整profile指紋。
