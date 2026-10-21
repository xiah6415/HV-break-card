/* Core-side structural contract. Renderers/AI answer it; rules remain authoritative. */
'use strict';
const gameKinds=['firstService','roll','mulligan','serve','defend','block','ack','receiver','setter','attacker','event','turnEnd','lossConfirm','skill','name','target','parameter','guts','gutsCourt','discard','cost','retrieve','summon','reveal','revealResult','rulesChoice'];
const kernelKinds=['target','target_count','payment_cards','move_cards','move_count','guts','payment_count','guts_destination','parameter','draw_count','mill_count','activate_payment','optional','mode','entry_count','entry','trigger_order'];
const kinds=new Set([...gameKinds,...kernelKinds]),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const integer=(n,min=0)=>Number.isInteger(n)&&n>=min;
function validateRequest(r){
 if(!r||r.protocol!=='break.host.v1'||typeof r.matchId!=='string'||typeof r.requestId!=='string'||!integer(r.epoch,1)||!integer(r.revision)||!integer(r.decisionIndex)||![0,1].includes(r.actor)||!['game','kernel'].includes(r.origin)||!kinds.has(r.kind)||typeof r.prompt!=='string'||typeof r.canLoss!=='boolean'||typeof r.canManual!=='boolean'||!Array.isArray(r.options))return false;
 if(!r.options.every(o=>o&&typeof o.id==='string'&&Object.hasOwn(o,'value')&&typeof o.label==='string')||new Set(r.options.map(o=>o.id)).size!==r.options.length)return false;
 if(!r.input||!['ack','single','cards','number','block'].includes(r.input.type))return false;
 if(['cards','block'].includes(r.input.type)&&(!integer(r.input.min)||!integer(r.input.max)||r.input.min>r.input.max||r.input.max>r.options.length))return false;
 if(r.input.type==='number'&&!r.options.every(o=>integer(o.value)))return false;
 if(r.source!=null&&(typeof r.source.id!=='string'||!integer(r.source.incarnation)||typeof r.source.cardNo!=='string'))return false;
 return true;
}
function validateValue(r,value){
 if(!validateRequest(r))return false;
 const has=v=>r.options.some(o=>same(o.value,v));
 if(r.input.type==='ack')return value===true&&has(true);
 if(r.input.type==='single'||r.input.type==='number')return has(value);
 const ids=r.input.type==='block'?value?.cards:value;
 if(!Array.isArray(ids)||ids.length<r.input.min||ids.length>r.input.max||new Set(ids).size!==ids.length||!ids.every(has))return false;
 return r.input.type!=='block'||ids.includes(value.center);
}
function validateAnswer(r,a){return !!r&&!!a&&a.matchId===r.matchId&&a.requestId===r.requestId&&a.epoch===r.epoch&&a.actor===r.actor&&validateValue(r,a.value);}
module.exports={gameKinds,kernelKinds,validateRequest,validateValue,validateAnswer};
