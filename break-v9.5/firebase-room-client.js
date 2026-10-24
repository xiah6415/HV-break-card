/* Firebase transport: clients read their own view and submit only commands. */
const VERSION='13.1.0',base='https://www.gstatic.com/firebasejs/'+VERSION+'/';
export async function firebaseServices(){
 const [App,A,D]=await Promise.all([import(base+'firebase-app.js'),import(base+'firebase-auth.js'),import(base+'firebase-database.js')]);
 const emulated=['localhost','127.0.0.1'].includes(location.hostname)&&new URLSearchParams(location.search).get('emulator')==='1';
 const config=emulated?{...BREAK_FIREBASE_CONFIG,projectId:'demo-break-multi',authDomain:'localhost',databaseURL:'https://demo-break-multi.firebaseio.com'}:BREAK_FIREBASE_CONFIG;
 const app=App.initializeApp(config),auth=A.getAuth(app),db=D.getDatabase(app);
 if(emulated){A.connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});D.connectDatabaseEmulator(db,'127.0.0.1',9000);}
 return {A,D,auth,db};
}
const code=()=>Array.from(crypto.getRandomValues(new Uint8Array(8)),n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%32]).join('');
const connection=()=>crypto.randomUUID();
export class FirebaseRooms{
 constructor(services,callbacks={}){Object.assign(this,services);this.cb=callbacks;this.room=null;this.user=null;this.online=false;this.connection=null;this.stops=[];this.generation=0;this.core=null;this.rev=-1;this.log={};this.work=Promise.resolve();this.busy=false;this.pending=null;this.lastView=null;}
 ref(path){return this.D.ref(this.db,path);}
 async login(user,name){await this.leave();this.user=user;this.name=(name||user.displayName||'匿名玩家').trim().slice(0,40)||'玩家';
  this.stops.push(this.D.onValue(this.ref('.info/connected'),snap=>{this.online=snap.val()===true;this.cb.connection?.(this.online);if(this.online)this._connected().catch(e=>this.error(e));else{this.generation++;this.core=null;}}));
  this.stops.push(this.D.onValue(this.ref('lobby'),s=>this.cb.lobby?.(s.val()||{}),e=>this.error(e)),this.D.onValue(this.ref('presence'),s=>this.cb.presence?.(s.val()||{}),e=>this.error(e)));
 }
 async _connected(){
  this.connection=connection();const path='presence/'+this.user.uid+'/'+this.connection;await this.D.onDisconnect(this.ref(path)).remove();await this.D.set(this.ref(path),{name:this.name,at:this.D.serverTimestamp()});
  if(this.room){await this._roomPresence();await this._inspectLease();}
 }
 async _roomPresence(){if(!this.online||!this.connection||!this.room)return;const r=this.ref('rooms/'+this.room+'/presence/'+this.user.uid+'/'+this.connection);await this.D.onDisconnect(r).remove();await this.D.set(r,{name:this.name,at:this.D.serverTimestamp()});}
 async create({title,deck,aiDeck=null,mode='strict'}){
  if(!this.online)throw Error('請先連線登入');await this.leave();const uid=this.user.uid;
  for(let tries=0;tries<4;tries++){
   const id=code(),meta={id,title:(title||this.name+'的房間').slice(0,60),p0:uid,status:'waiting',mode,createdAt:this.D.serverTimestamp()},settings={[uid]:{deckJSON:JSON.stringify(deck),ready:true}};
   if(aiDeck){meta.p1='AI';settings.AI={deckJSON:JSON.stringify(aiDeck),ready:true};}
   try{await this.D.set(this.ref('rooms/'+id),{meta,authority:{uid,connection:this.connection,term:1},settings});await this._enter(id);return id;}catch(e){if(tries===3)throw e;}
  }
 }
 async join(id,deck){id=String(id).trim().toUpperCase();if(!/^[A-Z0-9]{8}$/.test(id))throw Error('房號為8碼英數字');if(!this.online)throw Error('請先連線登入');await this.leave();const meta=(await this.D.get(this.ref('rooms/'+id+'/meta'))).val();if(!meta||meta.status==='closed')throw Error('房間不存在或已關閉');
  if(![meta.p0,meta.p1].includes(this.user.uid)){
   const joined=await this.D.runTransaction(this.ref('rooms/'+id+'/meta/p1'),v=>v===null?this.user.uid:undefined,{applyLocally:false});if(!joined.committed)throw Error('房間已滿');
  }
  if(meta.status==='waiting')await this.D.set(this.ref('rooms/'+id+'/settings/'+this.user.uid),{deckJSON:JSON.stringify(deck),ready:true});await this._enter(id);return id;
 }
 async _enter(id){this.room=id;this.roomStops=[];this.meta=null;this.lease=null;this.roomOnline={};this.settings=null;this.lastView=null;this.pending=null;this.cb.room?.(id);await this._roomPresence();const root='rooms/'+id+'/';
  this.roomStops.push(this.D.onValue(this.ref(root+'meta'),s=>{this.meta=s.val();this.cb.meta?.(this.meta);this._schedule();},e=>this.error(e)),this.D.onValue(this.ref(root+'authority'),s=>{this.lease=s.val();this._inspectLease().catch(e=>this.error(e));},e=>this.error(e)),this.D.onValue(this.ref(root+'presence'),s=>{this.roomOnline=s.val()||{};this._inspectLease().catch(e=>this.error(e));},e=>this.error(e)),this.D.onValue(this.ref(root+'bundle/views/'+this.user.uid),s=>{if(!s.exists())return;try{const v=JSON.parse(s.val());this.lastView=v;if(v.receipt?.cmdId===this.pending){this.pending=null;if(!v.receipt.ok)this.cb.error?.(new Error(v.receipt.error));}this.cb.view?.(v);}catch(e){this.error(e);}},e=>this.error(e)));
 }
 async _inspectLease(){
  const a=this.lease;if(!a||!this.room||!this.online)return;
  const active=!!this.roomOnline[a.uid]?.[a.connection];this.cb.authority?.({lease:a,active,mine:a.uid===this.user.uid&&a.connection===this.connection});
  if(a.uid===this.user.uid&&a.connection===this.connection){if(!this.active&&!this.loading){this.loading=true;try{await this._activate();}finally{this.loading=false;if(!this.active&&this.room)queueMicrotask(()=>this._inspectLease().catch(e=>this.error(e)));}}}
  else {this.core=null;this.active=null;this.generation++;this._stopAuthority();if(!active&&a.uid===this.user.uid)await this.takeover();}
 }
 async takeover(){if(this.claiming)return;this.claiming=true;try{return await this._takeover();}finally{this.claiming=false;}}
 async _takeover(){if(!this.room||!this.online)throw Error('目前未連線');await this._roomPresence();const uid=this.user.uid,conn=this.connection;
  const result=await this.D.runTransaction(this.ref('rooms/'+this.room+'/authority'),a=>{if(!a||this.roomOnline[a.uid]?.[a.connection])return;return {uid,connection:conn,term:a.term+1};},{applyLocally:false});if(!result.committed)throw Error('原權威端仍在線，或已有玩家接手');
 }
 _stopAuthority(){for(const stop of this.authorityStops||[])stop();this.authorityStops=[];this.commands={};}
 async _activate(){
  this._stopAuthority();const gen=++this.generation,id=this.room,term=this.lease.term,conn=this.connection;this.active={gen,id,term,conn};
  const raw=await new Promise((resolve,reject)=>{let first=true;const stop=this.D.onValue(this.ref('rooms/'+id+'/bundle'),snap=>{if(first){first=false;resolve(snap.val());}},error=>{if(first)reject(error);});this.authorityStops.push(stop);});if(!this._current(gen))return;
  this.rev=raw?.revision??-1;this.log=raw?.logJSON?JSON.parse(raw.logJSON):{};
  if(raw){const cp=JSON.parse(raw.checkpointJSON);this.core=new BreakMatchPilot.RoomAuthority({players:cp.players,checkpoint:cp,log:this.log});await this._save(gen);}
  this.authorityStops.push(this.D.onValue(this.ref('rooms/'+id+'/settings'),s=>{this.settings=s.val()||{};this._schedule();},e=>this.error(e)),this.D.onValue(this.ref('rooms/'+id+'/commands'),s=>{this.commands=s.val()||{};this._schedule();},e=>this.error(e)));
  await this._publishLobby();this._schedule();
 }
 _current(gen){return this.online&&this.room===this.active?.id&&this.generation===gen&&this.lease?.uid===this.user.uid&&this.lease?.connection===this.connection&&this.lease?.term===this.active.term;}
 _schedule(){if(this.queued)return;this.queued=true;queueMicrotask(()=>{this.queued=false;this.work=this.work.then(()=>this._drain()).catch(e=>this.error(e));});}
 async _drain(){
  const gen=this.active?.gen;if(!this._current(gen)||!this.meta||this.meta.status==='closed')return;
  if(!this.core){const players=[this.meta.p0,this.meta.p1];if(!players[1]||!this.settings?.[players[0]]?.ready||!this.settings?.[players[1]]?.ready)return;const decks=players.map(uid=>JSON.parse(this.settings[uid].deckJSON));this.core=new BreakMatchPilot.RoomAuthority({id:'room-'+this.room,players,decks,seed:crypto.getRandomValues(new Uint32Array(1))[0],mode:this.meta.mode});await this._save(gen);if(!this._current(gen))return;await this.D.set(this.ref('rooms/'+this.room+'/meta/status'),'running');await this._publishLobby();}
  for(let steps=0;steps<100&&this._current(gen);steps++){
   const queued=Object.entries(this.commands||{}).flatMap(([uid,items])=>Object.entries(items||{}).map(([cid,record])=>({uid,cid,record}))).sort((a,b)=>a.cid.localeCompare(b.cid)).find(x=>!this.core.log[x.cid]);
   if(queued){let command;try{if(queued.record.term!==this.lease.term)throw Error('房主已更換，請重新操作');command=JSON.parse(queued.record.body);this.core.apply(queued.uid,queued.cid,command);}catch(e){this.core.log[queued.cid]={cmdId:queued.cid,uid:queued.uid,ok:false,error:String(e.message),command:null};}await this._save(gen);continue;}
   const command=this.core.aiCommand();if(command){const cid='AI_'+this.lease.term+'_'+this.core.match._m.decisionIndex;const receipt=this.core.apply('AI',cid,command);await this._save(gen);if(!receipt.ok)throw Error('AI操作未完成：'+receipt.error);await new Promise(r=>setTimeout(r,150));continue;}
   if(this.core.match._m.phase==='finished'&&this.meta.status!=='finished'){await this.D.set(this.ref('rooms/'+this.room+'/meta/status'),'finished');await this._publishLobby();}break;
  }
 }
 async _save(gen){if(!this._current(gen))throw Error('權威端已更換');const previous=this.rev,next=previous+1,bundle=this.core.bundle(this.lease.term,next,this.connection);
  try{const result=await this.D.runTransaction(this.ref('rooms/'+this.room+'/bundle'),old=>((old?.revision??-1)===previous?bundle:undefined),{applyLocally:false});if(!result.committed)throw Error('快照版本已更新，重新同步中');if(this._current(gen)){this.rev=next;this.recoveries=0;}}
  catch(e){if(this.active?.gen===gen){this.core=null;this.active=null;this.generation++;this._stopAuthority();this.recoveries=(this.recoveries||0)+1;if(this.online&&this.recoveries<=3)setTimeout(()=>this._inspectLease().catch(x=>this.error(x)),200);}throw e;}

 }
 async _publishLobby(){if(!this.meta||!this._current(this.active?.gen))return;await this.D.set(this.ref('lobby/'+this.room),{room:this.room,title:this.meta.title,owner:this.user.uid,status:this.meta.status,mode:this.meta.mode,createdAt:this.meta.createdAt});}
 async send(command){if(!this.online||!this.room||!this.lastView||this.meta?.status!=='running')throw Error('請等待連線與對戰開始');if(!this.lease||this.lastView.term!==this.lease.term||!this.roomOnline[this.lease.uid]?.[this.lease.connection])throw Error('請等待房主接手與最新視圖');if(this.pending)throw Error('正在等待上一個操作確認');const r=this.ref('rooms/'+this.room+'/commands/'+this.user.uid),cid=this.D.push(r).key;this.pending=cid;this.cb.sending?.(true);
  try{await this.D.set(this.ref('rooms/'+this.room+'/commands/'+this.user.uid+'/'+cid),{body:JSON.stringify(command),term:this.lastView.term,createdAt:this.D.serverTimestamp()});}catch(e){this.pending=null;throw e;}finally{this.cb.sending?.(false);}return cid;
 }
 async close(){const id=this.room;if(!this._current(this.active?.gen))throw Error('只有權威端可以關閉房間');await this.D.set(this.ref('rooms/'+this.room+'/meta/status'),'closed');await this.D.remove(this.ref('lobby/'+id));await this.leave();}
 async leave(){const id=this.room,conn=this.connection;this.generation++;this.core=null;this.active=null;this._stopAuthority();for(const stop of this.roomStops||[])stop();this.roomStops=[];this.room=null;this.meta=null;this.lease=null;this.pending=null;this.lastView=null;if(id&&conn&&this.user)await this.D.remove(this.ref('rooms/'+id+'/presence/'+this.user.uid+'/'+conn)).catch(()=>{});this.cb.room?.(null);}
 async logout(){await this.leave();if(this.user&&this.connection)await this.D.remove(this.ref('presence/'+this.user.uid+'/'+this.connection)).catch(()=>{});for(const stop of this.stops)stop();this.stops=[];this.online=false;this.user=null;}
 error(e){this.cb.error?.(e);}
}
