/* Owner-only solo archives. Indexes are small; full replays load on demand. */
export const LIMIT=30,MAX_CHARS=900000;
export function validateRecord(record){
 const local=new BreakMatchRecords({getItem:()=>JSON.stringify({version:1,rows:[record]}),setItem(){}});
 if(local.error||local.rows.length!==1||record.kind!=='solo'||record.status!=='finished'||!['win','loss'].includes(record.result))throw Error('僅能備份已完成的單人對局');
 const json=JSON.stringify(record);if(json.length>MAX_CHARS)throw Error('此場紀錄超過雲端單場容量，本機紀錄仍保留');return json;
}
export class MatchCloud{
 constructor(services,callbacks={}){Object.assign(this,services);this.cb=callbacks;this.uid=null;this.rows=[];this.stop=null;this.generation=0;this.pending=new Map();this.uploaded=new Map();this.deleted=new Set();this.loading=false;}
 bind(user){this.stop?.();this.stop=null;this.rows=[];this.uploaded.clear();this.deleted.clear();this.pending.clear();this.uid=user&&!user.isAnonymous&&user.providerData.some(p=>p.providerId==='google.com')?user.uid:null;const gen=++this.generation;this.loading=!!this.uid;this.cb.list?.([]);if(!this.uid)return;const uid=this.uid,q=this.D.query(this.ref('personalMatchIndex/'+uid),this.D.orderByChild('updatedAt'),this.D.limitToLast(LIMIT));this.stop=this.D.onValue(q,s=>{if(gen!==this.generation)return;this.loading=false;const rows=Object.entries(s.val()||{}).map(([id,v])=>({id,...v})).sort((a,b)=>b.updatedAt-a.updatedAt);for(const old of this.rows)if(!rows.some(r=>r.recordId===old.recordId))this.deleted.add(uid+':'+old.recordId);this.rows=rows;this.cb.list?.(this.rows);},e=>{if(gen!==this.generation)return;this.loading=false;this.cb.error?.(e);});}
 ref(path){return path?this.D.ref(this.db,path):this.D.ref(this.db);}
 session(uid,gen){if(!uid||this.uid!==uid||this.generation!==gen)throw Error('帳號已變更，請重新開啟私人紀錄');}
 async upload(record,{manual=false}={}){
  const uid=this.uid,gen=this.generation;if(!uid)return Promise.reject(Error('請先用 Google 登入'));
  let json;try{json=validateRecord(record);}catch(e){return Promise.reject(e);}
  record=JSON.parse(json);const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({...record,updatedAt:0}))),signature=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');this.session(uid,gen);const token=uid+':'+record.id;if(manual)this.deleted.delete(token);else if(this.deleted.has(token))return Promise.resolve(false);
  if(!manual&&this.uploaded.get(token)===signature)return Promise.resolve(true);if(this.pending.has(token))return this.pending.get(token);
  const work=(async()=>{
   this.session(uid,gen);
   const snap=await this.D.get(this.D.query(this.ref('personalMatchIndex/'+uid),this.D.orderByChild('updatedAt'),this.D.limitToLast(LIMIT)));this.session(uid,gen);if(this.deleted.has(token))return false;
   const rows=Object.entries(snap.val()||{}).map(([id,v])=>({id,...v})).sort((a,b)=>a.updatedAt-b.updatedAt),existing=rows.find(r=>r.recordId===record.id),id=existing?.id||Array.from({length:LIMIT},(_,i)=>'s'+String(i).padStart(2,'0')).find(id=>!rows.some(r=>r.id===id))||rows[0].id,previousRecordId=rows.find(r=>r.id===id)?.recordId||'',stamp=this.D.serverTimestamp(),createdAt=existing?.createdAt||stamp,updates={};
   updates['personalMatches/'+uid+'/'+id]={version:1,recordId:record.id,previousRecordId,recordJSON:json,createdAt,updatedAt:stamp};
   updates['personalMatchIndex/'+uid+'/'+id]={version:1,recordId:record.id,previousRecordId,result:record.result,rally:record.rally,decisionIndex:record.decisionIndex,chars:json.length,createdAt,updatedAt:stamp};
   this.session(uid,gen);await this.D.update(this.ref(''),updates);this.session(uid,gen);this.uploaded.set(token,signature);if(this.uploaded.size>100)this.uploaded.delete(this.uploaded.keys().next().value);return true;
  })();this.pending.set(token,work);return work.finally(()=>{if(this.pending.get(token)===work)this.pending.delete(token);});
 }
 async fetch(id){const uid=this.uid,gen=this.generation;this.session(uid,gen);if(!/^s[0-2][0-9]$/.test(id))throw Error('紀錄編號錯誤');const expected=this.rows.find(r=>r.id===id)?.recordId;const snap=await this.D.get(this.ref('personalMatches/'+uid+'/'+id));this.session(uid,gen);if(!snap.exists())throw Error('紀錄已刪除');const value=snap.val();if(value.version!==1||typeof value.recordJSON!=='string'||value.recordJSON.length>MAX_CHARS)throw Error('雲端紀錄格式錯誤');const record=JSON.parse(value.recordJSON);validateRecord(record);if(record.id!==value.recordId||expected&&expected!==record.id)throw Error('紀錄已更新，請重新開啟');return record;}
 async remove(id,expectedRecordId){const uid=this.uid,gen=this.generation;this.session(uid,gen);const row=this.rows.find(r=>r.id===id);if(!row||expectedRecordId&&row.recordId!==expectedRecordId)throw Error('紀錄已更新，請重新開啟');const token=uid+':'+row.recordId;this.deleted.add(token);try{await this.pending.get(token);}catch{}this.session(uid,gen);
  const result=await this.D.runTransaction(this.ref('personalMatches/'+uid+'/'+id),data=>{this.session(uid,gen);if(data&&data.recordId!==row.recordId)return;return null;},{applyLocally:false});this.session(uid,gen);if(!result.committed)throw Error('紀錄已更新，請重新開啟');
  await this.D.runTransaction(this.ref('personalMatchIndex/'+uid+'/'+id),data=>{this.session(uid,gen);if(data&&data.recordId!==row.recordId)return;return null;},{applyLocally:false});this.session(uid,gen);this.uploaded.delete(token);
 }
}
