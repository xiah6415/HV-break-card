/* Isolated single-state match pilot. No legacy Game/import/projection dependency. */
'use strict';
const {Kernel}=require('./core');
const runtime=require('./runtime-data.json');
const library=require('../card-library');
const host=require('./host-contract');
const copy=x=>JSON.parse(JSON.stringify(x));
const identity=cards=>JSON.stringify(Object.values(cards||{}).map(c=>[c.id,c.owner,c.cardNo,c.profileId]).sort((a,b)=>a[0].localeCompare(b[0])));
const full=c=>library.card(c).number;
const short=c=>c.replace(/^HV-?/,'');
const prompts={firstService:'擲骰勝者：選擇先發或先接',roll:'確認首球發球方，開始調度',mulligan:'選擇要放回重抽的手牌',serve:'選擇發球角色',defend:'選擇接球或攔網',block:'選擇攔網角色與中攔',ack:'抽牌階段：確認抽1張',receiver:'選擇接球角色',setter:'選擇舉球角色',attacker:'選擇攻擊角色',event:'選擇要使用的卡片，或繼續',turnEnd:'確認結束回合；交棒前仍可喊Loss',lossConfirm:'本球無法繼續，請確認喊Loss',target:'選擇效果對象',activate_payment:'是否支付費用發動效果？',payment_cards:'選擇用來支付費用的牌',move_cards:'選擇要移動的牌',guts:'選擇要支付的Guts',parameter:'選擇要調整的數值'};
const CORE_VERSION='break.match.pilot.1';
const signature=r=>JSON.stringify({actor:r.actor,origin:r.origin,kind:r.kind,input:r.input,options:r.options,context:r.context,source:r.source,canLoss:r.canLoss,canManual:r.canManual});
class Boundary extends Error {constructor(request,state){super('Decision boundary');this.request=request;this.state=state;}}
class Match {
 constructor({id='pilot',seed=1,decks,mode='strict',wantsAck=[true,true]}={}) {
  if(mode!=='strict')throw Error('PILOT_UNSUPPORTED_MODE');
  if(!Array.isArray(decks)||decks.length!==2)throw Error('Two decks required');
  for(const deck of decks){if(deck.length!==40)throw Error('Deck requires 40 cards');if(deck.filter(c=>library.card(c)?.kind==='E').length>8)throw Error('At most 8 Events');for(const c of deck){const grant=library.permission(c);if(!['basic','shared'].includes(grant?.kind))throw Error('PILOT_UNSUPPORTED_SKILL: '+c);}}
  this._kernel=new Kernel({catalog:runtime.catalog,ruleIds:runtime.ruleIds,fingerprint:runtime.fingerprint,mode:'live',practiceDrawBeforeReceive:true});
  this.epoch=1;
  this._kernel.state.match={contractVersion:'break.state.v1',hostVersion:'break.host.v1',id,mode,rulesVersion:runtime.fingerprint,catalogFingerprint:runtime.fingerprint,phase:'setup',seed:seed>>>0,rng:{algorithm:'mulberry32-v1',word:seed>>>0,calls:0},pc:'firstService',rally:0,turnNo:0,server:null,firstServer:null,dice:null,diceWinner:null,firstServiceChoice:null,loser:null,lossReason:null,winner:null,outgoing:null,roleTotals:[{},{}],pending:null,decisionIndex:0,history:[],notices:[],continuation:null,wantsAck:[...wantsAck],setupIndex:0};
  this._m.coreVersion=CORE_VERSION;
  // Same shuffle/dice consumption as old Game; IDs assigned after initial shuffle.
  for(let p=0;p<2;p++){const cards=decks[p].map(c=>library.requirePlayable(c,mode));this._shuffleArray(cards);for(const c of cards)this._kernel.addCard(full(c),p,'deck');}
  this._identity=identity(this._kernel.state.cards);
  let a,b;do{a=1+Math.floor(this._random()*6);b=1+Math.floor(this._random()*6);}while(a===b);
  this._m.dice=[a,b];this._m.diceWinner=a>b?0:1;
  this._pump();
 }
 get _m(){return this._kernel.state.match;}
 _random(){const r=this._m.rng;r.word=(r.word+0x6D2B79F5)>>>0;r.calls++;let t=r.word;t=Math.imul(t^t>>>15,1|t);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;}
 _shuffleArray(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(this._random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}}
 _zone(p,z){return this._kernel.zone(p,z);}
 _code(id){return short(this._kernel.card(id).cardNo);}
 _cards(p,role){const k=this._kernel;return this._zone(p,'hand').filter(id=>k.card(id).printed.type==='character'&&k.card(id).printed.parameters[role]!=='dash'&&this._canEnter(p,id,role));}
 _canEnter(p,id,role){const k=this._kernel,c=k.card(id),other=role==='toss'?k.top(p,'receive'):role==='attack'?k.top(p,'toss'):null;return (!other||k.effectiveName(other)!==k.effectiveName(id))&&k.permission({action:'enter_character',player:p,origin:'rule',role:role==='block'?'center_blocker':role,entryOrigin:'hand',entryCount:1,name:k.effectiveName(id),printed:c.printed}).allowed;}
 _options(values){return values.map((value,i)=>{const c=typeof value==='string'?this._kernel.state.cards[value]:null,labels={serve:'發球',receive:'接球',block:'攔網',toss:'舉球',attack:'攻擊',true:'確認／發動',false:'不發動',null:'不使用，繼續'};return {id:c?value:'option-'+i,value,label:c?c.printed.display_name||c.printed.name:labels[String(value)]||String(value),...(c?{card:{id:value,incarnation:c.incarnation,cardNo:c.cardNo,name:c.printed.display_name||c.printed.name,effectiveName:this._kernel.effectiveName(value),zone:c.zone}}:{})};});}
 _ask(kind,actor,input,values,context={},origin='game',source=null){
  const r={protocol:'break.host.v1',matchId:this._m.id,requestId:this._m.id+':'+this.epoch+':'+this._m.decisionIndex,epoch:this.epoch,revision:this._kernel.state.revision,decisionIndex:this._m.decisionIndex,actor,origin,kind,prompt:context.prompt||prompts[kind]||'請選擇合法選項',input,options:this._options(values),context,source,timing:this._kernel.state.turn.phase,canLoss:this._m.phase==='rally'&&this._kernel.state.stage==='rally'&&actor===this._kernel.state.turn.player&&!['roll','mulligan','lossConfirm'].includes(kind),canManual:false};
  const sig=signature(r);
  if(this._cursor<this._answers.length){const a=this._answers[this._cursor++];if(a.signature!==sig)throw Error('Replay decision diverged: '+kind);return copy(a.value);}
  // A suspended choice is a transaction boundary, not a public mid-operation
  // snapshot; the immutable step baseline + answer tape resumes it atomically.
  throw new Boundary(r,copy(this._kernel.state));
 }
 _native(req){
  const cards=['target','payment_cards','move_cards','guts','entry','revealResult'].includes(req.kind);
  const numbers=['target_count','payment_count','move_count','draw_count','mill_count','entry_count'].includes(req.kind);
  const input=cards?{type:'cards',min:req.count,max:req.count,ordered:false}:numbers?{type:'number'}:{type:'single'};
  const prompt=req.kind==='reveal'?`點擊查看牌庫頂 ${req.top_count} 張`:req.kind==='revealResult'?req.eligible_count?'確認查看的卡片，再選擇加入手牌':'沒有符合的牌；確認後安排放回牌庫':req.ordering?'安排其餘牌的順序（先選的先抽到）':req.kind==='mode'?req.keywordOutgoing?'選擇回球進攻值':'其餘牌放回牌庫頂或底？':null;
  return this._ask(req.kind,req.player,input,req.options,{...(prompt?{prompt}:{}),...(req.count!=null?{count:req.count}:{}),...(req.destination?{destination:req.destination}:{}),...(req.target?{target:req.target}:{}),...(req.payment?{payment:req.payment}:{}),...(req.ineffectiveReason?{ineffectiveReason:req.ineffectiveReason,prompt:req.ineffectiveReason+' 是否仍支付費用？'}:{})},'kernel',req.source?{id:req.source,incarnation:this._kernel.card(req.source).incarnation,cardNo:this._kernel.card(req.source).cardNo}:null);
 }
 _pump(){
  for(let loops=0;loops<2000;loops++){
   if(this._m.pending||this._m.phase==='finished')return;
   const cont=this._m.continuation;
   const baseline=cont?cont.baseline:this._kernel.snapshot();
   const meta={history:copy(this._m.history),decisionIndex:this._m.decisionIndex};
   this._answers=cont?copy(cont.answers):[];this._cursor=0;
   this._kernel.restore(baseline);Object.assign(this._m,meta,{pending:null,continuation:null});
   this._kernel.choose=req=>this._native(req);
   try{this._step();if(this._kernel.state.forcedLoss){const lost=this._kernel.state.forcedLoss;delete this._kernel.state.forcedLoss;this._lose(lost.reason);}else if(this._kernel.state.keywordOutgoing?.turn===this._kernel.state.turn.id&&this._kernel.state.turn.phase==='end'&&this._m.pc!=='turnEnd'){this._kernel.advancePhase('end');this._m.outgoingType='attack';this._next('turnEnd');}else if(this._kernel.state.turn.phase==='draw'&&['blockEvent','blockJudge'].includes(this._m.pc)){this._cleanupSides(this._m.actor);this._next('drawAck');}if(this._cursor!==this._answers.length)throw Error('Unconsumed replay answers');}
   catch(e){if(!(e instanceof Boundary))throw e;this._kernel.restore(e.state);Object.assign(this._m,meta,{pending:e.request,continuation:{baseline,answers:this._answers}});return;}
  }
  throw Error('Match transition limit');
 }
 _next(pc){this._m.pc=pc;}
 _move(id,p,z){this._kernel._atomic(()=>this._kernel._move(id,p,z,this._kernel._context(id,p),'rule'));}
 _setPhase(phase){this._kernel.advancePhase(phase);}
 _notice(type,payload){this._m.notices.push({type,rally:this._m.rally,...payload});}
 _begin(p,phase){
  if(!this._m.turnNo){this._kernel.state.turn={id:1,player:p,phase,step:'free'};}
  else {this._kernel.state.stage='rally';this._kernel.state.turn.step='cleaned';this._kernel.beginTurn(p,phase);}
  this._m.turnNo=this._kernel.state.turn.id;this._m.actor=p;this._m.roleTotals[p]={};
 }
 _lose(reason){this._m.loser=this._m.actor;this._m.lossReason=reason;this._next(this._m.wantsAck[this._m.actor]?'lossConfirm':'lossResolve');}
 _param(p,area){const id=this._kernel.top(p,area);return id?this._kernel.parameter(id,area):0;}
 _probe(fn){const saved=this._kernel.snapshot(),choose=this._kernel.choose;this._kernel.choose=r=>r.count!=null?r.options.slice(0,r.count):r.options[0];try{return fn();}catch(e){if(e.code==='ILLEGAL_ACTION'||e.code==='REQUIRES_REVIEW'&&e.message==='OPEN-EVENT-NO-CHANGE')return false;throw e;}finally{this._kernel.restore(saved);this._kernel.choose=choose;}}
 _playable(p){const k=this._kernel,phase=k.state.turn.phase;return this._zone(p,'hand').filter(id=>{const pr=k.profile(id),a=pr.activation;if(!pr.runtime_approved||!['event','active'].includes(a?.skill_type))return false;if(a.skill_type==='active'&&pr.limit&&k.state.locks.some(l=>l.player===p&&l.turn===k.state.turn.id&&l.name===k.effectiveName(id)))return false;if(!a.activation_phases.includes(phase)&&!(phase==='receive'&&pr.practice_override?.extra_window==='before_receive_judgment'))return false;const result=this._probe(()=>k.card(id).printed.type==='event'?k.playEvent(id):k.useSkill(id));return !!result&&(result.performed||result.invalid);});}
 _event(next){const p=this._m.actor,opts=this._playable(p);if(!opts.length){this._next(next);return;}const id=this._ask('event',p,{type:'single'},[...opts,null]);if(id===null){this._next(next);return;}if(this._kernel.card(id).printed.type==='event')this._kernel.playEvent(id);else this._kernel.useSkill(id);}
 _pick(role,kind,next){const p=this._m.actor,ids=this._cards(p,role);if(!ids.length){this._lose('沒有能'+({serve:'發球',receive:'接球',toss:'舉球',attack:'攻擊'}[role])+'的角色');return;}const id=this._ask(kind,p,{type:'single'},ids);this._kernel.enter(id,role);this._m.roleTotals[p][role]=this._param(p,role);this._next(next);}
 _blockMax(p){const k=this._kernel;return [3,2,1].find(n=>k.permission({action:'enter_character',player:p,origin:'rule',role:'center_blocker',entryOrigin:'hand',entryCount:n}).allowed)||0;}
 _blockLegal(p,answer){const k=this._kernel,ids=answer?.cards;if(!Array.isArray(ids)||!ids.length||ids.length>this._blockMax(p)||new Set(ids).size!==ids.length||!ids.includes(answer.center)||!ids.every(id=>this._cards(p,'block').includes(id)))return false;return new Set(ids.map(id=>k.effectiveName(id))).size===ids.length;}
 _enterBlock(answer){
  const p=this._m.actor,k=this._kernel;if(!this._blockLegal(p,answer))throw Error('Invalid blockers');
  // Normal blockers form one declared group. Validate that new group, rather
  // than comparing its center to the old center that is about to become Guts.
  // Emit all entries before draining, matching simultaneous normal entry.
  k._atomic(()=>{const ids=[answer.center,...answer.cards.filter(id=>id!==answer.center)];
   for(let i=0;i<ids.length;i++){
    const id=ids[i],c=k.card(id),area=i?'side:'+(i-1):'block',count=(k.state.turn.blockEntries?.[p]||0)+1;
    if(!k.permission({action:'enter_character',player:p,origin:'rule',role:i?'side_blocker':'center_blocker',entryOrigin:'hand',entryCount:count,name:k.effectiveName(id),printed:c.printed}).allowed)throw Error('Entry restriction');
    k._move(id,p,area,k._context(id,p),'explicit_entry');c.entryOrigin='hand';c.entryReason='rule';c.entryTurn=k.state.turn.id;
    k.state.turn.blockEntries ||= [0,0];k.state.turn.blockEntries[p]++;
    const event={type:'character_entry',player:p,card:id,character:k.reference(id),role:k.role(id),origin:'hand',phase:'block',window:k.state.turn.id+':block'};
    k._emit(event);k._enqueuePassive(id,event);
   }
   k._drain();
  });
 }
 _cleanupSides(p){for(const z of ['side:0','side:1'])for(const id of [...this._zone(p,z)])this._move(id,p,'drop');}
 _outgoing(){const p=this._m.actor,t=this._m.outgoingType;return {kind:t,owner:p,offense:t==='serve'?this._param(p,'serve'):t==='block'?0:this._param(p,'toss')+this._param(p,'attack')};}
 _step(){
  const p=this._m.actor,k=this._kernel;
  switch(this._m.pc){
   case 'firstService': {const w=this._m.diceWinner,c=this._ask('firstService',w,{type:'single'},['serve','receive'],{dice:this._m.dice,winner:w});this._m.firstServiceChoice=c;this._m.server=this._m.firstServer=c==='serve'?w:1-w;this._m.rollIndex=0;this._next('roll');break;}
   case 'roll': {const i=this._m.rollIndex;if(i<2){if(this._m.wantsAck[i])this._ask('roll',i,{type:'ack'},[true],{dice:this._m.dice,winner:this._m.diceWinner,choice:this._m.firstServiceChoice,server:this._m.server});this._m.rollIndex++;}else this._next('setupDraw');break;}
   case 'setupDraw': {const q=this._m.setupIndex===0?this._m.server:1-this._m.server;k.drawRule(q,6);this._m.setupPlayer=q;this._next('mulligan');break;}
   case 'mulligan': {const q=this._m.setupPlayer,hand=[...this._zone(q,'hand')],ids=this._ask('mulligan',q,{type:'cards',min:0,max:hand.length,ordered:false},hand,{role:q===this._m.server?'serve':'receive'});if(ids.length){for(const id of [...ids].sort((a,b)=>hand.indexOf(b)-hand.indexOf(a)))this._move(id,q,'deck');this._shuffleArray(this._zone(q,'deck'));k.drawRule(q,ids.length);}for(let i=0;i<2;i++)this._move(k.top(q,'deck'),q,'sets');this._m.setupIndex++;this._next(this._m.setupIndex<2?'setupDraw':'rallyStart');break;}
   case 'rallyStart': this._m.phase='rally';this._m.rally++;this._begin(this._m.server,'serve');this._notice('serve',{player:this._m.server});this._next('serve');break;
   case 'serve': this._pick('serve','serve','serveEvent');break;
   case 'serveEvent': this._event('serveDone');break;
   case 'serveDone': this._m.outgoingType='serve';this._next('turnEnd');break;
   case 'defendStart': {const q=1-k.state.ball.owner;this._begin(q,'draw');this._notice('turn',{player:q,ball:copy(k.state.ball)});this._next('defend');break;}
   case 'defend': {if(k.state.ball.kind==='attack'&&this._cards(p,'block').length&&this._blockMax(p)){const c=this._ask('defend',p,{type:'single'},['receive','block'],{ball:copy(k.state.ball)});this._next(c==='block'?'block':'drawAck');}else this._next('drawAck');break;}
   case 'block': {this._setPhase('block');const ids=this._cards(p,'block'),a=this._ask('block',p,{type:'block',min:1,max:Math.min(ids.length,this._blockMax(p))},ids,{block:{maxCount:this._blockMax(p),distinctEffectiveNames:true,centerRequired:true},ball:copy(k.state.ball)});this._enterBlock(a);this._next('blockEvent');break;}
   case 'blockEvent': this._event('blockJudge');break;
   case 'blockJudge': {const n=['block','side:0','side:1'].reduce((n,z)=>n+(k.top(p,z)?k.parameter(k.top(p,z),'block'):0),0);this._m.roleTotals[p].block=n;if(n<k.state.ball.offense){this._cleanupSides(p);this._lose('攔網 '+n+' 小於進攻 '+k.state.ball.offense);}else{k._atomic(()=>{k._emit({type:'block_success',player:p,defense:n});k._drain();});this._cleanupSides(p);this._m.outgoingType='block';this._next('turnEnd');}break;}
   case 'drawAck': if(this._m.wantsAck[p])this._ask('ack',p,{type:'ack'},[true],{ball:copy(k.state.ball)});this._next('drawRule');break;
   case 'drawRule': k.drawRule(p,1);if(k.state.turn.step!=='free')k.advancePhase('draw');this._next('drawEvent');break;
   case 'drawEvent': this._event('receive');break;
   case 'receive': this._setPhase('receive');this._pick('receive','receiver','receiveEvent');break;
   case 'receiveEvent': this._event('receiveJudge');break;
   case 'receiveJudge': {const n=this._param(p,'receive');this._m.roleTotals[p].receive=n;if(n<k.state.ball.offense)this._lose('接球 '+n+' 小於來球 '+k.state.ball.offense);else this._next('toss');break;}
   case 'toss': this._setPhase('toss');this._pick('toss','setter','tossEvent');break;
   case 'tossEvent': this._event('attack');break;
   case 'attack': this._setPhase('attack');this._pick('attack','attacker','attackEvent');break;
   case 'attackEvent': this._event('attackDone');break;
   case 'attackDone': this._m.roleTotals[p].toss=this._param(p,'toss');this._m.roleTotals[p].attack=this._param(p,'attack');this._m.outgoingType='attack';this._next('turnEnd');break;
   case 'turnEnd': {const base=this._outgoing(),out={...base,...k.outgoing(base.kind,base.offense)};if(this._m.wantsAck[p])this._ask('turnEnd',p,{type:'ack'},[true],{outgoing:copy(out)});this._m.outgoing=copy(out);k.endTurn();k.state.ball=out;this._next('defendStart');break;}
   case 'lossConfirm': this._ask('lossConfirm',p,{type:'ack'},[true],{reason:this._m.lossReason});this._next('lossResolve');break;
   case 'lossResolve': {this._cleanupSides(p);k.loss(p,{voluntary:false});k.finishLoss();this._m.phase='loss';this._notice('loss',{player:p,reason:this._m.lossReason,winner:1-p,final:!this._zone(p,'sets').length});if(!this._zone(p,'sets').length){this._m.winner=1-p;this._m.phase='finished';this._next('done');}else this._next('interval');break;}
   case 'interval': {this._m.phase='interval';for(let q=0;q<2;q++)k.drawRule(q,Math.max(0,6-this._zone(q,'hand').length));this._move(k.top(p,'sets'),p,'hand');this._m.server=1-p;this._next('rallyStart');break;}
   default: throw Error('Unknown match pc '+this._m.pc);
  }
 }
 request(actor){if(!this._m.pending||this._m.pending.actor!==actor)return null;return copy(this._m.pending);}
 command(command){
  if(command?.kind==='answer')return this.dispatch(command.answer);
  if(command?.kind!=='loss')throw Error('UNSUPPORTED_COMMAND');
  const r=this._m.pending;
  if(!r||!r.canLoss||command.matchId!==r.matchId||command.requestId!==r.requestId||command.epoch!==this.epoch||command.actor!==r.actor)throw Error('INVALID_OR_STALE_COMMAND');
  const baseline=this.snapshot();
  try{
   this._m.history.push({kind:'loss',actor:r.actor,origin:'game',signature:signature(r),value:{loss:true}});this._m.decisionIndex++;
   this._m.loser=r.actor;this._m.lossReason='主動 Loss（放棄這球）';this._m.pending=null;this._m.continuation=null;this._next('lossResolve');this._pump();return this.view(r.actor);
  }catch(e){this._kernel.restore(baseline);throw e;}
 }
 dispatch(answer){const r=this._m.pending;if(!host.validateAnswer(r,answer)||answer.epoch!==this.epoch||r.input.type==='block'&&!this._blockLegal(r.actor,answer.value))throw Error('INVALID_OR_STALE_ANSWER');const baseline=this._kernel.snapshot();try{const a={signature:signature(r),value:copy(answer.value)};this._m.history.push({kind:r.kind,actor:r.actor,origin:r.origin,...a});this._m.decisionIndex++;this._m.continuation.answers.push(a);this._m.pending=null;this._pump();return this.view(answer.actor);}catch(e){this._kernel.restore(baseline);throw e;}}
 snapshot(){return this._kernel.snapshot();}
 restore(snapshot){
  const m=snapshot?.match;
  if(m?.id!==this._m.id||m?.contractVersion!=='break.state.v1'||m.hostVersion!=='break.host.v1'||m.coreVersion!==CORE_VERSION||m.mode!==this._m.mode||m.seed!==this._m.seed||m.catalogFingerprint!==runtime.fingerprint||m.rulesVersion!==runtime.fingerprint)throw Error('Snapshot match/contract mismatch');
  if(identity(snapshot.cards)!==this._identity)throw Error('Snapshot physical identity mismatch');
  if(!m.rng||m.rng.algorithm!=='mulberry32-v1'||!Number.isSafeInteger(m.rng.calls)||m.rng.calls<0||m.rng.word!==((m.seed>>>0)+Math.imul(m.rng.calls,0x6D2B79F5)>>>0)||m.decisionIndex!==m.history?.length||!['setup','rally','loss','interval','finished'].includes(m.phase)||m.pending&&!host.validateRequest(m.pending))throw Error('Invalid match checkpoint');
  this._kernel.restore(snapshot);this.epoch++;if(this._m.pending){this._m.pending.epoch=this.epoch;this._m.pending.requestId=this._m.id+':'+this.epoch+':'+this._m.decisionIndex;}return this;
 }
 view(actor){if(![0,1].includes(actor))throw Error('Unknown viewer');return {...this._kernel.view(actor),match:{id:this._m.id,phase:this._m.phase,rally:this._m.rally,server:this._m.server,winner:this._m.winner,dice:copy(this._m.dice),decisionIndex:this._m.decisionIndex},request:this.request(actor)};}
}
module.exports={Match,signature};
