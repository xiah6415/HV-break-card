/* Only app nickname and a re-encoded thumbnail are public; never OAuth identity fields. */
export const validAvatar=s=>typeof s==='string'&&(s===''||s.length<=24000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(s));
export class PlayerProfiles{
 constructor(services,onChange=()=>{},onError=()=>{}){Object.assign(this,services);this.rows=new Map();this.stops=new Map();this.onChange=onChange;this.onError=onError;}
 watch(ids){const wanted=new Set(ids.filter(id=>id&&id!=='AI'));
  for(const [id,stop]of this.stops)if(!wanted.has(id)){stop();this.stops.delete(id);this.rows.delete(id);}
  for(const id of wanted)if(!this.stops.has(id)){
   this.stops.set(id,()=>{});
   const stop=this.D.onValue(this.D.ref(this.db,'playerProfiles/'+id),s=>{const p=s.val();this.rows.set(id,p&&typeof p.name==='string'&&validAvatar(p.avatar)?{name:p.name,avatar:p.avatar}:null);this.onChange(id);},e=>this.onError(e));this.stops.set(id,stop);
  }
 }
 async save(name,avatar,expectedUid=this.auth.currentUser?.uid){const u=this.auth.currentUser;if(u?.uid!==expectedUid)throw Error('帳號已切換，請重新開啟');if(!u||u.isAnonymous||!u.providerData.some(p=>p.providerId==='google.com'))throw Error('請先用 Google 登入');
  name=String(name||'').replace(/[<>&"'`]/g,'').trim();if(!name||name.length>20)throw Error('請輸入1–20字的暱稱');if(!validAvatar(avatar))throw Error('頭像格式無效，請重新選擇圖片');
  await this.D.set(this.D.ref(this.db,'playerProfiles/'+u.uid),{name,avatar,updatedAt:this.D.serverTimestamp()});
 }
}
export async function avatarFromFile(file){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('請選擇 JPG、PNG 或 WebP 圖片');
 if(file.size>10*1024*1024)throw Error('請選擇10MB以下的圖片');
 const url=URL.createObjectURL(file),img=new Image();
 try{img.src=url;await img.decode();const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,128,128);const side=Math.min(img.naturalWidth,img.naturalHeight);if(!side)throw Error();ctx.drawImage(img,(img.naturalWidth-side)/2,(img.naturalHeight-side)/2,side,side,0,0,128,128);
  const result=canvas.toDataURL('image/jpeg',0.72);if(!validAvatar(result))throw Error('圖片縮圖後仍過大，請換一張圖片');return result;
 }catch(e){throw Error(e.message?.includes('過大')?e.message:'無法讀取圖片，請改用 JPG、PNG 或 WebP');}finally{URL.revokeObjectURL(url);}
}
