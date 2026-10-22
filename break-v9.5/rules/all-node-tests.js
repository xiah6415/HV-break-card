'use strict';
const assert=require('node:assert/strict'),I=require('./node-inventory'),F=require('./frequent-node-tests');
function testAll(catalog){
 const rows=I.forms(catalog).all;
 for(const card of catalog.cards)for(const p of card.profiles)for(const node of I.nodes(p).filter(n=>n.kind==='all')){
  // Child predicates have their own modules. Exercise every boolean combination
  // and evaluation order for every actual all container in the corpus.
  for(let mask=0;mask<2**node.conditions.length;mask++){
   const k=F.game(catalog),ctx=k._context(null,0),original=k._predicate,seen=[];
   k._predicate=function(n,c){const index=node.conditions.indexOf(n);if(index>=0){seen.push(index);return !!(mask&(1<<index));}return original.call(this,n,c);};
   const values=node.conditions.map((_,i)=>!!(mask&(1<<i))),firstFalse=values.indexOf(false),before=k.snapshot();
   assert.equal(k._predicate(node,ctx),values.every(Boolean));assert.deepEqual(seen,node.conditions.map((_,i)=>i).slice(0,firstFalse<0?undefined:firstFalse+1),'Short-circuit in printed order');assert.deepEqual(k.snapshot(),before,'Condition evaluation is read-only');
   k.restore(before);seen.length=0;assert.equal(k._predicate(node,ctx),values.every(Boolean));
  }
 }
 return rows.size;
}
function testAllCard(catalog,card){for(const node of I.nodes(card.profiles[0]).filter(n=>n.kind==='all'))for(const condition of node.conditions)require('./card-scenarios').testCard(catalog,card,{condition});}
module.exports={testAll,testAllCard};
if(require.main===module)console.log('all: '+testAll(require('./data/cards.json'))+' parameter form / full-corpus boolean combinations, short-circuit and Undo passed');
