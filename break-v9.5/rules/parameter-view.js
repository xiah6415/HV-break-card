/* Public arithmetic only: never include source cards, hidden zones, or effect IDs. */
'use strict';
const fields=['serve','block','receive','toss','attack'];
function parameterDetails(k,id){
 const card=k.card(id),ref=k.reference(id);return Object.fromEntries(fields.map(param=>{
  const base=card.printed.parameters[param],total=k.parameter(id,param);
  const steps=total==='dash'?[]:k.state.effects.filter(e=>e.kind==='numeric'&&k.active(e)&&k.current(ref)&&e.target?.id===ref.id&&e.target.incarnation===ref.incarnation&&e.parameter===param).map(e=>({operation:e.operation,value:e.value}));
  return [param,{base,total,steps}];
 }));
}
function formatParameter(detail,total){
 const plain={text:total==null||total==='dash'?'—':String(total),title:'目前數值 '+(total??'—'),changed:false};
 if(!detail||!Number.isInteger(total))return plain;
 const steps=detail.steps.filter(s=>s.operation==='set'||s.value!==0);if(!steps.length)return plain;
 let base=detail.base,fixed=false,plus=0,minus=0;
 for(const s of steps)if(s.operation==='set'){base=s.value;fixed=true;plus=minus=0;}else if(s.value>0)plus+=s.value;else minus-=s.value;
 const start=fixed?detail.base+'→'+base:String(base),add=(plus?'＋'+plus:'')+(minus?'−'+minus:'');
 return {text:start+add+(add?'＝'+total:''),title:'原始 '+detail.base+'；'+steps.map(s=>s.operation==='set'?'設為 '+s.value:s.value>=0?'＋'+s.value:'−'+Math.abs(s.value)).join('；')+'；目前 '+total,changed:true};
}
module.exports={parameterDetails,formatParameter};
