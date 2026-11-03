/* Opt-in public copies. Private backups and local decks are never published implicitly. */
export class PublicDecks {
 constructor(services){Object.assign(this,services);}
 async list(before=null){
  const {D}=this,clauses=[D.orderByChild('createdAt')];
  if(before)clauses.push(D.endBefore(before.createdAt,before.id));
  clauses.push(D.limitToLast(30));
  const snap=await D.get(D.query(D.ref(this.db,'publicDecks'),...clauses)),raw=[];
  snap.forEach(s=>{raw.push({id:s.key,...s.val()});});
  const rows=[];let invalid=0;
  for(const r of raw){try{
   if(r.version!==1||typeof r.owner!=='string'||typeof r.author!=='string'||!Number.isFinite(r.createdAt))throw Error('格式錯誤');
   const deck=BreakDeckTools.parseDeck({name:r.name,cards:JSON.parse(r.cardsJSON)},BreakEngine.DEF,{mode:'numeric'});
   rows.push({id:r.id,owner:r.owner,author:r.author,createdAt:r.createdAt,...deck});
  }catch{invalid++;}}
  const first=raw[0];return {rows:rows.reverse(),invalid,more:raw.length===30,cursor:first?{id:first.id,createdAt:first.createdAt}:null};
 }
 async publish(source,author){
  const user=this.auth.currentUser;
  if(!user||user.isAnonymous||!user.providerData.some(p=>p.providerId==='google.com'))throw Error('請先用 Google 登入後再公開分享');
  const deck=BreakDeckTools.parseDeck(source,BreakEngine.DEF,{mode:'numeric'});
  author=String(author||'').trim().slice(0,20);if(!author)throw Error('請填寫公開暱稱');
  const eventCount=Object.entries(deck.cards).reduce((n,[c,k])=>n+(BreakEngine.isC(c)?0:k),0),id='pub_'+crypto.randomUUID();
  await this.D.set(this.D.ref(this.db,'publicDecks/'+id),{version:1,owner:user.uid,author,name:deck.name,cardsJSON:JSON.stringify(deck.cards),cardCount:40,eventCount,createdAt:this.D.serverTimestamp()});return id;
 }
 async remove(id){if(!/^pub_[\w-]+$/.test(id))throw Error('牌組編號無效');await this.D.remove(this.D.ref(this.db,'publicDecks/'+id));}
}
