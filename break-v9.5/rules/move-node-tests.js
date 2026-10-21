'use strict';
const assert=require('node:assert/strict'),I=require('./node-inventory'),F=require('./frequent-node-tests');
function testMove(catalog){
 const forms=I.forms(catalog).move;
 for(const {node:n}of forms.values())for(const size of [4,1,0]){
  const k=F.game(catalog),source=k.addCard('HV-D01-009',0,'attack'),ctx=k._context(source,0),who=n.pool.actor==='opponent'?1:0;
  const ids=Array.from({length:size},()=>k.addCard('HV-D01-009',who,'hand'));
  // Selector children have their own full parameter tests. Test this node's
  // movement, destination, count, actor and binding independently of that child.
  k.pool=()=>[...ids];const requests=[];
  k.choose=r=>{requests.push(r);return F.choose(r);};
  const destPlayer=n.destination.startsWith('owner.')?who:n.destination.startsWith('opponent.')?1:0;
  const dest=n.destination.split('.').slice(1).join('.');
  if(dest.endsWith('.guts')&&!k.top(destPlayer,dest.split('.')[0]))k.addCard('HV-D01-009',destPlayer,dest.startsWith('chosen_')?'toss':dest.split('.')[0]);
  const before=k.snapshot();let count;
  if(n.count_mode==='all')count=size;
  else if(n.count_mode==='one_of_exact')count=n.allowed_counts.filter(x=>x<=size).at(-1);
  else count=Math.min(n.count,size);
  const invoke=()=>k._atomic(()=>k._run(n,ctx));
  if(count===undefined){assert.throws(invoke);assert.deepEqual(k.snapshot(),before);continue;}
  assert.equal(invoke(),count>0);
  const moved=ids.slice(0,count);assert.deepEqual(ctx.bind[n.bind||'moved'],moved);
  const expectedZone=dest==='deck_bottom'||dest==='choose_deck_top_or_bottom'?'deck':dest.endsWith('.guts')?dest.startsWith('chosen_')?'attack':dest.split('.')[0]:dest;
  for(const id of moved)assert.equal(k.card(id).zone,destPlayer+'.'+expectedZone);
  if(dest==='deck_bottom'||dest==='choose_deck_top_or_bottom')assert.deepEqual(k.zone(destPlayer,'deck').slice(0,count),[...moved].reverse());
  if(dest.endsWith('.guts'))assert(!moved.includes(k.top(destPlayer,expectedZone)),'Guts must stay below the character');
  const chooser=n.pool.zone==='hand'?who:0;
  for(const r of requests.filter(r=>['move_cards','payment_cards','move_count','payment_count'].includes(r.kind)))assert.equal(r.player,chooser);
  k.assertState();const after=k.snapshot();k.restore(before);invoke();assert.deepEqual(k.snapshot(),after,'Move Undo/replay');
 }
 // Exact cost is atomic; exact non-cost effects do as much as possible.
 const k=F.game(catalog),source=k.addCard('HV-D01-009',0,'attack'),only=k.addCard('HV-D01-009',0,'hand');
 const n={kind:'move',pool:{kind:'selector',actor:'self',zone:'hand',filters:{}},destination:'owner.drop',count:2,count_mode:'exact',bind:'moved'},ctx=k._context(source,0);ctx.inPayment=true;
 const before=k.snapshot();assert.throws(()=>k._atomic(()=>k._run(n,ctx)));assert.deepEqual(k.snapshot(),before);assert(k.zone(0,'hand').includes(only));
 for(const answer of [[only,only],['unknown',only]]){k.addCard('HV-D01-009',0,'hand');const before=k.snapshot();k.choose=()=>answer;assert.throws(()=>k._atomic(()=>k._run(n,ctx)));assert.deepEqual(k.snapshot(),before);}
 for(const destination of ['deck_top','deck_bottom']){
  const k=F.game(catalog),source=k.addCard('HV-D01-009',0,'attack'),old=k.addCard('HV-D01-009',0,'deck'),id=k.addCard('HV-D01-009',0,'hand');
  const n=structuredClone([...forms.values()].find(f=>f.node.destination==='self.choose_deck_top_or_bottom').node);
  k.choose=r=>r.kind==='mode'?destination:F.choose(r);k.resolveProgram(n,0,source);
  assert.deepEqual(k.zone(0,'deck'),destination==='deck_top'?[old,id]:[id,old]);
 }
 {const k=F.game(catalog),id=k.addCard('HV-D01-009',0,'hand'),n=structuredClone([...forms.values()].find(f=>f.node.destination==='self.chosen_court_area.guts').node);assert.equal(k.resolveProgram(n,0,id),false);assert(k.zone(0,'hand').includes(id));}
 return forms.size;
}
module.exports={testMove};
if(require.main===module)console.log('move: '+testMove(require('./data/cards.json'))+' parameter forms / counts, owners, destinations, atomic cost, Undo passed');
