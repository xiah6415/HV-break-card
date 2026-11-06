/* Trusted browser authority. Never send this checkpoint to a non-authority seat. */
'use strict';
const {Match}=require('./match'),AI=require('../match-ai'),H=require('../host-choice');
const Replay=require('./replay');
const copy=x=>JSON.parse(JSON.stringify(x));
class RoomAuthority{
 constructor({id,decks,players,seed=1,mode='strict',checkpoint,log={},interactiveDraws=false,openingCoin=false}){
  if(!Array.isArray(players)||players.length!==2||players[0]===players[1])throw Error('INVALID_PLAYERS');
  this.players=[...players];this.log=copy(log);this.undoPending=copy(checkpoint?.undoPending||null);
  const c=checkpoint||{id,decks,seed,mode,publishVersion:1,archiveId:crypto.randomUUID().replaceAll('-',''),...(openingCoin?{openingCoin:true}:{}),...(interactiveDraws?{interactiveDraws:true}:{})};
  if(checkpoint&&(c.schema!==1||JSON.stringify(c.players)!==JSON.stringify(players)))throw Error('CHECKPOINT_PLAYERS_MISMATCH');
  this.config={...(c.publishVersion===1?{publishVersion:1,archiveId:c.archiveId}:{}),id:c.id,decks:copy(c.decks),seed:c.seed,mode:c.mode,...(c.openingCoin?{openingCoin:true}:{}),...(c.interactiveDraws?{interactiveDraws:true}:{})};
  this.match=new Match({...this.config,wantsAck:[true,true]});
  if(checkpoint){this.match.epoch=c.epoch;this.match.restore(c.snapshot);}
 }
 publicReplay(){return Replay.build(this.config,this.match,{id:this.config.archiveId});}
 expireUndo(now=Date.now()){if(this.undoPending&&this.undoPending.expiresAt<=now){this.undoPending=null;return true;}return false;}
 _undoIndex(actor){const h=this.match._m.history;for(let i=h.length-1;i>=0;i--)if(h[i].actor===actor)return i;return -1;}
 _turnStartIndex(actor){
  const h=this.match._m.history;let c=this.turnIndexCache;
  if(!c||c.epoch!==this.match.epoch||c.length>h.length)c=this.turnIndexCache={epoch:this.match.epoch,length:0,last:[-1,-1],key:null,match:new Match({...this.config,wantsAck:[true,true]})};
  const mark=()=>{const m=c.match,key=m._m.phase==='rally'?m._m.rally+':'+m._kernel.state.turn.id+':'+m._kernel.state.turn.player:null;if(key!==c.key&&key!==null)c.last[m._kernel.state.turn.player]=c.length;c.key=key;};mark();
  while(c.length<h.length){this._replayEvent(c.match,h[c.length]);c.length++;mark();}return c.last[actor];
 }
 _canTurnUndo(actor){return !this.undoPending&&this.match._m.phase==='rally'&&this.match._kernel.state.turn.player!==actor&&this._turnStartIndex(actor)>=0;}
 _replayEvent(m,e){const r=m.request(0)||m.request(1);if(!r||r.actor!==e.actor)throw Error('UNDO_REPLAY_DIVERGED');if(e.kind==='loss'||e.kind==='manual')m.command({kind:e.kind,matchId:r.matchId,requestId:r.requestId,epoch:r.epoch,actor:r.actor,...(e.kind==='manual'?{action:copy(e.value)}:{})});else{if(r.kind!==e.kind)throw Error('UNDO_REPLAY_DIVERGED');m.command({kind:'answer',answer:H.makeAnswer(r,e.value)});}}
 _replayUntil(index){
  const m=new Match({...this.config,wantsAck:[true,true]});
  for(const e of this.match._m.history.slice(0,index))this._replayEvent(m,e);return m;
 }
 _approveUndo(){const next=this._replayUntil(this.undoPending.targetIndex);next.epoch=this.match.epoch;next.restore(next.snapshot());this.match=next;this.undoPending=null;}
 _undoCommand(uid,cmdId,c){
  const actor=this.players.indexOf(uid);if(actor<0||c.actor!==actor)throw Error('WRONG_SEAT');
  if(c.matchId!==this.match._m.id||c.epoch!==this.match.epoch||this.match._m.phase==='finished')throw Error('INVALID_OR_STALE_COMMAND');
  if(c.kind==='undoRequest'){
   if(this.undoPending)throw Error('UNDO_PENDING');
   if(c.decisionIndex!==this.match._m.decisionIndex)throw Error('INVALID_OR_STALE_COMMAND');
   const wholeTurn=c.scope==='turn';if(c.scope!==undefined&&!wholeTurn)throw Error('INVALID_UNDO_SCOPE');if(wholeTurn&&!this._canTurnUndo(actor))throw Error('NOT_OPPONENT_TURN');let targetIndex=wholeTurn?this._turnStartIndex(actor):this._undoIndex(actor);if(targetIndex<0)throw Error('NO_UNDO_TARGET');
   let m=this._replayUntil(targetIndex),r=m.request(actor);
   while(!wholeTurn&&r?.kind==='target'&&r.input.min===1&&r.input.max===1&&r.options.length===1){let previous=targetIndex-1;while(previous>=0&&this.match._m.history[previous].actor!==actor)previous--;if(previous<0)break;targetIndex=previous;m=this._replayUntil(targetIndex);r=m.request(actor);}
   this.undoPending={id:cmdId,byActor:actor,expiresAt:Date.now()+120000,targetIndex,target:{rally:m._m.rally,turn:m._kernel.state.turn.id,phase:m._kernel.state.turn.phase,kind:r?.kind||this.match._m.history[targetIndex].kind,...(wholeTurn?{scope:'turn'}:{})}};
   if(this.players[1-actor]==='AI')this._approveUndo();
  }else{
   const u=this.undoPending;if(!u||c.undoId!==u.id)throw Error('STALE_UNDO');
   if(c.kind==='undoCancel'){if(actor!==u.byActor)throw Error('WRONG_SEAT');this.undoPending=null;}
   else{if(actor===u.byActor||typeof c.approve!=='boolean')throw Error('WRONG_SEAT');if(c.approve)this._approveUndo();else this.undoPending=null;}
  }
 }
 apply(uid,cmdId,command){
  if(this.log[cmdId])return copy(this.log[cmdId]);
  this.expireUndo();
  const r=this.match.request(0)||this.match.request(1);let ok=false,error=null,preview=null;
  try{
   if(['undoRequest','undoReply','undoCancel'].includes(command?.kind)){this._undoCommand(uid,cmdId,command);ok=true;}else if(command?.kind==='surrender'){const actor=this.players.indexOf(uid);if(actor<0||command.actor!==actor)throw Error('WRONG_SEAT');this.match.command(command);this.undoPending=null;ok=true;}else{
   if(this.undoPending)throw Error('UNDO_PENDING');
   if(!r||this.players[r.actor]!==uid)throw Error('NOT_YOUR_DECISION');
   if(!['answer','loss','previewBlock'].includes(command?.kind))throw Error('UNSUPPORTED_REMOTE_COMMAND');
   if((['answer','previewBlock'].includes(command.kind)?command.answer?.actor:command.actor)!==r.actor)throw Error('WRONG_SEAT');
   if(command.kind==='previewBlock'){if(r.kind!=='block'||!H.validate(r,command.answer).ok)throw Error('INVALID_PREVIEW');const a=command.answer;if(a.matchId!==r.matchId||a.requestId!==r.requestId||a.epoch!==r.epoch)throw Error('STALE_PREVIEW');preview={requestId:r.requestId,value:copy(a.value),ids:this.match.previewBlockSkills(a.value)};}else this.match.command(command);ok=true;}
  }catch(e){error=String(e.message).slice(0,180);}
  const receipt={cmdId,uid,ok,error,...(preview?{preview}:{}),command:copy(command||null),decisionIndex:this.match._m.decisionIndex};this.log[cmdId]=receipt;return copy(receipt);
 }
 aiCommand(){if(this.undoPending)return null;const r=this.match.request(0)||this.match.request(1);return r&&this.players[r.actor]==='AI'?{kind:'answer',answer:AI.answer(this.match,r)}:null;}
 checkpoint(){return {schema:1,...copy(this.config),undoPending:copy(this.undoPending),players:[...this.players],epoch:this.match.epoch,snapshot:this.match.snapshot()};}
 views(term,revision){const out={},r=this.match.request(0)||this.match.request(1);for(let actor=0;actor<2;actor++)if(this.players[actor]!=='AI'){
  const uid=this.players[actor],last=Object.values(this.log).filter(x=>x.uid===uid).at(-1);
  out[uid]=JSON.stringify({term,revision,actor,epoch:this.match.epoch,pendingActor:r?.actor??null,undo:{canTurnRequest:this._canTurnUndo(actor),canRequest:!this.undoPending&&this.match._m.phase!=='finished'&&this._undoIndex(actor)>=0,pending:this.undoPending?{id:this.undoPending.id,byActor:this.undoPending.byActor,expiresAt:this.undoPending.expiresAt,target:copy(this.undoPending.target)}:null},view:this.match.view(actor),receipt:last?{cmdId:last.cmdId,ok:last.ok,error:last.error,...(last.preview?{preview:last.preview}:{})}:null});
 }return out;}
 spectatorView(term,revision){const a=this.match.view(0),b=this.match.view(1);a.players[1]=b.players[1];a.request=null;const statuses=[...(a.statuses||[]),...(b.statuses||[])];a.statuses=statuses.filter((s,i)=>statuses.findIndex(x=>JSON.stringify(x)===JSON.stringify(s))===i);return JSON.stringify({spectator:true,term,revision,actor:0,epoch:this.match.epoch,pendingActor:null,undo:null,receipt:null,view:a});}
 bundle(term,revision,writer){return {term,revision,writer,matchId:this.config.id,checkpointJSON:JSON.stringify(this.checkpoint()),logJSON:JSON.stringify(this.log),views:this.views(term,revision),spectator:this.spectatorView(term,revision),updatedAt:Date.now()};}
}
module.exports={RoomAuthority};
