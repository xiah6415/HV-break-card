'use strict';
const assert=require('node:assert/strict'),I=require('./node-inventory'),F=require('./frequent-node-tests'),{distinctNameOptions}=require('./core');
const plain=(k,p=0,z='attack')=>k.addCard('HV-D01-009',p,z);
function testRename(catalog){
 for(const {node:n}of I.forms(catalog).rename_before_entry.values())for(const name of n.choose_name){
  const k=F.game(catalog),id=plain(k),printed=structuredClone(k.card(id).printed);k.choose=()=>name;
  const before=k.snapshot();k.resolveProgram(n,0,id);assert.equal(k.effectiveName(id),name);assert.deepEqual(k.card(id).printed,printed,'Name never changes tags, years, position or printed values');
  const after=k.snapshot();k.restore(before);k.resolveProgram(n,0,id);assert.deepEqual(k.snapshot(),after);
  k._atomic(()=>k._move(id,0,'drop',k._context(id,0)));assert.equal(k.effectiveName(id),printed.name);
  k._atomic(()=>k._move(id,0,'attack',k._context(id,0)));assert.equal(k.effectiveName(id),printed.name,'Returning is a new character');
  k.resolveProgram(n,0,id);k.endTurn();assert.equal(k.effectiveName(id),printed.name);
 }
 assert.deepEqual(distinctNameOptions([['A','B'],['A']]),['B']);assert.deepEqual(distinctNameOptions([['A','B'],['A','B']]),['A','B']);assert.deepEqual(distinctNameOptions([['A'],['A']]),[]);
 return I.forms(catalog).rename_before_entry.size;
}
function testRenameCard(catalog,card){
 const p=card.profiles[0],n=I.nodes(p).find(n=>n.kind==='rename_before_entry');
 for(const mode of ['first','second','restricted']){
  const k=F.game(catalog),id=k.addCard(card.card_no,0,'hand');k.state.turn.phase='attack';
  const other=plain(k,0,'toss');k.card(other).printed.name=mode==='restricted'?n.choose_name[0]:'Unrelated';
  // Receiver skill invalidation must not retroactively cancel a pre-entry name.
  k.resolveProgram({kind:'invalidate_skill',actor:'self',selector:{roles:['attacker']},duration:'this_turn'},0);
  k.choose=r=>{assert.equal(r.kind,'name');if(mode==='restricted')assert.deepEqual(r.options,[n.choose_name[1]]);return mode==='first'?r.options[0]:r.options.at(-1);};
  const before=k.snapshot();k.enter(id,'attack');assert.equal(k.effectiveName(id),mode==='first'?n.choose_name[0]:n.choose_name[1]);assert.equal(k.card(id).printed.name,n.original_name);
  assert(k.matches(id,{names:[k.effectiveName(id)]},k._context(id,0)));assert(k.card(id).printed.affiliation_tags.length);
  const after=k.snapshot();k.restore(before);k.enter(id,'attack');assert.deepEqual(k.snapshot(),after,'Entry Undo '+card.card_no+' '+mode);
  // Covering makes the pair Guts and restores its printed name.
  const cover=plain(k,0,'hand');k.enter(cover,'attack');assert.equal(k.effectiveName(id),n.original_name);
 }
 // Both name choices blocked: atomic rejection, with no name prompt.
 {const k=F.game(catalog),id=k.addCard(card.card_no,0,'hand');k.state.turn.phase='block';const a=plain(k,0,'block'),b=plain(k,0,'side:0');k.card(a).printed.name=n.choose_name[0];k.card(b).printed.name=n.choose_name[1];const before=k.snapshot();k.choose=()=>{throw Error('No name should be offered');};assert.throws(()=>k.enter(id,'block'),/No legal entry name|Dash parameter cannot enter/);assert.deepEqual(k.snapshot(),before);}
}
module.exports={testRename,testRenameCard};
if(require.main===module){const c=require('./data/cards.json');console.log('rename: '+testRename(c)+' forms');for(const card of I.scope(c).filter(c=>c.profiles[0].activation.skill_type==='permanent_entry_name'&&c.profiles.length===1&&!c.profiles[0].flags.length))testRenameCard(c,card);console.log('entry cards: first, second, restricted, rejected, expiry and Undo passed');}
