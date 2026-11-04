'use strict';
const assert=require('node:assert/strict'),{Match}=require('./rules/match'),{LocalSession}=require('./rules/local-session'),H=require('./host-choice'),T=require('./browser-test-helpers.cjs'),CL=require('./card-library'),UI=require('./choice-ui');
for(const code of ['PR-029','P03-057','P04-087']){
 const f=T.fixture({name:'draw-before-receive-'+code,phase:'draw',pc:'drawAck',hand:[code,'D01-009'],drop:['P01-001','P01-006']}),local=new LocalSession(f.options),m=local.match;m.restore(f.snapshot);
 const answer=value=>{const r=m.request(0);local.command({kind:"answer",answer:H.makeAnswer(r,value)});};
 assert.equal(m.request(0).kind,'ack');const before=m.snapshot();answer(true);
 let r=m.request(0);assert.equal(r.kind,'event');assert.equal(r.timing,'draw');assert(r.options.some(o=>o.value===f.refs.hand[0]),code+' available before receiving');assert.match(UI.requestPrompt(r),/抽牌階段/);assert.equal(m._kernel.top(0,'receive'),null);
 answer(f.refs.hand[0]);let steps=0;
 while((r=m.request(0))?.origin==='kernel'&&steps++<30){assert.equal(r.timing,'draw');assert.equal(m._kernel.top(0,'receive'),null);answer(H.aiAnswer(r).value);}
 assert(steps<30);if(r.kind==='event')answer(null);assert.equal(m.request(0).kind,'receiver');assert.equal(m.request(0).timing,'receive');assert.equal(m._kernel.top(0,'receive'),null);
 while(local.undo()){}assert.deepEqual(m.snapshot().zones,before.zones);
 console.log(code+' draw skill resolves before receiver; Undo passed');
}
const f=T.fixture({phase:'draw',pc:'drawEvent',hand:['P01-076','D01-009']}),m=new Match(f.options);m.restore(f.snapshot);assert.equal(m.request(0).kind,'receiver','no eligible effect means no empty window');
const draw=CL.search('','all').filter(c=>c.activationPhases?.includes('draw'));assert(draw.length>=30);console.log('draw-phase catalog entries:',draw.length,'; unavailable effects skip window; late before-judgment window retained separately');
