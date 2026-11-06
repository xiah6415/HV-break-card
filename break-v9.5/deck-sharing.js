/* Public intent belongs to each local deck. Existing decks have no public intent. */
(function(root){
'use strict';
class DeckSharing {
 constructor(storage,{deck,changed=()=>{}}){this.storage=storage;this.deck=deck;this.changed=changed;this.user=null;this.api=null;this.online=false;this.running=null;this.again=false;this.error='';}
 rows(){const raw=this.storage.getItem('bk_deck_sharing');const rows=raw?JSON.parse(raw):{};if(!rows||typeof rows!=='object'||Array.isArray(rows))throw Error('公開設定無法讀取');return rows;}
 row(id){return this.rows()[id]||{public:false};}
 write(id,row){const rows=this.rows();rows[id]=row;this.storage.setItem('bk_deck_sharing',JSON.stringify(rows));}
 removed(remoteId){for(const [id,r]of Object.entries(this.rows()))if(r.remoteId===remoteId)this.write(id,{public:false});this.changed();}
 set(id,visible){this.write(id,{...this.row(id),public:!!visible});this.error='';this.changed();this.sync();}
 bind(user,api,online,author){this.user=user&&!user.isAnonymous&&user.providerData?.some(p=>p.providerId==='google.com')?user:null;this.api=api;this.online=online;this.author=author;this.sync();}
 signature(deck){return JSON.stringify([deck.name,Object.entries(deck.cards).sort(([a],[b])=>a.localeCompare(b))]);}
 status(id){const r=this.row(id);if(!r.public)return r.remoteId?(!this.user||this.user.uid!==r.owner?'待原帳號登入取消公開':'正在取消公開'):'私人牌組';if(r.owner&&r.owner!==this.user?.uid)return this.user?'此公開牌組屬於原登入帳號':'已公開・登入原帳號可管理';if(!this.user)return '待 Google 登入後公開';if(!this.online)return '等待連線後公開';return r.synced===this.signature(this.deck(id)||{name:'',cards:{}})?'已公開・大家可瀏覽':'待同步公開';}
 sync(){
  if(this.running){this.again=true;return this.running;}
  if(!this.user||!this.api||!this.online)return Promise.resolve();
  const uid=this.user.uid,api=this.api,author=this.author||'玩家';
  this.running=Promise.resolve().then(async()=>{try{
   for(const id of Object.keys(this.rows())){
    if(this.user?.uid!==uid||!this.online)break;
    let r=this.row(id);if(r.owner&&r.owner!==uid)continue;
    const deck=this.deck(id);if(!deck){if(r.remoteId&&r.owner===uid){await api.remove(r.remoteId);if(this.user?.uid!==uid)break;this.write(id,{public:false,owner:uid,remoteId:null,synced:null});}continue;}
    if(r.public){
     const sig=this.signature(deck);if(r.synced===sig&&r.remoteId)continue;
     // Persist a stable ID before sending, so reload/retry cannot create duplicates.
     if(!r.remoteId){r={...r,owner:uid,remoteId:'pub_'+root.crypto.randomUUID()};this.write(id,r);}
     await api.publish(deck,author,r.remoteId);
     if(this.user?.uid!==uid)break;
     const latest=this.row(id);this.write(id,{...latest,synced:sig});
    }else if(r.remoteId){
     await api.remove(r.remoteId);if(this.user?.uid!==uid)break;
     const latest=this.row(id);this.write(id,{...latest,remoteId:null,synced:null});
    }
   }
   this.error='';
  }catch(e){this.error=e.message||'公開同步失敗';}
  finally{this.running=null;this.changed();if(this.again){this.again=false;this.sync();}}});return this.running;
 }
}
if(typeof module!=='undefined'&&module.exports)module.exports=DeckSharing;else root.BreakDeckSharing=DeckSharing;
})(typeof globalThis!=='undefined'?globalThis:this);
