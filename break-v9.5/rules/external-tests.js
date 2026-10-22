'use strict';
const assert=require('node:assert/strict'),I=require('./node-inventory'),F=require('./frequent-node-tests');
const codes=['P02-048','PR-037','PR-050','PR-063'];
function setup(catalog,card,mode='positive'){
 const k=F.game(catalog),p=card.profiles[0],code=I.short(card.card_no),phase=code==='P02-048'?'block':code==='PR-037'?'attack':code==='PR-063'||mode==='draw'?'draw':'serve';k.state.turn.phase=phase;k.state.ball={kind:'attack',offense:8,owner:1};
 const id=k.addCard(card.card_no,0,'hand');k.state.rng.word=mode==='tails'||mode==='short'||mode==='empty'?1:0;
 const amount=mode==='empty'?0:mode==='short'?2:5;for(const who of [0,1])for(let i=0;i<amount;i++)k.addCard('HV-D01-009',who,'deck');
 if(code==='PR-037'&&mode!=='short')k.addCard('HV-D01-009',0,'hand');
 if(code==='PR-050'&&mode!=='wrong_name'&&mode!=='draw'){
  const v=catalog.cards.find(c=>!c.profiles[0].program&&c.profiles[0].variants[0].printed.name==='山口忠');assert(v);k.addCard(v.card_no,0,'serve');
 }
 k.choose=r=>r.kind==='activate_payment'?mode!=='decline':r.kind==='optional'?mode!=='skip_action':r.kind==='draw_count'&&mode==='no_draw'?0:F.choose(r);
 return{k,id,p,phase,code,external:true};
}
function invoke(f){return f.p.activation.skill_type==='event'?f.k.playEvent(f.id):f.k.enter(f.id,f.phase);}
function testExternal(catalog){
 const forms=I.forms(catalog).external_action;
 for(const{node:n}of forms.values())for(const word of [0,1]){
  const k=F.game(catalog),id=k.addCard('HV-D01-009',0,'attack'),ctx=k._context(id,0);k.state.rng.word=word;ctx.inPayment=true;k.preflight(n);const before=k.snapshot();
  const run=()=>{const c=structuredClone(ctx);const result=k._atomic(()=>k._run(n,c));assert(result);assert(c.externalPaid);assert(n.action==='coin'?['heads','tails'].includes(c.bind.random.result):c.bind.external.performed);return c;};
  const c=run(),after=k.snapshot();assert.equal(after.rng.calls,n.action==='coin'?1:0);assert.equal(after.decisions.length,n.action==='coin'?2:1);if(n.action==='coin')assert.equal(c.bind.random.result,word===0?'heads':'tails');
  k.restore(before);run();assert.deepEqual(k.snapshot(),after,'External replay '+n.action);
  k.restore(before);k.choose=()=>false;assert.throws(()=>k.resolveProgram(n,0,id),/Confirm external action/);assert.deepEqual(k.snapshot(),before,'Illegal ack rolls back action/RNG');
  for(const change of [{action:'invented'},{bind:'other'},...(n.action==='coin'?[{alternative_requires_both_consent:false}]:[])])assert.throws(()=>k.preflight({...n,...change}),/external action parameters/);
 }
 return forms.size;
}
function testExternalCard(catalog,card){
 const code=I.short(card.card_no),modes=code==='P02-048'?['positive','tails','short','empty','decline']:code==='PR-037'?['positive','short','decline']:code==='PR-050'?['positive','skip_action','wrong_name','draw','empty']:['positive','no_draw','empty','decline'];
 for(const mode of modes){
  const f=setup(catalog,card,mode),{k,id,phase}=f,before=k.snapshot();
  if(code==='PR-063'&&mode==='decline'){assert.throws(()=>invoke(f),/OPEN-EVENT-NO-CHANGE/);assert.deepEqual(k.snapshot(),before);continue;}
  invoke(f);const after=k.snapshot(),decisions=after.decisions.slice(before.decisions.length),rng=k.state.rng.calls-before.rng.calls;
  if(code==='P02-048'){
   assert.equal(rng,mode==='decline'?0:1);assert.equal(k.parameter(id,'block'),k.card(id).printed.parameters.block+(mode==='positive'?4:0));assert.equal(k.zone(0,'drop').length,['tails','short'].includes(mode)?Math.min(3,before.zones['0.deck'].length):0);
   if(mode!=='decline')assert.equal(after.publicLog.at(-1).result,mode==='positive'?'heads':'tails');
  }
  if(code==='PR-037'){const yes=mode==='positive';assert.equal(k.zone(0,'drop').length,yes?1:0);assert.equal(k.parameter(id,'attack'),k.card(id).printed.parameters.attack+(yes?3:0));assert.equal(decisions.some(d=>d.request.kind==='external_action'),yes);}
  if(code==='PR-050'){
   assert.equal(k.zone(0,'hand').length,mode==='empty'?0:['draw','wrong_name'].includes(mode)?1:2);assert.equal(k.zone(0,'event').length,1,'Normal Event placement remains independent of optional cheer');assert.equal(decisions.some(d=>d.request.kind==='external_action'),mode!=='skip_action');
   if(k.top(0,'serve'))assert.equal(k.parameter(k.top(0,'serve'),'serve'),6);
  }
  if(code==='PR-063'){for(const who of [0,1])assert.equal(k.zone(who,'hand').length,['no_draw','empty'].includes(mode)?0:2);assert.equal(decisions.filter(d=>d.request.kind==='draw_count').length,2);assert.equal(new Set(decisions.filter(d=>d.request.kind==='draw_count').map(d=>d.request.player)).size,2,'QA1953: each owner chooses their own draw');}
  k.restore(before);invoke(f);assert.deepEqual(k.snapshot(),after,'External card Undo '+code+' '+mode);
 }
}
module.exports={codes,setup,invoke,testExternal,testExternalCard};
