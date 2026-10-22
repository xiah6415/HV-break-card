'use strict';
const assert=require('node:assert/strict'),I=require('./node-inventory'),F=require('./frequent-node-tests');
const codes=['P01-034','PR-024','P04-093','P04-094'];
function testShuffle(catalog){
 const forms=I.forms(catalog).shuffle;
 for(const{node}of forms.values())for(const controller of [0,1])for(const count of [0,1,4]){
  const k=F.game(catalog),id=k.addCard('HV-D01-009',controller,'event'),who=node.actor==='self'?controller:1-controller,ids=[];for(let i=0;i<count;i++)ids.push(k.addCard('HV-D01-009',who,'deck'));const untouched=k.addCard('HV-D04-003',1-who,'deck'),ctx=k._context(id,controller),before=k.snapshot();let calls=0;k._random=()=>{calls++;return 0;};k.preflight(node);
  assert.equal(k._modeAvailable(node,ctx),count>1);assert.deepEqual(k.snapshot(),before,'Optional preview preserves identities, order and RNG');calls=0;assert.equal(k.resolveProgram(node,controller,id),count>1);assert.equal(calls,Math.max(0,count-1));assert.deepEqual(k.zone(who,'deck'),count>1?[...ids.slice(1),ids[0]]:ids);assert.deepEqual(k.zone(1-who,'deck'),[untouched]);assert.deepEqual(k.state.cards,before.cards,'Shuffling preserves physical instances and zones');assert.deepEqual(k.view(1-who).publicLog,count>1?[{type:'deck_shuffled',player:who,count}]:[],'Only owner/count are public, never the permutation or card IDs');
  const after=k.snapshot();k.restore(before);calls=0;k.resolveProgram(node,controller,id);assert.deepEqual(k.snapshot(),after,'Shuffle local replay');
  assert.throws(()=>k.preflight({...node,actor:'owner'}),/shuffle parameters/);
 }
 return forms.size;
}
function setup(catalog,card,mode='positive'){
 const p=card.profiles[0],code=I.short(card.card_no),phase=code==='P01-034'?'serve':code==='PR-024'?'toss':code==='P04-094'?'receive':'serve',k=F.game(catalog),id=k.addCard(card.card_no,0,'hand');k.state.turn.phase=phase;k.state.ball={kind:'attack',offense:8,owner:1};k.state.rng.word=7;
 const passive=p.activation.skill_type==='passive',fee=code==='PR-024'?3:1;
 if(passive){
  for(let i=0;i<(mode==='short'?fee-1:fee);i++)k.addCard(mode==='wrong_fee'?'HV-D01-009':'HV-D04-003',0,phase);
  for(const code of ['HV-D01-009','HV-D04-003','HV-P01-004'].slice(0,mode==='empty_hand'?0:3))k.addCard(code,1,'hand');
 }
 const deck=['HV-D01-009','HV-D04-003','HV-P01-004','HV-P03-048','HV-D04-003'];
 for(const who of [0,1])for(const code of deck.slice(0,mode==='empty'?0:mode==='one'?1:5))k.addCard(code,who,'deck');
 if(!passive){
  const def=catalog.cards.find(c=>!c.profiles[0].program&&c.profiles[0].variants[0].printed.type==='character'&&c.profiles[0].variants[0].printed.affiliation_tags.includes('条善寺')&&c.profiles[0].variants[0].printed.parameters.receive!=='dash');assert(def);
  if(!['no_court','both_empty','no_target'].includes(mode))k.addCard(def.card_no,0,'receive');
  if(code==='P04-093'){
   if(!['empty_drop','both_empty'].includes(mode))k.addCard(def.card_no,0,'drop');k.addCard(def.card_no,0,'event');k.addCard('HV-D01-009',0,'event');
   if(mode==='mixed_drop')k.addCard('HV-D01-009',0,'drop');
   if(mode==='wrong_court')k.addCard('HV-D01-009',0,'attack');
   if(k.top(0,'receive')){const guts=k.addCard('HV-D01-009',0,'receive');k.zone(0,'receive').unshift(k.zone(0,'receive').pop());}
  }
 }
 if(mode==='no_add')k.resolveProgram({kind:'ban_action',actor:passive?'opponent':'self',action:'add_hand',scope:{origins:['skill']},duration:'this_turn'},0,id);
 k.choose=r=>['activate_payment','optional'].includes(r.kind)?mode!=='decline':F.choose(r);
 return{k,id,p,phase,code,shuffle:true};
}
function invoke(f){return f.p.activation.skill_type==='event'?f.k.playEvent(f.id):f.k.enter(f.id,f.phase);}
function testShuffleCard(catalog,card){
 const code=I.short(card.card_no),passive=card.profiles[0].activation.skill_type==='passive',modes=passive?['positive','short','decline','empty_hand','empty','no_add',...(code==='P01-034'?['wrong_fee']:[])]:code==='P04-093'?['positive','decline','no_court','empty_drop','both_empty','mixed_drop','wrong_court','empty','one']:['positive','decline','empty','one','no_target','no_add'];
 for(const mode of modes){
  const f=setup(catalog,card,mode),{k,id,phase}=f,before=k.snapshot(),events=k.state.events.length;invoke(f);const after=k.snapshot(),shuffles=after.publicLog.slice(before.publicLog.length).filter(e=>e.type==='deck_shuffled'),did=shuffles.length>0;
  const expected=passive?!['short','decline','wrong_fee'].includes(mode):code==='P04-093'?!['decline','both_empty','mixed_drop','wrong_court'].includes(mode):!['decline','empty','one'].includes(mode);
  assert.equal(did,expected,code+' '+mode+' shuffle');
  if(passive){
   const reshuffle=expected,draw=mode==='no_add'?0:reshuffle?Math.min(code==='P01-034'?6:4,before.zones['1.hand'].length+before.zones['1.deck'].length):before.zones['1.hand'].length;assert.equal(k.zone(1,'hand').length,draw);assert.equal(k.zone(0,'drop').length,['short','decline'].includes(mode)?0:code==='P01-034'?1:3);
   if(code==='PR-024')assert.equal(k.parameter(id,'toss'),k.card(id).printed.parameters.toss+(!['short','decline'].includes(mode)?2:0));
   if(expected){const moves=after.events.slice(events).filter(e=>e.type==='move');assert.deepEqual(moves.filter(e=>e.from==='1.hand'&&e.to==='1.deck').map(e=>e.id),before.zones['1.hand']);assert.equal(k.zone(1,'deck').length,mode==='no_add'?before.zones['1.deck'].length+before.zones['1.hand'].length:before.zones['1.deck'].length+before.zones['1.hand'].length-draw);}
  }else if(code==='P04-093'){
   if(expected){assert.equal(k.card(id).zone,'0.deck','QA1937: this Event returns too');assert(k.zone(0,'event').every(x=>!k.card(x).printed.affiliation_tags.includes('条善寺')));assert.equal(k.zone(0,'drop').length,0);}else assert.equal(k.card(id).zone,'0.event');
   assert.equal(k.zone(0,'hand').length,mode==='empty'?0:1);assert.equal(k.state.locks.filter(l=>l.name===k.card(id).printed.name).length,1);
  }else{const target=k.top(0,'receive');if(target)assert.equal(k.parameter(target,'receive'),k.card(target).printed.parameters.receive+1);assert.equal(k.zone(0,'hand').length,['empty','no_add'].includes(mode)?0:1);}
  if(!expected)assert.deepEqual(after.rng,before.rng,'No shuffle consumes no RNG');else assert.equal(after.rng.calls-before.rng.calls,shuffles[0].count-1,'Exactly one Fisher-Yates pass, no extra preview draws');
  k.restore(before);invoke(f);assert.deepEqual(k.snapshot(),after,'Card shuffle Undo '+code+' '+mode);
 }
}
module.exports={codes,testShuffle,setup,invoke,testShuffleCard};
