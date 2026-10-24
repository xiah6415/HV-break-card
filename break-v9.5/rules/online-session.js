/* 多人牌桌轉接器（Claude 2026-10-25）：介面同 TableSession（start／stop／submit／status／undo／match.previewBlockSkills），
   資料來源改為 FirebaseRooms 的玩家視圖。牌桌一律以「自己＝0 號、對手＝1 號」呈現：自己坐 1 號位時把視圖左右對調，
   request 原樣保留（actor 與信封不變，送出時由權威端驗證）。只讀視圖、不持有權威狀態。 */
'use strict';
const {boardView}=require('./table-session');
const copy=x=>JSON.parse(JSON.stringify(x));
const flip=(v,actor)=>actor===1&&(v===0||v===1)?1-v:v;
function rotateView(view,actor){
 const v=copy(view);if(actor!==1)return v;
 v.players=[v.players[1],v.players[0]];
 if(v.turn&&'player' in v.turn)v.turn.player=flip(v.turn.player,actor);
 if(v.ball&&'owner' in v.ball)v.ball.owner=flip(v.ball.owner,actor);
 for(const k of ['server','winner','firstServer','loser','diceWinner'])if(v.match&&k in v.match)v.match[k]=flip(v.match[k],actor);
 if(Array.isArray(v.match?.dice))v.match.dice=[v.match.dice[1],v.match.dice[0]];
 for(const n of v.match?.notices||[]){for(const k of ['player','winner','server','loser'])if(k in n)n[k]=flip(n[k],actor);if(n.ball&&'owner' in n.ball)n.ball.owner=flip(n.ball.owner,actor);}
 for(const e of v.publicLog||[]){if('player' in e)e.player=flip(e.player,actor);for(const d of e.draws||[])if('player' in d)d.player=flip(d.player,actor);}
 return v;
}
class OnlineSession{
 constructor(client,callbacks={},{deckKeys=['__online_me','__online_opp']}={}){
  this.client=client;this.callbacks=callbacks;this.deckKeys=deckKeys;this.stopped=true;this.noticeIndex=0;this.waiting=null;this.last=null;this.resume=null;this.term=null;
  const self=this;this.match={previewBlockSkills(answer){const m=self.client.core?.match;return m?m.previewBlockSkills(answer):[];}};
 }
 start(){this.stopped=false;if(this.last)this._drive();}
 stop(){this.stopped=true;this.waiting=null;this.resume=null;}
 status(){return {enabled:false,reason:'多人對戰暫不提供 Undo'};}
 undo(){return false;}
 request(){return this.waiting;}
 // FirebaseRooms 的 view 回呼直接交給這裡
 handle(v){
  if(!v||!v.view)return;
  if(this.term!==v.term){this.term=v.term;}
  this.last=v;if(!this.stopped&&!this.resume)this._drive();
 }
 _drive(){
  if(this.stopped||!this.last)return;
  const v=this.last,view=rotateView(v.view,v.actor),board=boardView(view,this.deckKeys);this.waiting=null;
  try{
   this.callbacks.onBoard?.(board,view);
   const notices=view.match?.notices||[];
   if(this.noticeIndex>notices.length)this.noticeIndex=notices.length;
   if(this.noticeIndex<notices.length){
    const raw=notices[this.noticeIndex++],data={...raw,...(raw.ball?{ball:{type:raw.ball.kind,off:raw.ball.offense}}:{})};
    const token={};this.resume=token;
    this.callbacks.onNotice?.(board,data,()=>{if(this.resume!==token)return;this.resume=null;this._drive();});return;
   }
   const r=v.view.request;
   if(r&&r.actor===v.actor&&!this.client.pending){this.waiting=r;this.callbacks.onRequest?.(r);}
  }catch(e){this.callbacks.onError?.(e);}
 }
 submit(command){
  if(this.stopped||!this.waiting)throw Error('NO_LOCAL_DECISION');
  this.waiting=null;
  Promise.resolve(this.client.send(command)).catch(e=>{this.callbacks.onSendError?.(e);if(this.last)this._drive();});
 }
}
module.exports={OnlineSession,rotateView};
