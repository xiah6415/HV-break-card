'use strict';
const assert=require('node:assert/strict'),I=require('./node-inventory'),F=require('./frequent-node-tests'),{fixture}=require('./batch-smoke');
function testReview(catalog){
 const card=code=>catalog.cards.find(c=>I.short(c.card_no)===code),profile=code=>card(code).profiles[0],nodes=code=>I.nodes(profile(code));
 const node=(code,kind,match=()=>true)=>nodes(code).find(n=>n.kind===kind&&match(n));
 const plain=(k,p=0,z='attack')=>k.addCard('HV-D01-009',p,z);
 const rename=(k,id,name)=>k.effect('rename',{target:k.reference(id),name},k._context(id,0));
 const positive=code=>{const c=card(code),p=c.profiles[0],phase=p.activation.skill_type==='passive'?p.activation.trigger.destination_any?.[0]||p.activation.trigger.source_role||'serve':p.activation.activation_phases[0];return {...fixture(c,p,phase,{rich:true,max:true,conditioned:true,expanded:true,key:'positive'},0,catalog),p,phase};};
 const invoke=f=>f.p.activation.skill_type==='event'?f.k.playEvent(f.id):f.p.activation.skill_type==='active'?f.k.useSkill(f.id):f.k.enter(f.id,f.phase,{reason:f.entryReason||'rule'});
 const remove=(k,id)=>{const c=k.card(id),z=k.state.zones[c.zone];z.splice(z.indexOf(id),1);c.zone=c.owner+'.sets';k.zone(c.owner,'sets').push(id);};
 // 1,3: hand payment uses the printed name of the combined-name card.
 for(const [code,combined,name]of [['P02-098','PR-018','牛島若利'],['P03-061','PR-013','木兎光太郎']]){
  const k=F.game(catalog),source=plain(k),id=k.addCard('HV-'+combined,0,'hand'),pool=node(code,'move',n=>n.pool.filters.names).pool,ctx=k._context(source,0);
  assert.equal(k.card(id).printed.name.includes('・'),true);assert(!k.pool(pool,ctx).includes(id));assert.equal(k._paymentAvailable({kind:'sequence',steps:[node(code,'move',n=>n.pool.filters.names)]},ctx),false);
 }
 // 2,4: court conditions read the chosen effective name.
 for(const [code,combined,area,name]of [['P02-098','PR-018','attack','五色工'],['D03-002','P02-077','toss','宮侑']]){
  const k=F.game(catalog),id=k.addCard('HV-'+combined,0,area);rename(k,id,name);
  assert(k._predicate(node(code,'compare',n=>n.field.endsWith('.effective_name')),k._context(id,0)));k.endTurn();assert.equal(k.effectiveName(id),k.card(id).printed.name);
 }
 // 5,6: affiliation tags are exact, not substrings.
 for(const [code,tag,zone]of [['P03-026','疑似ユース','event'],['P03-038','音駒中','hand']]){
  const k=F.game(catalog),source=plain(k),def=catalog.cards.find(c=>c.profiles[0].variants[0].printed.affiliation_tags.includes(tag)),id=k.addCard(def.card_no,0,zone),cost=node(code,'move');
  assert(!k.pool(cost.pool,k._context(source,0)).includes(id));assert(!k._paymentAvailable({kind:'sequence',steps:[cost]},k._context(source,0)));
 }
 // 7: short draw does not abort the remaining discard, return or bonus.
 for(const code of ['P02-025','P02-070','P02-085','D03-002'])for(const stock of [0,1]){
  const f=positive(code),{k}=f;while(k.zone(0,'deck').length>stock)remove(k,k.top(0,'deck'));
  const seen=[];const draw=k._draw;k._draw=function(p,n,...rest){const ids=draw.call(this,p,n,...rest);seen.push({n,ids});return ids;};
  const before=k.snapshot();invoke(f);assert(k.state.decisions.some(d=>d.request.kind==='activate_payment'&&d.answer===true));
  for(const row of seen)assert.equal(row.ids.length,Math.min(stock,row.n));
  if(['P02-070','D03-002'].includes(code))assert(k.state.effects.length>before.effects.length);
  if(code==='P02-025')assert(k.state.events.slice(before.events.length).some(e=>e.type==='move'&&e.to==='0.drop'&&e.from==='0.hand'));
  k.assertState();
 }
 // 8: incoming attack offense may become negative.
 {const f=positive('P01-091');f.k.state.ball.offense=0;invoke(f);assert.equal(f.k.state.ball.offense,-1);}
 // 9,10: no attack field for serve/block, even with a stale low-attack card.
 for(const code of ['P01-091','P03-067'])for(const kind of ['serve','block']){
  const f=positive(code),{k}=f;k.state.ball={owner:1,kind,offense:7};
  if(code==='P03-067')assert(k.card(k.top(1,'attack')).printed.parameters.attack<=1);
  const choose=k.choose,requests=[];k.choose=r=>{requests.push(r);return r.ineffectiveReason?false:choose(r);};invoke(f);
  assert.equal(k.state.ball.offense,7);assert(requests.some(r=>r.ineffectiveReason));
  assert(!k.state.decisions.some(d=>d.request.ineffectiveReason&&d.answer===true));
 }
 // 11: controller chooses a public opponent Event, returned to its owner's bottom.
 {const k=F.game(catalog),source=plain(k),n=node('P02-080','move'),def=catalog.cards.find(c=>c.profiles[0].variants[0].printed.position_tags.some(p=>['監督','元監督','コーチ'].includes(p))),ids=[k.addCard(def.card_no,1,'event'),k.addCard(def.card_no,1,'event')];
  k.choose=r=>{assert.equal(r.player,0);return [ids[1]];};k.resolveProgram(n,0,source);assert.deepEqual(k.zone(1,'deck'),[ids[1]]);assert.deepEqual(k.zone(1,'event'),[ids[0]]);
 }
 // 12: event_played is supported; its cost primitive still pays exactly two.
 {const k=F.game(catalog),source=k.addCard('HV-P03-039',0,'serve'),n=node('P03-039','move'),def=catalog.cards.find(c=>c.profiles[0].variants[0].printed.affiliation_tags.includes('稲荷崎')&&c.profiles[0].activation?.activation_phases.includes('serve'));
  const ids=Array.from({length:4},()=>k.addCard(def.card_no,0,'event')),ctx=k._context(source,0);ctx.inPayment=true;k.choose=r=>{assert.equal(r.count,2);return ids.slice(1,3);};k._atomic(()=>k._run(n,ctx));assert.equal(k.zone(0,'drop').length,2);assert.deepEqual(k.zone(0,'event'),[ids[0],ids[3]]);assert(I.entrySupported(card('P03-039')));
 }
 // 13: at the exact threshold, opponent chooses their own private discard.
 for(const [code,threshold]of [['P04-018',4],['PR-025',3]])for(const count of [threshold,threshold-1]){
  const f=positive(code),{k}=f;while(k.zone(1,'hand').length>count)remove(k,k.top(1,'hand'));while(k.zone(1,'hand').length<count)plain(k,1,'hand');
  const chosen=k.zone(1,'hand').at(-1),choose=k.choose;let offered=false;
  k.choose=r=>{if(r.kind==='move_cards'&&r.player===1){offered=true;return [chosen];}return choose(r);};invoke(f);assert.equal(offered,count===threshold);assert.equal(k.zone(1,'drop').includes(chosen),count===threshold);
 }
 // 14: preserve covered effective-name metadata now; do not invent an entry.
 for(const code of ['PR-001','PR-002']){
  const k=F.game(catalog),covered=k.addCard('HV-PR-057',0,'attack'),expected=profile(code).activation.trigger.filters.covered_names[0];rename(k,covered,expected);
  const next=plain(k,0,'hand');k.state.turn.phase='attack';k.enter(next,'attack');assert.equal(k.card(next).coveredCharacter.effective_name,expected);assert(!I.entrySupported(card(code)));
 }
 // Six resolved doubts: both printed versions have identical semantics, but
 // their not-yet-supported trigger families remain locked.
 for(const code of ['P02-077','P02-078','P03-077'])for(const p of card(code).profiles)assert.equal(p.program.steps[0].duration,'this_turn');
 for(const stock of [0,1,2]){const k=F.game(catalog),source=k.addCard('HV-P02-064',0,'attack');for(let i=0;i<stock;i++)plain(k,0,'hand');k.resolveProgram(profile('P02-064').program,0,source);assert.equal(k.state.decisions.some(d=>d.request.kind==='optional'),stock===2);assert.equal(k.zone(0,'drop').length,stock===2?2:0);if(stock<2)for(const p of ['serve','block','receive','toss','attack'])if(k.card(source).printed.parameters[p]!=='dash')assert.equal(k.parameter(source,p),0);}
 for(const current of [2,3,5]){const k=F.game(catalog),source=k.addCard('HV-P03-047',0,'toss'),ctx=k._context(source,0);k.card(source).printed.parameters.toss=2;if(current>2)k.effect('numeric',{target:k.reference(source),parameter:'toss',operation:'add',value:current-2},k._context(null,0));k.resolveProgram(profile('P03-047').program,0,source);assert.equal(k.parameter(source,'toss'),current===2?3:current);k.effect('numeric',{target:k.reference(source),parameter:'toss',operation:'add',value:3},k._context(null,0));assert.equal(k.parameter(source,'toss'),(current===2?3:current)+3);}
 for(const p of card('P04-072').profiles){const k=F.game(catalog),source=plain(k),character=plain(k,0,'drop'),event=k.addCard('HV-P01-091',0,'drop');for(const id of [character,event])k.card(id).printed.affiliation_tags=['疑似ユース'];assert.deepEqual(k.pool(p.program.steps[1].pool,k._context(source,0)),[character]);}
 return 14;
}
module.exports={testReview};
if(require.main===module)console.log('script review: '+testReview(require('./data/cards.json'))+' required rows + six resolved card doubts passed; unsupported entries remain locked');
