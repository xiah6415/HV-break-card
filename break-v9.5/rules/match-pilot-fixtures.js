'use strict';
const E=require('../engine'),{Match}=require('./match');
const copy=x=>JSON.parse(JSON.stringify(x));
const areas=['serve','block','receive','toss','attack'];
const phase={srv:'serve',drw:'draw',rcv:'receive',tos:'toss',atk:'attack',blk:'block'};
const canon=id=>id?.replace(/^card-/,'c');
const short=c=>c.replace(/^HV-?/,'');
const decks={basic:['D01-009','D02-005','D04-006','D03-007'].flatMap(c=>Array(10).fill(c)),
 skills:[...['D01-009','D02-005','D04-006','D03-007'].flatMap(c=>Array(8).fill(c)),...Array(4).fill('D01-007'),...Array(4).fill('D01-011')],
 guts:[...['D01-009','D02-005','D04-006','D03-007'].flatMap(c=>Array(8).fill(c)),...Array(4).fill('D01-001'),...Array(4).fill('D01-002')]};
function oldState(g,calls){
 const s=g.cardSnapshot(),zones={},cards={};
 for(let p=0;p<2;p++)for(const z of ['deck','hand','drop','event','sets',...areas,'side:0','side:1'])zones[p+'.'+z]=z.startsWith('side:')?(s.zones[p+'.sides'][+z.slice(5)]?[canon(s.zones[p+'.sides'][+z.slice(5)])]:[]):s.zones[p+'.'+(z==='event'?'ev':z)].map(canon);
 for(const [key,ids]of Object.entries(zones))for(const id of ids){const c=s.cards[id.replace(/^c/,'card-')];cards[id]={id,code:c.code,owner:c.owner,incarnation:c.incarnation,zone:key};}
 const court=g.players.map(p=>[...areas,...(p.ts.sides||[]).map((_,i)=>'side:'+i)].flatMap(z=>{const c=g.courtTargets(p).find(t=>t.key===z);return c?[{zone:z,id:canon(g.roleReference(p,z).id),name:g.cardName(p,z).replace(/\s/g,''),parameters:Object.fromEntries(Object.entries({serve:'srv',block:'blk',receive:'rcv',toss:'tos',attack:'atk'}).map(([a,b])=>[a,g.parameter(p,z,b)]))}]:[];}));
 return {zones,cards,court,turn:g.turnP?.idx??null,turnNo:g.turnNo,rally:g.rallyNo,server:g.server??g.firstServer??null,dice:g.dice,choice:g.firstServiceChoice??null,ball:g.ball?{owner:1-g.turnP.idx,kind:g.ball.type,offense:g.ball.off}:null,phase:g.turnP?phase[g.rulePhase]:null,rng:{calls,word:((g._pilotSeed>>>0)+calls*0x6D2B79F5)>>>0},winner:g.winner?.idx??null};
}
function newState(m){
 const s=m.snapshot(),match=s.match,zones={},cards={};
 for(let p=0;p<2;p++)for(const z of ['deck','hand','drop','event','sets',...areas,'side:0','side:1'])zones[p+'.'+z]=[...s.zones[p+'.'+z]];
 for(const [key,ids]of Object.entries(zones))for(const id of ids){const c=s.cards[id];cards[id]={id,code:short(c.cardNo),owner:c.owner,incarnation:c.incarnation,zone:key};}
 const v=m.view(0),court=v.players.map(p=>p.court.map(c=>({zone:c.role==='center_blocker'?'block':c.role==='side_blocker'?s.cards[c.id].zone.split('.')[1]:c.role,id:c.id,name:c.name.replace(/\s/g,''),parameters:Object.fromEntries(Object.entries(c.parameters).map(([k,v])=>[k,v==='dash'?null:v]))})));
 return {zones,cards,court,turn:match.phase==='setup'||match.phase==='finished'?null:s.turn.player,turnNo:match.turnNo,rally:match.rally,server:match.server,dice:match.dice,choice:match.firstServiceChoice,ball:s.ball?copy(s.ball):null,phase:match.phase==='rally'?s.turn.phase:null,rng:{calls:match.rng.calls,word:match.rng.word},winner:match.winner};
}
function logicalKind(r){if(['skill','activate_payment','optional'].includes(r.kind))return 'boolean';if(['rulesChoice','payment_cards','move_cards'].includes(r.kind))return 'cardChoice';return r.kind;}
function blockers(state,actor){
 const hand=state.zones[actor+'.hand'],byCode=new Set(),ids=hand.filter(id=>{const c=state.cards[id].code;if(E.st(c,'blk')==null||byCode.has(c))return false;byCode.add(c);return true;});
 const off=state.ball.offense;
 for(let n=1;n<=3;n++){const result=[];function search(start,chosen){if(result.length)return;if(chosen.length===n){if(new Set(chosen.map(id=>E.nm(state.cards[id].code))).size===n&&chosen.reduce((v,id)=>v+E.st(state.cards[id].code,'blk'),0)>=off)result.push(chosen);return;}for(let i=start;i<ids.length;i++)search(i+1,[...chosen,ids[i]]);}search(0,[]);if(result.length){const cards=result[0],center=cards.slice().sort((a,b)=>E.val(state.cards[b].code)-E.val(state.cards[a].code))[0];return{cards,center};}}
 return null;
}
function select(r,state,actor,{preferBlock=false,mulligan=false}={}){
 if(r.kind==='firstService')return 'serve';
 if(r.kind==='mulligan')return mulligan?state.zones[actor+'.hand'].slice(0,2):[];
 if(r.kind==='defend')return preferBlock&&blockers(state,actor)?'block':'receive';
 if(r.kind==='block')return blockers(state,actor);
 if(r.kind==='event')return r.options.find(o=>o.card)?.cardCode||r.options.find(o=>o.card)?.value||null;
 if(r.kind==='target'){const active=state.zones[actor+'.receive'].at(-1);return r.options.find(o=>o.physicalId===active)?.value??r.options[0].value;}
 if(r.kind==='guts')return r.options.slice(0,r.count).map(o=>o.value);
 if(['skill','activate_payment','optional'].includes(r.kind))return true;
 if(['rulesChoice','payment_cards','move_cards'].includes(r.kind)){const options=r.options.filter(o=>o.cardCode);if(options.length)return options[0].value;return r.options[0].value;}
 if(r.kind==='parameter')return r.options.find(o=>['receive','rcv'].includes(o.value))?.value??r.options[0].value;
 if(['receiver','setter','attacker','serve'].includes(r.kind)){
  const param={receiver:'rcv',setter:'tos',attacker:'atk',serve:'srv'}[r.kind];
  const score=o=>E.st(o.cardCode,param)+(r.kind==='receiver'&&o.cardCode==='D01-007'?3:0);
  return r.options.slice().sort((a,b)=>score(b)-score(a))[0].value;
 }
 return r.options[0].value;
}
function oldQuestion(g,p,r){const s=g.cardSnapshot();return {...copy(r),count:r.need,options:r.options.map(o=>{
 let physicalId;
 if(r.kind==='target')physicalId=canon(g.roleReference(p,o.value).id);
 else if(r.kind==='guts')physicalId=canon(s.zones[p.idx+'.'+r.area][o.value]);
 else if(typeof o.value==='string'&&s.cards[o.value])physicalId=canon(o.value);
 else if(o.card)physicalId=canon(s.zones[p.idx+'.hand'].find(id=>s.cards[id].code===o.card));
 return {...o,physicalId,cardCode:o.card};})};}
function oldAnswer(g,p,r,value){
 if(r.kind==='mulligan')return value.map(id=>g.cardSnapshot().zones[p.idx+'.hand'].indexOf(id.replace(/^c/,'card-')));
 if(r.kind==='block')return {cards:value.cards.map(id=>g.cardSnapshot().cards[id.replace(/^c/,'card-')].code),center:g.cardSnapshot().cards[value.center.replace(/^c/,'card-')].code};
 return value;
}
function newQuestion(m,r){const s=m.snapshot();return {...r,count:r.input.min,options:r.options.map(o=>({...o,cardCode:o.card?short(o.card.cardNo):undefined,physicalId:o.card?.id}))};}
function newAnswer(r,value){
 if(r.kind==='event'&&value!==null){const o=r.options.find(o=>o.cardCode===value||o.value===value);return o.value;}
 if(r.input.type==='cards'&&!Array.isArray(value))return [value];
 return value;
}
async function runOld({seed=1,deck='skills',preferBlock=false,mulligan=false}={}){
 const records=[],arr=decks[deck],key='__single_state_pilot';E.DECKS[key]={name:key,cards:Object.fromEntries([...new Set(arr)].map(c=>[c,arr.filter(x=>x===c).length]))};
 const agent={wantsAck:true,async choose(g,p,r){const state=oldState(g,g._rngCalls());const q=oldQuestion(g,p,r),value=select(q,state,p.idx,{preferBlock,mulligan});records.push({kind:logicalKind(r),actor:p.idx,state,rawKind:r.kind,answer:copy(value)});return oldAnswer(g,p,r,value);}};
 try{const g=new E.Game({seed,mode:'strict',decks:[key,key],agents:[agent,agent]});g._pilotSeed=seed;let calls=78;const random=g.rand;g.rand=()=>{calls++;return random();};g._rngCalls=()=>calls;await g.run();return {records,final:oldState(g,calls)};}finally{delete E.DECKS[key];}
}
function runNew({seed=1,deck='skills',preferBlock=false,mulligan=false,snapshotAt}={}){
 const m=new Match({seed,id:'pilot-'+seed,decks:[decks[deck],decks[deck]]}),records=[],checkpoints=[];
 for(let n=0;n<2000;n++){
  if(m.snapshot().match.phase==='finished')return {records,final:newState(m),checkpoints,match:m};
  const raw=m.view(0).request||m.view(1).request;if(!raw)throw Error('No pending request');
  const q=newQuestion(m,raw),state=newState(m),value=newAnswer(q,select(q,state,raw.actor,{preferBlock,mulligan}));
  if(snapshotAt?.(raw,n))checkpoints.push({snapshot:m.snapshot(),index:records.length});
  records.push({kind:logicalKind(raw),actor:raw.actor,state,rawKind:raw.kind,answer:copy(value)});
  m.dispatch({matchId:raw.matchId,requestId:raw.requestId,epoch:raw.epoch,actor:raw.actor,value});
 }
 throw Error('Pilot match did not finish');
}
module.exports={decks,runOld,runNew,newState,newQuestion,newAnswer,select,logicalKind};
