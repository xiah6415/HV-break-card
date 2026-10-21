'use strict';
const assert=require('node:assert/strict'),I=require('./node-inventory'),F=require('./frequent-node-tests');
function testCountCompare(catalog){
 const forms=I.forms(catalog).count_compare;
 for(const {node}of forms.values())for(const count of new Set([0,Math.max(0,node.value-1),node.value,node.value+1])){
  const k=F.game(catalog),ctx=k._context(null,0),ids=[];
  for(let i=0;i<count;i++){
   const id=k.addCard('HV-D01-009',0,'drop');k.card(id).printed.name='名字'+i;ids.push(id);
   // Distinct-name counting must ignore duplicate physical copies.
   if(node.distinct_by){const other=k.addCard('HV-D01-009',0,'drop');k.card(other).printed.name='名字'+i;ids.push(other);}
  }
  k.pool=()=>ids;
  const expected=node.op==='eq'?count===node.value:node.op==='gte'?count>=node.value:count<=node.value,before=k.snapshot();
  k.preflight(node);assert.equal(k._predicate(node,ctx),expected,JSON.stringify(I.parameters(node))+' count='+count);assert.deepEqual(k.snapshot(),before,'Counting must not change state');
  k.restore(before);assert.equal(k._predicate(node,ctx),expected);k.assertState();
 }
 // Effective names apply on court; stale rename effects do not follow cards to Drop.
 {const k=F.game(catalog),a=k.addCard('HV-D01-009',0,'attack'),b=k.addCard('HV-D01-009',0,'toss'),ctx=k._context(a,0);
  k.card(a).printed.name='A';k.card(b).printed.name='B';for(const id of [a,b])k.effect('rename',{target:k.reference(id),name:'同一名'},ctx);
  const n={kind:'count_compare',pool:{kind:'selector',actor:'self',zone:'court',filters:{}},distinct_by:'effective_name_in_current_zone',op:'eq',value:1};assert(k._predicate(n,ctx));
  for(const id of [a,b])k._move(id,0,'drop',ctx);n.pool.zone='drop';n.value=2;assert(k._predicate(n,ctx));
  for(const bad of [{...n,op:'unknown'},{...n,value:-1},{...n,distinct_by:'unknown'}])assert.throws(()=>k._predicate(bad,ctx),/Unsupported count/);
 }
 // Card composition: both tiers use the current Event count, not a stale
 // declaration count or the first threshold's boolean result.
 const {fixture}=require('./batch-smoke'),card=catalog.cards.find(c=>c.card_no==='HV-P02-014'),p=card.profiles[0];
 for(const stock of [3,4,5,6]){
  const {k,id}=fixture(card,p,'serve',{rich:true,max:true,conditioned:true,expanded:true,key:'positive'},0,catalog);
  const pool=I.nodes(p).find(n=>n.kind==='count_compare').pool,ctx=k._context(id,0);
  while(k.pool(pool,ctx).length>stock)k._move(k.pool(pool,ctx).at(-1),0,'sets',ctx);
  k.enter(id,'serve');assert.equal(k.parameter(id,'serve'),k.card(id).printed.parameters.serve+(stock>=4?2:0)+(stock>=6?1:0));
 }
 // Eight physical copies with only seven different printed names do not meet
 // an eight-name Drop condition. The second draw/bonus must remain skipped.
 const event=catalog.cards.find(c=>c.card_no==='HV-P04-084'),ep=event.profiles[0],predicate=I.nodes(ep).find(n=>n.kind==='count_compare'&&n.distinct_by);
 const definitions=catalog.cards.filter(c=>{const q=c.profiles[0].variants[0].printed;return q.type==='character'&&q.affiliation_tags.includes('烏野');});
 const distinct=[...new Map(definitions.map(c=>[c.profiles[0].variants[0].printed.name,c])).values()];
 for(const names of [7,8]){
  const {k,id}=fixture(event,ep,'receive',{rich:true,max:true,conditioned:true,expanded:true,key:'positive'},0,catalog),ctx=k._context(id,0);
  for(const old of k.pool(predicate.pool,ctx))k._move(old,0,'sets',ctx);
  for(let i=0;i<8;i++)k.addCard(distinct[i%names].card_no,0,'drop');
  const before=k.snapshot();k.playEvent(id);const drawn=k.state.events.slice(before.events.length).filter(e=>e.type==='hand_added');
  assert.equal(drawn.length,names===8?2:1);assert.equal(k.state.effects.slice(before.effects.length).filter(e=>e.kind==='numeric').reduce((n,e)=>n+e.value,0),names===8?3:1);
 }
 return forms.size;
}
module.exports={testCountCompare};
if(require.main===module)console.log('count_compare: '+testCountCompare(require('./data/cards.json'))+' parameter forms / threshold boundaries / duplicates / current-zone names passed');
