/* Local match history. Online records accept only visible text and summary;
   private authority snapshots and opponent deck order are never accepted. */
(function(root){
'use strict';
const KEY='bk_match_records',copy=x=>JSON.parse(JSON.stringify(x)),text=(x,n=80)=>String(x??'').slice(0,n);
class MatchRecords{
 constructor(storage,{limit=10,maxBytes=1800000}={}){this.storage=storage;this.limit=limit;this.maxBytes=maxBytes;this.rows=[];this.error='';this.refresh();}
 refresh(){try{const raw=this.storage.getItem(KEY);if(raw===null)this.rows=[];else{const data=JSON.parse(raw);if(data.version!==1||!Array.isArray(data.rows)||data.rows.some(r=>r.version!==1||typeof r.id!=='string'||!['solo','online'].includes(r.kind)||!Array.isArray(r.logs)||r.logs.some(s=>typeof s!=='string')||!Array.isArray(r.names)||r.names.length!==2||r.names.some(n=>typeof n!=='string')||!Array.isArray(r.deckNames)||r.deckNames.some(n=>typeof n!=='string')||!Number.isSafeInteger(r.rally)||r.rally<0||!Number.isSafeInteger(r.decisionIndex)||r.decisionIndex<0||![null,'win','loss'].includes(r.result)||!Number.isFinite(r.startedAt)||!Number.isFinite(r.updatedAt)||!['in_progress','finished'].includes(r.status)||(r.kind==='online'&&r.replay!==null)||(r.kind==='solo'&&(r.replay?.format!=='break.solo.checkpoint.v1'||typeof r.replay.fingerprint!=='string'||r.replay.checkpoint?.version!==1||!Array.isArray(r.replay.checkpoint.journal))))||new Set(data.rows.map(r=>r.id)).size!==data.rows.length)throw Error('格式無法讀取');this.rows=data.rows;}this.error='';}catch{this.error='對局紀錄無法讀取，原資料仍保留；可下載原始備份後清除。';}}
 _write(rows){if(this.error)throw Error(this.error);const raw=JSON.stringify({version:1,rows});if(raw.length*2>this.maxBytes)throw Error('此場紀錄超過保存容量，請先匯出其他紀錄。');try{this.storage.setItem(KEY,raw);}catch{throw Error('無法保存對局紀錄，請釋放瀏覽器儲存空間。');}this.rows=rows;}
 save({id,kind,view,checkpoint=null,names=['你','AI'],deckNames=[],logs=[]}){
  this.refresh();if(this.error)throw Error(this.error);
  if(!['solo','online'].includes(kind)||typeof id!=='string'||!view?.match||!Array.isArray(logs))throw Error('對局紀錄格式錯誤');
  const old=this.rows.find(r=>r.id===id),now=Date.now(),m=view.match;
  const row={version:1,id,kind,startedAt:old?.startedAt||now,updatedAt:now,names:names.map(n=>text(n)),deckNames:deckNames.map(n=>text(n)),mode:text(m.mode),rally:Number.isSafeInteger(m.rally)&&m.rally>=0?m.rally:0,status:m.winner==null?'in_progress':'finished',result:m.winner==null?null:m.winner===0?'win':'loss',endReason:text(m.endReason||''),decisionIndex:Number.isSafeInteger(m.decisionIndex)&&m.decisionIndex>=0?m.decisionIndex:0,logs:logs.map(s=>text(s,2000))};
  if(kind==='solo'){
   if(checkpoint?.version!==1||!checkpoint.base?.fingerprint||!Array.isArray(checkpoint.journal))throw Error('缺少單人重演資料');
   row.replay={format:'break.solo.checkpoint.v1',fingerprint:checkpoint.base.fingerprint,seed:checkpoint.options?.seed,checkpoint:copy(checkpoint)};
  }else row.replay=null;
  // Keep previous records on failed writes. Eviction occurs only after a valid
  // new row can fit by itself and the storage write succeeds.
  if(JSON.stringify({version:1,rows:[row]}).length*2>this.maxBytes)throw Error('此場紀錄超過保存容量，尚未覆蓋其他紀錄。');
  const rows=[row,...this.rows.filter(r=>r.id!==id)].sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,this.limit);
  while(rows.length>1&&JSON.stringify({version:1,rows}).length*2>this.maxBytes)rows.pop();this._write(rows);return row;
 }
 remove(id){this.refresh();this._write(this.rows.filter(r=>r.id!==id));}
 export(id){this.refresh();if(this.error)throw Error(this.error);const r=this.rows.find(r=>r.id===id);if(!r)throw Error('找不到對局紀錄');return JSON.stringify({format:'break.match-record',version:1,exportedAt:Date.now(),record:r},null,2);}
 raw(){return this.storage.getItem(KEY)||JSON.stringify({version:1,rows:[]});}
 clear(){this.storage.removeItem(KEY);this.rows=[];this.error='';}
}
MatchRecords.KEY=KEY;
if(typeof module!=='undefined'&&module.exports)module.exports=MatchRecords;else root.BreakMatchRecords=MatchRecords;
})(typeof globalThis!=='undefined'?globalThis:this);
