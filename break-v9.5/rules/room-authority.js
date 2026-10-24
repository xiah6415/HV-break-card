/* Trusted browser authority. Never send this checkpoint to a non-authority seat. */
'use strict';
const {Match}=require('./match'),AI=require('../match-ai'),H=require('../host-choice');
const copy=x=>JSON.parse(JSON.stringify(x));
class RoomAuthority{
 constructor({id,decks,players,seed=1,mode='strict',checkpoint,log={}}){
  if(!Array.isArray(players)||players.length!==2||players[0]===players[1])throw Error('INVALID_PLAYERS');
  this.players=[...players];this.log=copy(log);
  const c=checkpoint||{id,decks,seed,mode};
  if(checkpoint&&(c.schema!==1||JSON.stringify(c.players)!==JSON.stringify(players)))throw Error('CHECKPOINT_PLAYERS_MISMATCH');
  this.config={id:c.id,decks:copy(c.decks),seed:c.seed,mode:c.mode};
  this.match=new Match({...this.config,wantsAck:[true,true]});
  if(checkpoint){this.match.epoch=c.epoch;this.match.restore(c.snapshot);}
 }
 apply(uid,cmdId,command){
  if(this.log[cmdId])return copy(this.log[cmdId]);
  const r=this.match.request(0)||this.match.request(1);let ok=false,error=null,preview=null;
  try{
   if(!r||this.players[r.actor]!==uid)throw Error('NOT_YOUR_DECISION');
   if(!['answer','loss','previewBlock'].includes(command?.kind))throw Error('UNSUPPORTED_REMOTE_COMMAND');
   if((['answer','previewBlock'].includes(command.kind)?command.answer?.actor:command.actor)!==r.actor)throw Error('WRONG_SEAT');
   if(command.kind==='previewBlock'){if(r.kind!=='block'||!H.validate(r,command.answer).ok)throw Error('INVALID_PREVIEW');const a=command.answer;if(a.matchId!==r.matchId||a.requestId!==r.requestId||a.epoch!==r.epoch)throw Error('STALE_PREVIEW');preview={requestId:r.requestId,value:copy(a.value),ids:this.match.previewBlockSkills(a.value)};}else this.match.command(command);ok=true;
  }catch(e){error=String(e.message).slice(0,180);}
  const receipt={cmdId,uid,ok,error,...(preview?{preview}:{}),command:copy(command||null),decisionIndex:this.match._m.decisionIndex};this.log[cmdId]=receipt;return copy(receipt);
 }
 aiCommand(){const r=this.match.request(0)||this.match.request(1);return r&&this.players[r.actor]==='AI'?{kind:'answer',answer:AI.answer(this.match,r)}:null;}
 checkpoint(){return {schema:1,...copy(this.config),players:[...this.players],epoch:this.match.epoch,snapshot:this.match.snapshot()};}
 views(term,revision){const out={},r=this.match.request(0)||this.match.request(1);for(let actor=0;actor<2;actor++)if(this.players[actor]!=='AI'){
  const uid=this.players[actor],last=Object.values(this.log).filter(x=>x.uid===uid).at(-1);
  out[uid]=JSON.stringify({term,revision,actor,pendingActor:r?.actor??null,view:this.match.view(actor),receipt:last?{cmdId:last.cmdId,ok:last.ok,error:last.error,...(last.preview?{preview:last.preview}:{})}:null});
 }return out;}
 bundle(term,revision,writer){return {term,revision,writer,matchId:this.config.id,checkpointJSON:JSON.stringify(this.checkpoint()),logJSON:JSON.stringify(this.log),views:this.views(term,revision),updatedAt:Date.now()};}
}
module.exports={RoomAuthority};
