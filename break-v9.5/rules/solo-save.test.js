'use strict';
const assert=require('node:assert/strict'),{TableSession}=require('./table-session'),H=require('../host-choice');
const deck=['D01-009','D02-005','D04-006','D03-007'].flatMap(c=>Array(10).fill(c));
const next=s=>s.match.request(0)||s.match.request(1),canon=x=>JSON.parse(JSON.stringify(x,(k,v)=>['epoch','requestId'].includes(k)?undefined:v));
function create(mode='numeric'){const s=new TableSession({id:'save-test',seed:7,decks:[deck,deck],deckKeys:['a','b'],mode,wantsAck:[true,true],delay:1000});s.checkpoint();return s;}
function same(s){const record=JSON.parse(JSON.stringify(s.checkpoint())),r=TableSession.fromCheckpoint(record);assert.deepEqual(canon(r.match.snapshot()),canon(s.match.snapshot()));assert.deepEqual(r.status(),s.status());assert.equal(r.local.entries.length,s.local.entries.length);assert.equal(r.noticeIndex,s.noticeIndex);return r;}
for(const mode of ['strict','numeric']){const s=create(mode);let count=0,manual=false,loss=false;
 for(let i=0;i<500&&s.match._m.phase!=='finished';i++){const r=next(s);if(i%9===0){same(s);count++;}
  if(mode==='numeric'&&r.canManual&&!manual){s.local.command({kind:'manual',matchId:r.matchId,requestId:r.requestId,epoch:r.epoch,actor:r.actor,action:{kind:'draw'}});same(s);assert(s.local.undo());same(s);manual=true;continue;}
  if(r.canLoss&&!loss&&r.actor===0){s.local.command({kind:'loss',matchId:r.matchId,requestId:r.requestId,epoch:r.epoch,actor:r.actor});same(s);loss=true;continue;}
  s.local.command({kind:'answer',answer:H.aiAnswer(r)});
 }
 assert.equal(s.match._m.phase,'finished');same(s);assert(count>5);assert(JSON.stringify(s.checkpoint()).length<500000,'compact save avoids repeated Undo snapshots');
}
{
 const s=create();for(let i=0;i<4;i++)s.local.command({kind:'answer',answer:H.aiAnswer(next(s))});s.noticeIndex=Math.min(1,s.match._m.notices.length);const record=s.checkpoint();same(s);
 for(const mutate of [r=>r.version++,r=>r.stamp='bad',r=>r.base.rng.word++,r=>r.options.seed++,r=>r.noticeIndex=-1,r=>r.journal[0].actor=1-r.journal[0].actor,r=>r.journal[0].kind='invalid']){const bad=structuredClone(record);mutate(bad);assert.throws(()=>TableSession.fromCheckpoint(bad));}
 const restored=same(s);assert(s.local.undo());assert(restored.local.undo());assert.deepEqual(canon(s.match.snapshot()),canon(restored.match.snapshot()),'restored Undo points are exact');
}
console.log('solo save: full strict/numeric matches, compact replay, RNG, manual/Loss/Undo, notices, corrupt/version rejection passed');
