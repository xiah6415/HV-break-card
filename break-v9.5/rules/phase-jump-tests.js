'use strict';
const assert=require('node:assert/strict'),F=require('./frequent-node-tests'),I=require('./node-inventory');
function testPhaseJump(catalog){
 const forms=I.forms(catalog).phase_jump;
 for(const{node}of forms.values()){
  const k=F.game(catalog),id=k.addCard('HV-D01-009',0,'block');k.state.turn={id:17,player:0,phase:'block',step:'free'};
  k.resolveProgram({kind:'ban_action',actor:'self',action:'add_hand',scope:{origins:['skill']},duration:'this_turn'},0,id);
  k.state.queue.push({id:'old-window',controller:0,source:k.reference(id),generated:true,window:'17:block',program:{kind:'draw',actor:'self',count:1,count_mode:'exact'},event:{}});
  const saved=k.snapshot();k.preflight(node);k._atomic(()=>k._run(node,k._context(id,0)));assert.deepEqual(k.state.turn,{id:17,player:0,phase:'draw',step:'start'});assert.equal(k.state.queue.length,0);assert.equal(k.state.effects.length,1);const after=k.snapshot();k.restore(saved);k._atomic(()=>k._run(node,k._context(id,0)));assert.deepEqual(k.snapshot(),after);
  for(const bad of [{actor:'opponent'},{destination:'toss'},{position:'end'},{skip_current:false}])assert.throws(()=>k.preflight({...node,...bad}),/phase jump parameters/);
 }
 return forms.size;
}
function setup(catalog,card,mode='positive'){
 const k=F.game(catalog);k.state.turn.phase='block';k.state.ball={kind:'attack',offense:mode==='threshold'?7:8,owner:1};
 const id=k.addCard(card.card_no,0,'hand');if(mode!=='short')k.addCard('HV-D01-009',0,'block');
 if(mode==='decline'){const choose=k.choose;k.choose=r=>r.kind==='activate_payment'?false:choose(r);}
 // Only court characters count; the old neutral Guts do not invalidate Youth.
 if(mode==='school')k.addCard('HV-D01-009',0,'receive');
 for(let i=0;i<5;i++)k.addCard('HV-D01-009',0,'deck');
 return{k,id,p:card.profiles[0]};
}
function testPhaseCard(catalog,card){
 for(const mode of ['positive','threshold','decline','short',...(card.card_no==='HV-P03-030'?['school']:[])]){
  const{k,id}=setup(catalog,card,mode),before=k.snapshot(),jump=mode==='positive'||['short','decline'].includes(mode)&&card.card_no==='HV-P03-030';k.enter(id,'block');const after=k.snapshot();
  assert.equal(k.state.turn.phase,jump?'draw':'block',card.card_no+' '+mode);assert.equal(k.state.turn.id,before.turn.id);assert.equal(k.state.turn.player,0);assert.equal(k.zone(0,'deck').length,5,'The flow shell performs the draw, not the effect node');
  assert.equal(k.state.effects.filter(e=>e.kind==='watch').length,jump?1:0);
  k.restore(before);k.enter(id,'block');assert.deepEqual(k.snapshot(),after,'Phase jump local replay '+card.card_no+' '+mode);
 }
}
module.exports={testPhaseJump,setup,testPhaseCard};
