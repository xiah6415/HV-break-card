'use strict';
const assert=require('node:assert/strict'),{Match}=require('./match'),H=require('../host-choice'),catalog=require('./data/cards.json'),raw=require('./source/work/card-taxonomy/database.json').cards;
const records=new Map(raw.map(c=>[String(c.id),c])),phases={サーブ:'serve',ブロック:'block',ドロー:'draw',レシーブ:'receive',トス:'toss',アタック:'attack'};let versions=0,profiles=0,legacy=0;
for(const c of catalog.cards)for(const p of c.profiles){if(p.practice_override)legacy++;if(!['event','active'].includes(p.activation?.skill_type))continue;profiles++;for(const v of p.variants){const text=records.get(v.record_id).skill_jp,header=(text.match(/^(?:\s*\[=[^\]]+\])+/)||[''])[0],expected=[...new Set([...header.matchAll(/\[=([^\]]+)\]/g)].map(m=>phases[m[1].replace(/フェイズ$/,'')]).filter(Boolean))].sort();assert.deepEqual([...p.activation.activation_phases].sort(),expected,c.card_no+' '+v.image_file);versions++;}}
// Isolate permission from card-specific costs/conditions: every printed skill
// must appear only in its actual phases, never from a practice override.
const deck=Array(40).fill('D01-009'),m=new Match({decks:[deck,deck]}),k=m._kernel,ids=[];
for(const c of catalog.cards)ids.push(k.addCard(c.card_no,0,'hand'));
m._probe=()=>({performed:true});
for(const phase of ['serve','block','draw','receive','toss','attack','end']){k.state.turn.phase=phase;const expected=ids.filter(id=>{const p=k.profile(id);return p.runtime_approved&&['event','active'].includes(p.activation?.skill_type)&&p.activation.activation_phases.includes(phase);});assert.deepEqual(m._playable(0),expected,'printed phases only: '+phase);}
for(const phase of ['draw','receive']){
 const s=new Match({id:'p02089-'+phase,decks:[['P02-089','P02-016',...Array(38).fill('D01-009')],deck]}),core=s._kernel;
 Object.assign(s._m,{pending:null,continuation:null,phase:'rally',actor:0,turnNo:1,rally:1,pc:phase==='draw'?'drawEvent':'receiveEvent'});core.state.stage='rally';core.state.turn={id:1,player:0,phase,step:'free'};core.state.ball={kind:'attack',offense:0,owner:1};
 for(const [no,zone]of [['HV-P02-089','hand'],['HV-P02-016','drop']]){const id=Object.values(core.state.cards).find(c=>c.owner===0&&c.cardNo===no).id;core._atomic(()=>core._move(id,0,zone,core._context(id,0)));}
 s._pump();const r=s.request(0),option=r?.options.find(o=>o.card?.cardNo==='HV-P02-089');assert.equal(!!option,phase==='draw');if(option){s.dispatch(H.makeAnswer(r,option.value));assert(s.request(0));}
}
console.log('Phase audit: '+catalog.cards.length+' cards / 545 profiles; '+profiles+' active/Event profiles / '+versions+' printed versions; seven-phase permission matrix passed; '+legacy+' legacy draw-window overrides excluded from formal play; P02-089 draw yes / receive no');
