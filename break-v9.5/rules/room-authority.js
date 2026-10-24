/* Trusted browser authority. Never send this checkpoint to a non-authority seat. */
'use strict';
const {Match}=require('./match'),AI=require('../match-ai');
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
  const r=this.match.request(0)||this.match.request(1);let ok=false,error=null;
  try{
   if(!r||this.players[r.actor]!==uid)throw Error('NOT_YOUR_DECISION');
   if(!['answer','loss'].includes(command?.kind))throw Error('UNSUPPORTED_REMOTE_COMMAND');
   if((command.kind==='answer'?command.answer?.actor:command.actor)!==r.actor)throw Error('WRONG_SEAT');
   this.match.command(command);ok=true;
  }catch(e){error=String(e.message).slice(0,180);}
  const receipt={cmdId,uid,ok,error,command:copy(command||null),decisionIndex:this.match._m.decisionIndex};this.log[cmdId]=receipt;return copy(receipt);
 }
 aiCommand(){const r=this.match.request(0)||this.match.request(1);return r&&this.players[r.actor]==='AI'?{kind:'answer',answer:AI.answer(this.match,r)}:null;}
 checkpoint(){return {schema:1,...copy(this.config),players:[...this.players],epoch:this.match.epoch,snapshot:this.match.snapshot()};}
 views(term,revision){const out={},r=this.match.request(0)||this.match.request(1);for(let actor=0;actor<2;actor++)if(this.players[actor]!=='AI'){
  const uid=this.players[actor],last=Object.values(this.log).filter(x=>x.uid===uid).at(-1);
  out[uid]=JSON.stringify({term,revision,actor,pendingActor:r?.actor??null,view:this.match.view(actor),receipt:last?{cmdId:last.cmdId,ok:last.ok,error:last.error}:null});
 }return out;}
 bundle(term,revision,writer){return {term,revision,writer,matchId:this.config.id,checkpointJSON:JSON.stringify(this.checkpoint()),logJSON:JSON.stringify(this.log),views:this.views(term,revision),updatedAt:Date.now()};}
}
module.exports={RoomAuthority};
