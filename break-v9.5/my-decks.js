/* Local personal decks. Persist before changing the in-memory list. */
(function(root){
'use strict';
const DT=typeof module!=='undefined'&&module.exports?require('./deck-tools'):root.BreakDeckTools;
class MyDecks {
 constructor(storage,defs){this.storage=storage;this.defs=defs;this.decks=[];this.error=null;try{
  const saved=storage.getItem('bk_my_decks');
  if(saved!==null){const rows=JSON.parse(saved);if(!Array.isArray(rows))throw Error('牌組清單格式錯誤');const ids=new Set();this.decks=rows.map(d=>{if(!/^my_[\w-]+$/.test(d.id)||ids.has(d.id))throw Error('牌組編號重複或無效');ids.add(d.id);return {id:d.id,...DT.parseDeck(d,defs,{mode:'numeric'})};});}
  else {const old=storage.getItem('bk_custom_deck');if(old){const d=DT.parseDeck(old,defs,{mode:'numeric'});this.add(d);storage.setItem('bk_my',this.decks[0].id);storage.removeItem('bk_custom_deck');}}
 }catch(e){this.error=e.message;}}
 _write(next){if(this.error)throw Error('牌組資料未能讀取，請先備份原資料：'+this.error);try{this.storage.setItem('bk_my_decks',JSON.stringify(next));}catch{throw Error('無法儲存牌組，請確認瀏覽器允許本機儲存或尚有空間');}this.decks=next;}
 add(source){const deck=DT.parseDeck(source,this.defs,{mode:'numeric'}),id='my_'+(root.crypto?.randomUUID?.()||Date.now().toString(36)+'_'+Math.random().toString(36).slice(2));this._write([...this.decks,{id,...deck}]);return id;}
 update(id,source){if(!this.decks.some(d=>d.id===id))throw Error('找不到牌組');const deck=DT.parseDeck(source,this.defs,{mode:'numeric'});this._write(this.decks.map(d=>d.id===id?{id,...deck}:d));return id;}
 rename(id,name){const d=this.decks.find(d=>d.id===id);if(!d)throw Error('找不到牌組');if(!String(name).trim())throw Error('請輸入牌組名稱');return this.update(id,{...d,name:String(name).trim()});}
 remove(id){this._write(this.decks.filter(d=>d.id!==id));}
}
class DeckDrafts {
 constructor(storage,defs){this.storage=storage;this.defs=defs;}
 _all(){const text=this.storage.getItem('bk_deck_drafts');const rows=text?JSON.parse(text):{};if(!rows||typeof rows!=='object'||Array.isArray(rows))throw Error('草稿資料無法讀取');return rows;}
 _key(id){if(id!==null&&!/^my_[\w-]+$/.test(id))throw Error('草稿編號無效');return id||'new';}
 _validate(source){const cards={};let total=0,events=0;for(const [raw,n]of Object.entries(source.cards||{})){const c=DT.normalCode(raw);if(!Object.hasOwn(this.defs,c)||!Number.isSafeInteger(n)||n<1||n>40)throw Error('草稿卡片或張數無效');cards[c]=(cards[c]||0)+n;total+=n;if(this.defs[c][1]==='E')events+=n;}if(total>40||events>8)throw Error('草稿超過牌組上限');return {name:String(source.name||'').slice(0,60),cards};}
 get(id=null){const row=this._all()[this._key(id)];return row?{...row,...this._validate(row)}:null;}
 save(id,source){const key=this._key(id),rows=this._all();rows[key]={...this._validate(source),savedAt:Date.now()};this.storage.setItem('bk_deck_drafts',JSON.stringify(rows));}
 remove(id=null){const key=this._key(id),rows=this._all();delete rows[key];this.storage.setItem('bk_deck_drafts',JSON.stringify(rows));}
}
MyDecks.Drafts=DeckDrafts;
if(typeof module!=='undefined'&&module.exports)module.exports=MyDecks;else {root.BreakMyDecks=MyDecks;root.BreakDeckDrafts=DeckDrafts;}
})(typeof globalThis!=='undefined'?globalThis:this);
