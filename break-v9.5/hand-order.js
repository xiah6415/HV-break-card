/* Local presentation order only. Never mutates a Match or a request. */
(function(root){'use strict';
class HandOrder{
 constructor(store){this.store=store;this.rows=[];try{const saved=JSON.parse(store.get('bk_hand_order_v1'));if(saved?.version===1&&Array.isArray(saved.rows))this.rows=saved.rows.filter(r=>typeof r.key==='string'&&Array.isArray(r.ids)&&r.ids.length<=80&&r.ids.every(id=>typeof id==='string')).slice(-20);}catch{}}
 indices(key,refs){const ids=this.rows.find(r=>r.key===key)?.ids||[],rank=new Map(ids.map((id,i)=>[id,i]));return refs.map((_,i)=>i).sort((a,b)=>(rank.get(refs[a].id)??ids.length+a)-(rank.get(refs[b].id)??ids.length+b));}
 move(key,refs,source,target,before){
  if(!key||source===target||!refs.some(c=>c.id===source)||!refs.some(c=>c.id===target))return false;
  const prior=this.rows.find(r=>r.key===key)?.ids||[],ids=[...new Set([...prior,...refs.map(c=>c.id)])];
  ids.splice(ids.indexOf(source),1);ids.splice(ids.indexOf(target)+(before?0:1),0,source);
  this.rows=this.rows.filter(r=>r.key!==key);this.rows.push({key,ids});this.rows=this.rows.slice(-20);
  try{this.store.set('bk_hand_order_v1',JSON.stringify({version:1,rows:this.rows}));}catch{}
  return true;
 }
}
if(typeof module==='object'&&module.exports)module.exports=HandOrder;else root.BreakHandOrder=HandOrder;
})(globalThis);
