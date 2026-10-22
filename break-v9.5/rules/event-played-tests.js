'use strict';
const assert=require('node:assert/strict'),F=require('./frequent-node-tests');
function setup(catalog,card,mode='positive'){
 const k=F.game(catalog),serve=card.card_no==='HV-P03-039',dest=serve?'serve':'attack';k.state.turn.phase=dest;k.state.ball={kind:'attack',offense:8,owner:1};
 if(!serve)for(let i=0;i<(mode==='short'?2:6);i++)k.addCard('HV-D01-009',0,dest);
 const id=k.addCard(card.card_no,0,dest),event=k.addCard(serve?'HV-P03-091':'HV-P02-082',0,'hand');
 if(serve&&mode!=='short')k.addCard('HV-P02-086',0,'event');
 for(let i=0;i<8;i++)k.addCard('HV-D01-009',0,'deck');
 if(mode==='decline'){const choose=k.choose;k.choose=r=>r.kind==='activate_payment'?false:choose(r);}
 if(mode==='wrong_role'){k._move(id,0,'receive',k._context(id,0));if(serve)k.addCard('HV-D01-009',0,'serve');}
 return {k,id,event,dest,p:card.profiles[0]};
}
function testEventCard(catalog,card){
 for(const mode of ['positive','decline','short','wrong_role']){
  const {k,id,event,dest}=setup(catalog,card,mode),before=k.snapshot(),serve=dest==='serve';k.playEvent(event);const after=k.snapshot();
  const trigger=after.events.slice(before.events.length).filter(e=>e.type==='resolve_trigger'&&!e.generated);
  assert.equal(trigger.length,mode==='wrong_role'?0:1,card.card_no+' '+mode+' actual Event trigger');
  if(mode!=='wrong_role')assert.equal(k.parameter(id,dest),serve?mode==='positive'?7:6:k.card(id).printed.parameters.attack+1+(mode==='positive'?4:0),card.card_no+' '+mode+' printed bonus after Event');
  const asked=after.decisions.slice(before.decisions.length).some(d=>d.request.kind==='activate_payment');assert.equal(asked,!['short','wrong_role'].includes(mode));
  k.restore(before);k.playEvent(event);assert.deepEqual(k.snapshot(),after,'Event-play Undo/replay '+card.card_no+' '+mode);
 }
}
module.exports={setup,testEventCard};
