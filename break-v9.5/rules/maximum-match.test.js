'use strict';
const assert=require('node:assert/strict'),{Match}=require('./match'),H=require('../host-choice');
const deck=['P03-047','P03-096','P04-088','D01-009','P01-004','P01-001','P01-009','D04-003','P01-022','P01-030'].flatMap(c=>Array(4).fill(c));const increments=new Set();
for(const seed of [7,11,19]){
 const m=new Match({seed,decks:[deck,deck]}),k=m._kernel;let steps=0,restored=false;
 while(m.snapshot().match.phase!=='finished'&&steps++<2000){let r=m.request(0)||m.request(1);assert(r);let a=H.aiAnswer(r);
  if(r.kind==='receiver'){const alt=r.options.filter(o=>o.card?.cardNo!=='HV-P03-047').sort((a,b)=>(b.card?.parameters?.receive||0)-(a.card?.parameters?.receive||0));if(alt.length)a=H.makeAnswer(r,alt[0].value);}
  if(r.kind==='setter'){const v=r.options.find(o=>o.card?.cardNo==='HV-P03-047');if(v)a=H.makeAnswer(r,v.value);}
  if(r.kind==='event'){const v=r.options.find(o=>o.value!==null);if(v)a=H.makeAnswer(r,v.value);}
  if(r.kind==='turnEnd'&&r.context.outgoing.kind==='attack'&&k.top(r.actor,'toss')&&k.card(k.top(r.actor,'toss')).cardNo==='HV-P03-047'){assert.equal(r.context.outgoing.offense,k.parameter(k.top(r.actor,'toss'),'toss')+k.parameter(k.top(r.actor,'attack'),'attack'),'Outgoing ball uses current boosted setter, not an earlier toss cache');if(!restored){const saved=m.snapshot();m.restore(saved);r=m.request(0)||m.request(1);a=H.aiAnswer(r);restored=true;}}
  assert(H.validate(r,a).ok);m.dispatch(a);for(const e of k.state.effects)if(e.kind==='numeric'&&e.parameter==='toss'&&e.source&&k.card(e.source.id).cardNo==='HV-P03-047')increments.add(seed+':'+e.id);
 }
 assert.equal(m.snapshot().match.phase,'finished');console.log('maximum match seed '+seed+': '+steps+' decisions / complete local game and current outgoing values passed');
}
assert(increments.size>0,'Full matches must actually resolve the new setter skill');console.log('source maximum full matches: '+increments.size+' actual guarded increments passed');
