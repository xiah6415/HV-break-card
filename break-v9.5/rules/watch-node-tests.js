'use strict';
const assert=require('node:assert/strict'),I=require('./node-inventory'),F=require('./frequent-node-tests');
function testWatch(catalog){
 const forms=I.forms(catalog).watch;
 for(const {node}of forms.values()){
  const n=structuredClone(node);n.then={kind:'draw',actor:'self',count:1,count_mode:'exact',bind:'watch_unit'};
  const k=F.game(catalog),source=k.addCard('HV-D01-009',0,'event'),who=n.actor==='self'?0:1,f=n.filters;
  const area=f.role==='side_blocker'?'side:0':['block','center_blocker'].includes(f.role)?'block':f.role&&f.role!=='character'?f.role:'attack';
  const id=n.event==='source_moved'?source:k.addCard('HV-D01-009',who,n.event==='hand_added'?'hand':area),p=k.card(id).printed;
  p.name=f.names?.[0]||p.name;p.affiliation_tags=f.tags||p.affiliation_tags;p.position_tags=f.positions||p.position_tags;p.year_tags=f.years_any?.slice(0,1)||p.year_tags;
  if(f.printed_block_gte!=null)p.parameters.block=f.printed_block_gte;if(f.printed_receive_gte!=null)p.parameters.receive=f.printed_receive_gte;
  const event={type:n.event,player:who,card:id,character:k.reference(id),role:area==='block'?'center_blocker':area==='side:0'?'side_blocker':area,origin:f.entry_origins?.[0]||'hand',operation:'add_hand',from_zone:'event',to_zone:'drop',entry_keyword_family:f.entry_keyword_family||null};
  let fires=0;const run=k._run;k._run=function(n,c){if(n.bind==='watch_unit'){fires++;assert.equal(c.controller,0);return true;}return run.call(this,n,c);};
  const emit=e=>k._atomic(()=>{k._emit(e);k._drain();});
  k.registerWatch(n,0,source);
  if(n.duration==='next_opponent_turn'){emit(event);assert.equal(fires,0);k.endTurn();k.beginTurn(1);}
  emit({...event,player:1-who});assert.equal(fires,0,'Wrong actor must not trigger');
  if(n.event==='source_moved'){const other=k.addCard('HV-D01-009',0,'drop');emit({...event,card:other});assert.equal(fires,0,'Source watcher must not observe unrelated cards');}
  for(const key of Object.keys(f)){const bad=structuredClone(event),printed=structuredClone(k.card(id).printed),hadSkill=Object.hasOwn(k.profile(id),'printed_has_skill'),oldSkill=k.profile(id).printed_has_skill;
   if(key==='role')bad.role='guts';else if(key==='entry_origins')bad.origin='deck';else if(key==='exclude_operations')bad.operation='draw';else if(key==='entry_keyword_family')bad.entry_keyword_family='other';else if(key==='from_zone'||key==='to_zone')bad[key]='hand';
   else if(key==='names')k.card(id).printed.name='其他名字';else if(key==='tags')k.card(id).printed.affiliation_tags=[];else if(key==='positions')k.card(id).printed.position_tags=[];else if(key==='years_any')k.card(id).printed.year_tags=[];else if(key==='skillless')k.profile(id).printed_has_skill=true;else if(key==='printed_block_gte')k.card(id).printed.parameters.block=f[key]-1;else if(key==='printed_receive_gte')k.card(id).printed.parameters.receive=f[key]-1;else assert.fail('Missing watch filter case '+key);
   emit(bad);assert.equal(fires,0,'Filter must reject '+key);k.card(id).printed=printed;if(key==='skillless'){if(hadSkill)k.profile(id).printed_has_skill=oldSkill;else delete k.profile(id).printed_has_skill;}
  }
  const before=k.snapshot();emit(event);assert.equal(fires,1);const after=k.snapshot();k.restore(before);fires=0;emit(event);assert.equal(fires,1);assert.deepEqual(k.snapshot(),after,'Watch Undo/replay');
  emit(event);assert.equal(fires,n.remaining_uses===1?1:2,'Per-activation use limit');
  if(n.event!=='source_moved'){k._atomic(()=>k._move(source,0,'drop',k._context(source,0)));emit(event);assert.equal(fires,n.remaining_uses===1?1:3,'Generated effect survives source exit');}
  k.endTurn();const old=fires;emit(event);assert.equal(fires,old,'Watch expires after its active turn');k.assertState();
 }
 // Actual host receipts validate ownership, current zones and block outcome.
 const k=F.game(catalog),id=k.addCard('HV-D01-009',0,'drop');
 assert.throws(()=>k.notifyHostEvents([{type:'source_moved',player:1,card:id,from_zone:'event',to_zone:'drop'}]),/owner/);
 assert.throws(()=>k.notifyHostEvents([{type:'source_moved',player:0,card:id,from_zone:'event',to_zone:'unknown'}]),/source move zones/);
 k.notifyHostEvents([{type:'source_moved',player:0,card:id,from_zone:'event',to_zone:'drop'}]);
 assert.throws(()=>k.notifyHostEvents([{type:'loss',player:1}]),/player mismatch/);
 k.advancePhase('block');k.state.ball={kind:'attack',offense:5,owner:1};
 assert.throws(()=>k.notifyHostEvents([{type:'block_success',player:0,defense:4}]),/successful defense/);
 k.notifyHostEvents([{type:'block_success',player:0,defense:5}]);
 return forms.size;
}
module.exports={testWatch};
if(require.main===module)console.log('watch: '+testWatch(require('./data/cards.json'))+' parameter forms / actors, filters, source exit, use limit, expiry and Undo passed');
