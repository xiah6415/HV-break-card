/* UI scheduling and read-only presentation. Match is the only rules state. */
'use strict';
const {LocalSession}=require('./local-session');
const H=require('../host-choice'),AI=require('../match-ai');
const short=c=>c.replace(/^HV-?/,'');
const fields={srv:'serve',blk:'block',rcv:'receive',tos:'toss',atk:'attack'};
function boardView(view,deckKeys){
 const players=view.players.map((p,idx)=>{
  const court=p.court.map((c,i)=>({...c,key:c.role==='center_blocker'?'block':c.role==='side_blocker'?'side:'+p.court.slice(0,i).filter(x=>x.role==='side_blocker').length:c.role}));
  const area=Object.fromEntries(['serve','block','receive','toss','attack'].map(key=>{const c=court.find(c=>c.key===key);return [key,c?[...c.guts.map(x=>short(x.cardNo)),short(c.cardNo)]:[]];}));
  const parameter=(key,param)=>{const n=court.find(c=>c.key===key)?.parameters[fields[param]||param];return n==='dash'||n==null?null:n;};
  return {idx,deckKey:deckKeys[idx],hand:Array.isArray(p.hand)?p.hand.map(c=>short(c.cardNo)):{length:p.hand.count},deck:{length:p.deck.count},sets:{length:p.sets.count},area,ev:p.event.map(c=>short(c.cardNo)),drop:p.drop.map(c=>short(c.cardNo)),
   court,handRefs:Array.isArray(p.hand)?p.hand:[],top:key=>area[key]?.at(-1)||null,guts:key=>Math.max(0,(area[key]?.length||0)-1),
   ts:{finished:view.match.phase!=='rally',receiver:area.receive.at(-1),setter:area.toss.at(-1),attacker:area.attack.at(-1),rcv:parameter('receive','rcv'),toss:parameter('toss','tos'),atk:parameter('attack','atk'),sides:court.filter(c=>c.role==='side_blocker').map(c=>short(c.cardNo))},parameter};
 });
 return {native:true,mode:view.match.mode,players,rallyNo:view.match.rally,server:view.match.server,firstServer:view.match.server,target:view.ball?1-view.ball.owner:null,turnP:view.match.phase==='rally'?players[view.turn.player]:null,winner:view.match.winner==null?null:players[view.match.winner],ball:view.ball?{type:view.ball.kind,off:view.ball.offense}:null,
  cardName:(p,key)=>p.court.find(c=>c.key===key)?.name||'',parameter:(p,key,param)=>p.parameter(key,param),
  courtTargets:p=>p.court.map(c=>({key:c.key,card:short(c.cardNo)})),roleReference:(p,key)=>{const c=p.court.find(c=>c.key===key);return c?{id:c.id,incarnation:c.incarnation}:null;},cardReference:(p,zone,index)=>zone==='hand'&&p.handRefs[index]?{id:p.handRefs[index].id,incarnation:p.handRefs[index].incarnation}:null};
}
class TableSession {
 constructor(options,callbacks={}){this.local=new LocalSession(options);this.match=this.local.match;this.callbacks=callbacks;this.deckKeys=options.deckKeys;this.aiLevel=options.aiLevel||'normal';this.delay=options.delay??200;this.token=0;this.timer=null;this.noticeIndex=0;this.stopped=true;this.waiting=null;}
 board(){return boardView(this.match.view(0),this.deckKeys);}
 status(){return this.local.status();}
 request(){return this.match.request(0);}
 start(){this.stopped=false;this._drive();}
 stop(){this.stopped=true;this.token++;clearTimeout(this.timer);this.waiting=null;}
 _guard(token,fn){return (...args)=>{if(!this.stopped&&token===this.token)return fn(...args);};}
 _drive(){
  if(this.stopped)return;clearTimeout(this.timer);const token=++this.token;this.waiting=null;
  try{
   const view=this.match.view(0),board=boardView(view,this.deckKeys);this.callbacks.onBoard?.(board,view);
   const notices=view.match.notices;
   if(this.noticeIndex<notices.length){const raw=notices[this.noticeIndex++],data={...raw,...(raw.ball?{ball:{type:raw.ball.kind,off:raw.ball.offense}}:{})};this.callbacks.onNotice?.(board,data,this._guard(token,()=>this._drive()));return;}
   const r=this.match.request(0)||this.match.request(1);if(!r)return;
   if(r.actor===0){this.waiting=r;this.callbacks.onRequest?.(r);return;}
   this.timer=setTimeout(this._guard(token,()=>{try{this.local.command({kind:'answer',answer:AI.answer(this.match,r,{level:this.aiLevel})});this._drive();}catch(e){this._error(e);}}),this.delay);
  }catch(e){this._error(e);}
 }
 _error(e){this.stop();this.callbacks.onError?.(e);}
 submit(command){if(this.stopped||!this.waiting)throw Error('NO_LOCAL_DECISION');this.local.command(command);this._drive();}
 undo(){if(this.stopped||!this.local.undo())return false;this.noticeIndex=Math.min(this.noticeIndex,this.match.view(0).match.notices.length);this._drive();return true;}
}
module.exports={TableSession,boardView};
