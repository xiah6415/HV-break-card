'use strict';
const assert=require('node:assert/strict'),I=require('./node-inventory'),F=require('./frequent-node-tests');
function testRetrieve(catalog){
 const forms=I.forms(catalog).retrieve;
 for(const {node}of forms.values())for(const size of [0,1,4])for(const banned of [false,true]){
  const k=F.game(catalog),source=k.addCard('HV-D01-009',0,'attack'),ctx=k._context(source,0),ids=[];
  for(let i=0;i<size;i++){const id=k.addCard('HV-D01-009',0,'drop');k.card(id).printed.name='名字'+i;k.card(id).printed.affiliation_tags=['共同校'];ids.push(id);}
  k.pool=()=>[...ids];if(banned)k.effect('ban',{action:'add_hand',actor:0,scope:{}},ctx);
  const before=k.snapshot(),invoke=()=>k.resolveProgram(node,0,source);invoke();
  const count=banned?0:Math.min(size,node.count);assert.deepEqual(k.zone(0,'hand'),ids.slice(0,count));
  assert.equal(k.state.events.slice(before.events.length).filter(e=>e.type==='hand_added').length,count);
  k.assertState();const after=k.snapshot();k.restore(before);invoke();assert.deepEqual(k.snapshot(),after,'retrieve Undo/replay');
 }
 // Independent adversarial groups: illegal first choices are pruned, shared
 // affiliation requires one tag common to the whole group, not equal tag arrays.
 const base={kind:'retrieve',pool:{kind:'selector',actor:'self',zone:'court.guts',filters:{}},destination:'self.hand',count:2,count_mode:'exact',bind:'retrieved'};
 for(const constraint of ['single_area','distinct_names','shared_affiliation']){
  const k=F.game(catalog),ids=[];
  for(const [area,name,tags]of [['receive','A',['甲']],['toss','B',['乙']],['toss','C',['乙','丙']]]){
   const id=k.addCard('HV-D01-009',0,area);k.card(id).printed.name=name;k.card(id).printed.affiliation_tags=tags;ids.push(id);
  }
  for(const a of ['receive','toss'])k.addCard('HV-D01-009',0,a);
  if(constraint==='distinct_names')k.card(ids[1]).printed.name='A';
  const n={...base,group_constraints:{[constraint]:true}},requests=[];
  k.choose=r=>{requests.push(r);return F.choose(r);};k.resolveProgram(n,0);
  const expected=constraint==='distinct_names'?[ids[0],ids[2]]:[ids[1],ids[2]];
  assert.deepEqual(k.zone(0,'hand'),expected);
  assert(requests.every(r=>r.count===1),'Existing single-card choice form');
 }
 // No legal pair: do as much as possible without crossing area or repeating name.
 {const k=F.game(catalog),a=k.addCard('HV-D01-009',0,'receive'),b=k.addCard('HV-D01-009',0,'toss');for(const z of ['receive','toss'])k.addCard('HV-D01-009',0,z);
  k.resolveProgram({...base,group_constraints:{single_area:true,distinct_names:true}},0);assert.deepEqual(k.zone(0,'hand'),[a]);assert(k.zone(0,'toss').includes(b));}
 // Same printed name in Guts is not changed by a former on-court rename.
 {const k=F.game(catalog),a=k.addCard('HV-D01-009',0,'receive'),b=k.addCard('HV-D01-009',0,'toss');k.effect('rename',{target:k.reference(a),name:'舊場上改名'},k._context(a,0));for(const z of ['receive','toss'])k.addCard('HV-D01-009',0,z);
  k.resolveProgram({...base,group_constraints:{distinct_names:true}},0);assert.equal(k.zone(0,'hand').length,1);}
 // Invalid second choice must roll back the entire group, including logs.
 {const k=F.game(catalog),ids=[];for(let i=0;i<2;i++){const id=k.addCard('HV-D01-009',0,'drop');k.card(id).printed.name='名字'+i;ids.push(id);}
  let asked=0;k.choose=r=>++asked===1?[ids[0]]:[ids[0]];
  const before=k.snapshot();assert.throws(()=>k.resolveProgram({...base,pool:{kind:'selector',actor:'self',zone:'drop',filters:{}},group_constraints:{distinct_names:true}},0),/Invalid physical-card selection/);assert.deepEqual(k.snapshot(),before);
 }
 {const k=F.game(catalog);assert.throws(()=>k.preflight({...base,group_constraints:{invented:true}}),/Unsupported retrieve constraint/);}
 return forms.size;
}
module.exports={testRetrieve};
if(require.main===module)console.log('retrieve: '+testRetrieve(require('./data/cards.json'))+' forms / grouped constraints / shortage / hand bans / Undo passed');
