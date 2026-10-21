'use strict';
const assert=require('node:assert/strict'),I=require('./node-inventory'),F=require('./frequent-node-tests');
function testUniformAffiliation(catalog){
 const forms=I.forms(catalog).uniform_affiliation;
 for(const {node}of forms.values())for(const controller of [0,1]){
  const build=()=>{const k=F.game(catalog),source=k.addCard('HV-D01-009',controller,'hand');return {k,ctx:k._context(source,controller)};};
  const add=(k,zone,tags,who=controller)=>{const id=k.addCard('HV-D01-009',who,zone);k.card(id).printed.affiliation_tags=[...tags];return id;};
  const pools=node.pools||[node.pool];
  for(const tag of node.options){
   const {k,ctx}=build();k.preflight(node);assert.equal(k._predicate(node,ctx),false,'Empty pool is not uniform');
   const a=add(k,'attack',[tag,'共通外']),b=add(k,'side:0',[tag]);add(k,'hand',['異校']);add(k,'event',['異校']);add(k,'attack',['異校'],1-controller);
   const buried=add(k,'attack',['異校']);k.zone(controller,'attack').unshift(k.zone(controller,'attack').pop());
   assert.equal(k._predicate(node,ctx),true,'Only visible own characters count; Guts/hand/opponent excluded');
   const before=k.snapshot();assert.equal(k._predicate(node,ctx),true);assert.deepEqual(k.snapshot(),before,'Read-only condition');
   k.card(b).printed.affiliation_tags=['異校'];assert.equal(k._predicate(node,ctx),false,'One mismatched side blocker breaks the common tag');
   k.restore(before);assert.equal(k._predicate(node,ctx),true,'Undo restores common affiliation');
   if(pools.length>1){
    const drop=add(k,'drop',['異校']);assert.equal(k._predicate(node,ctx),false,'All pools share the same common tag');k.card(drop).printed.affiliation_tags=[tag];assert.equal(k._predicate(node,ctx),true);
   }
  }
  if(node.options.length>1){
   const {k,ctx}=build();add(k,'attack',[node.options[0]]);const b=add(k,'receive',[node.options[1]]);
   assert.equal(k._predicate(node,ctx),false,'Each card matching some option is insufficient without an intersection');
   k.card(b).printed.affiliation_tags=[...node.options];assert.equal(k._predicate(node,ctx),true,'Dual affiliation can share the first option');
   k.card(k.top(controller,'attack')).printed.affiliation_tags=[node.options[1]];assert.equal(k._predicate(node,ctx),true,'Second option is equally valid');
  }
  if(pools.length>1)for(const zone of ['attack','drop']){
   const {k,ctx}=build();add(k,zone,[node.options[0]]);assert.equal(k._predicate(node,ctx),true,'Union nonempty does not require every pool to be nonempty');
  }
 }
 return forms.size;
}
module.exports={testUniformAffiliation};
if(require.main===module)console.log('uniform_affiliation: '+testUniformAffiliation(require('./data/cards.json'))+' forms / common intersection, dual tags, visible court, union nonempty and Undo passed');
