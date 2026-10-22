'use strict';
const assert=require('node:assert/strict'),I=require('./node-inventory'),F=require('./frequent-node-tests');
const codes=['P01-010','P01-092','P01-093'];
function testRevealTop(catalog){
 const forms=I.forms(catalog).reveal_top;
 for(const{node:n}of forms.values())for(const count of [0,1,3]){
  const k=F.game(catalog),source=k.addCard('HV-D01-009',0,'event'),ctx=k._context(source,0),ids=Array.from({length:count},()=>k.addCard('HV-D04-003',0,'deck')),before=k.snapshot();let asks=0;
  k.choose=r=>{asks++;if(asks===1){assert.equal(r.kind,'reveal');assert.deepEqual(r.options,[true]);assert(!JSON.stringify(r).includes(ids.at(-1)||'hidden-missing'));return true;}assert.equal(r.kind,'revealResult');assert.deepEqual(r.options,[ids.at(-1)]);assert.equal(r.count,0);assert.equal(r.purpose,'effect');return [];};
  k.preflight(n);assert.equal(k._atomic(()=>k._run(n,ctx)),count>0);assert.equal(asks,count?2:0);assert.deepEqual(ctx.bind.revealed,count?[ids.at(-1)]:[]);assert.deepEqual(k.state.zones,before.zones,'Viewing does not move or draw cards');assert.deepEqual(k.state.rng,before.rng);assert.deepEqual(k.state.cards,before.cards);
  if(count){assert.deepEqual(k.state.publicLog.at(-1).cards,[{id:ids.at(-1),cardNo:'HV-D04-003'}]);k.restore(before);k.choose=()=>false;assert.throws(()=>k.resolveProgram(n,0,source),/Confirm deck view/);assert.deepEqual(k.snapshot(),before);}
  for(const bad of [{actor:'opponent'},{count:2},{count_mode:'upto'},{bind:'other'}])assert.throws(()=>k.preflight({...n,...bad}),/reveal top parameters/);
 }
 return forms.size;
}
function testMoveResult(catalog){
 const forms=I.forms(catalog).move_result;
 for(const{node:n}of forms.values())for(const count of [0,1,3]){
  const k=F.game(catalog),source=k.addCard('HV-D01-009',0,'event'),ctx=k._context(source,0),base=k.addCard('HV-D04-003',0,'deck'),ids=Array.from({length:count},()=>k.addCard('HV-D01-009',0,'deck')),gone=k.addCard('HV-D04-003',0,'drop');ctx.bind.revealed=[...ids,gone,...ids];const before=k.snapshot();
  k.preflight(n);assert.equal(k._atomic(()=>k._run(n,ctx)),count>0);assert.deepEqual(ctx.bind.moved,ids);assert.deepEqual(k.zone(0,'deck'),[...ids].reverse().concat(base),'First chosen is drawn first when the returned bottom group is reached');assert.equal(k.card(gone).zone,'0.drop','Never pull a previously revealed card from another zone');assert.deepEqual(k.state.cards,before.cards);assert.deepEqual(k.state.rng,before.rng);
  const after=k.snapshot();k.restore(before);const replay=k._context(source,0);replay.bind.revealed=[...ids,gone,...ids];k._atomic(()=>k._run(n,replay));assert.deepEqual(k.snapshot(),after);
  for(const bad of [{result:'drawn'},{destination:'owner.hand'},{order:'random'}])assert.throws(()=>k.preflight({...n,...bad}),/move result parameters/);
 }
 return forms.size;
}
function setup(catalog,card,mode='positive',parameter='attack'){
 const k=F.game(catalog),p=card.profiles[0],code=I.short(card.card_no),phase=code==='P01-092'?'receive':'serve',id=k.addCard(card.card_no,0,'hand');k.state.turn.phase=phase;k.state.ball={kind:'attack',offense:8,owner:1};
 let target=null,other=null;if(mode!=='no_target'){target=k.addCard('HV-D01-009',0,'receive');other=k.addCard('HV-D04-003',0,'toss');}
 const revealedCode=mode==='matching'?'HV-D04-003':code==='P01-010'?'HV-D01-009':card.card_no;let shown=null;
 if(!['empty','one'].includes(mode)){
  k.addCard('HV-P03-048',0,'deck');k.addCard('HV-P01-004',0,'deck');shown=k.addCard(revealedCode,0,'deck');
 }
 if(code!=='P01-010'&&!['empty','no_add'].includes(mode))k.addCard('HV-D01-009',0,'deck');
 if(code==='P01-010'&&mode==='one')shown=k.addCard(revealedCode,0,'deck');
 if(mode==='invalid'){
  if(code==='P01-010')k.resolveProgram({kind:'invalidate_skill',actor:'self',selector:{roles:['serve']},duration:'this_turn'},0,id);
  else k.state.locks.push({player:0,turn:k.state.turn.id,name:k.card(id).printed.name});
 }
 if(mode==='no_add')k.resolveProgram({kind:'ban_action',actor:'self',action:'add_hand',scope:{origins:['skill']},duration:'this_turn'},0,id);
 k.choose=r=>r.kind==='parameter'?r.options.includes(parameter)?parameter:r.options[0]:F.choose(r);
 return{k,id,p,code,phase,target,other,shown,parameter};
}
function invoke(f){return f.p.activation.skill_type==='event'?f.k.playEvent(f.id):f.k.enter(f.id,f.phase);}
function testRevealCard(catalog,card){
 const code=I.short(card.card_no);
 for(const mode of ['positive','matching','empty','one','invalid',...(code==='P01-010'?[]:['no_target','no_add'])]){
  const f=setup(catalog,card,mode),{k,id,target,other,shown}=f,before=k.snapshot();
  if(code==='P01-093'&&mode==='empty'){assert.throws(()=>invoke(f),/OPEN-EVENT-NO-CHANGE/);assert.deepEqual(k.snapshot(),before);continue;}
  invoke(f);const after=k.snapshot(),revealed=mode!=='invalid'&&!!shown,condition=mode!=='matching'&&revealed;
  assert.equal(after.decisions.slice(before.decisions.length).filter(d=>d.request.kind==='reveal').length,revealed?1:0,code+' '+mode+' player initiates one mandatory reveal');
  if(revealed){assert.equal(k.zone(0,'deck')[0],shown,'Only the revealed card goes to the bottom');assert.equal(after.publicLog.filter(e=>e.type==='revealed_returned').length,1);}
  assert.equal(k.zone(0,'hand').length,mode==='invalid'||['empty','no_add'].includes(mode)||code==='P01-010'?0:1);
  if(code==='P01-010')assert.equal(after.effects.filter(e=>e.kind==='watch').length,condition?1:0);
  if(code==='P01-092'&&target){assert.equal(k.parameter(target,'receive'),2+(mode==='invalid'?0:1)+(condition?1:0));assert.equal(k.parameter(other,'receive'),k.card(other).printed.parameters.receive,'Additional +1 stays on the first selected character');assert.equal(after.decisions.slice(before.decisions.length).filter(d=>d.request.kind==='target').length,mode==='invalid'?0:1);}
  if(code==='P01-093'){if(target)assert.equal(k.parameter(target,f.parameter),k.card(target).printed.parameters[f.parameter]+(condition?1:0));assert.equal(after.effects.filter(e=>e.kind==='ban'&&e.action==='play_event').length,condition?1:0);}
  assert.deepEqual(after.rng,before.rng,'Reveal and bottom placement never shuffle');k.restore(before);invoke(f);assert.deepEqual(k.snapshot(),after,'Reveal card Undo '+code+' '+mode);
 }
}
module.exports={codes,testRevealTop,testMoveResult,setup,invoke,testRevealCard};
