/* Public payloads are rebuilt from the engine's whitelist, never uploaded from a private JSON string. */
export function researchReplay(record){
 if(record?.kind!=='solo'||record.status!=='finished'||!record.replay?.checkpoint)throw Error('僅提供已完成的單人對局');
 const s=BreakMatchPilot.TableSession.fromCheckpoint(record.replay.checkpoint);try{return BreakMatchPilot.Replay.build(s.options,s.match);}finally{s.stop();}
}
export class ResearchMatches{
 constructor(services,agreement,records){Object.assign(this,services);this.agreement=agreement;this.records=records;this.pending=new Map();this.done=new Set();}
 ref(path){return this.D.ref(this.db,path);}
 check(uid){if(!uid||this.records.uid!==uid||this.auth.currentUser?.uid!==uid||!this.agreement.enabled)throw Error('研究分享未啟用或帳號已變更');}
 async erase(uid,slot,row){if(!row)return;const id=row.id,writer=await this.D.get(this.ref('researchWriters/'+row.id));if(writer.exists()){await this.D.update(this.D.ref(this.db),{['publicReplays/'+id]:null,['publicReplayIndex/'+id]:null});await this.D.remove(this.ref('researchWriters/'+id));}await this.D.runTransaction(this.ref('researchPublications/'+uid+'/'+slot),v=>v?.id===id?null:undefined,{applyLocally:false});}
 async submit(record){
 const uid=this.records.uid;this.check(uid);const key=uid+':'+record.id;if(this.done.has(key))return;if(this.pending.has(key))return this.pending.get(key);
 const work=(async()=>{
  const replay=researchReplay(record);this.check(uid);
  const rows=(await this.D.get(this.ref('personalMatchIndex/'+uid))).val()||{};this.check(uid);const slot=Object.keys(rows).find(k=>rows[k].recordId===record.id);if(!slot)throw Error('請先完成私人備份');
  const path='researchPublications/'+uid+'/'+slot,old=(await this.D.get(this.ref(path))).val();this.check(uid);
  if(old?.recordId===record.id){const published=await this.D.get(this.ref('publicReplayIndex/'+old.id));this.check(uid);if(published.exists()){this.done.add(key);if(this.done.size>100)this.done.delete(this.done.values().next().value);return;}}
  if(old)await this.erase(uid,slot,old);this.check(uid);
  const id=replay.id,stamp=this.D.serverTimestamp(),row={id,recordId:record.id,createdAt:stamp};
  const reservation=await this.D.runTransaction(this.ref(path),v=>v===null?row:undefined,{applyLocally:false});this.check(uid);if(!reservation.committed)throw Error('此場正在另一個裝置同步，稍後重試');
  await this.D.set(this.ref('researchWriters/'+id),{uid,slot,recordId:record.id});this.check(uid);
  await this.D.set(this.ref('publicReplays/'+id),JSON.stringify(replay));this.check(uid);
  const ai=record.replay.checkpoint.options?.aiLevel||'normal';
  await this.D.set(this.ref('publicReplayIndex/'+id),{...BreakMatchPilot.Replay.summary(replay),origin:'solo-ai-research',aiLevel:['easy','normal','hard'].includes(ai)?ai:'normal',aiVersion:record.replay.checkpoint.options?.aiVersion||'unknown'});this.check(uid);this.done.add(key);if(this.done.size>100)this.done.delete(this.done.values().next().value);
 })();this.pending.set(key,work);return work.finally(()=>this.pending.delete(key));
 }
 async withdraw(){const uid=this.records.uid;if(!uid||this.auth.currentUser?.uid!==uid)throw Error('請先登入');await this.agreement.disable();await Promise.allSettled([...this.pending.values()]);if(this.auth.currentUser?.uid!==uid)throw Error('帳號已變更，請重新操作');const rows=(await this.D.get(this.ref('researchPublications/'+uid))).val()||{};for(const [slot,row]of Object.entries(rows)){if(this.auth.currentUser?.uid!==uid)throw Error('帳號已變更');await this.erase(uid,slot,row);}this.done.clear();}
}
