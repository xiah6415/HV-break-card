/* Release by recursively completed node kinds + supported entry + card scenarios. */
'use strict';
const assert=require('node:assert/strict');
const I=require('./node-inventory'),T=require('./node-module-tests'),F=require('./frequent-node-tests'),C=require('./card-scenarios');
const completed=[{id:'sequence',test:T.testSequence},{id:'deck_selection',test:T.testDeckSelection},...['numeric','selector','conditional','payment_branch','pay_guts','compare','draw'].map((id,i)=>({id,test:[F.testNumeric,F.testSelector,F.testConditional,F.testPaymentBranch,F.testPayGuts,F.testCompare,F.testDraw][i]}))];
completed.push({id:'move',test:require('./move-node-tests').testMove});
completed.push({id:'count_compare',test:require('./count-node-tests').testCountCompare});
completed.push({id:'retrieve',test:require('./retrieve-node-tests').testRetrieve});
completed.push({id:'watch',test:require('./watch-node-tests').testWatch});
completed.push({id:'uniform_affiliation',test:require('./uniform-node-tests').testUniformAffiliation});
completed.push({id:'all',test:require('./all-node-tests').testAll});
completed.push({id:'keyword',test:require('./keyword-node-tests').testKeyword});
completed.push({id:'rename_before_entry',test:require('./rename-node-tests').testRename});
completed.push({id:'all_result_cards_match',test:require('./result-match-node-tests').testResultMatch});
completed.push({id:'move_self',test:require('./self-move-node-tests').testSelfMove});
completed.push({id:'mill',test:require('./mill-node-tests').testMill});
completed.push({id:'enter',test:require('./enter-node-tests').testEnter});
completed.push({id:'formal_declaration_cost',test:require('./formal-node-tests').testFormal});
completed.push({id:'ban_action',test:require('./ban-node-tests').testBan});
completed.push({id:'invalidate_skill',test:require('./invalid-node-tests').testInvalid});
completed.push({id:'choose_modes',test:require('./mode-node-tests').testModes});
completed.push({id:'optional',test:require('./optional-node-tests').testOptional});

completed.push(...require('./claude-nodes').completed);
completed.push({id:'protect_numeric_decrease',test:require('./protect-node-tests').testProtect});
completed.push({id:'phase_jump',test:require('./phase-jump-tests').testPhaseJump});
completed.push({id:'enter_self',test:require('./self-entry-tests').testEnterSelf});
completed.push({id:'external_action',test:require('./external-tests').testExternal});
completed.push({id:'shuffle',test:require('./shuffle-node-tests').testShuffle});
completed.push({id:'move_result',test:require('./reveal-top-tests').testMoveResult},{id:'reveal_top',test:require('./reveal-top-tests').testRevealTop});
completed.push({id:'simultaneous_entry_group',test:require('./simultaneous-tests').testGroup});
completed.push({id:'cover_source_with_guts',test:require('./source-cover-tests').testCover});
completed.push({id:'force_judgment_failure',test:require('./judgment-tests').testFailure});
completed.push({id:'parameter_absent',test:require('./absent-tests').testAbsent});
completed.push({id:'printed_parameter',test:require('./printed-tests').testPrinted});
completed.push({id:'retrieve_slots',test:require('./slot-tests').testSlots});
completed.push({id:'reveal_and_retrieve',test:require('./reveal-retrieve-tests').testRevealRetrieve});
function testCard(catalog,card){
 if(I.dependencies(card).includes('reveal_and_retrieve'))return require('./reveal-retrieve-tests').testCard(catalog,card);
 if(I.dependencies(card).includes('retrieve_slots'))return require('./slot-tests').testCard(catalog,card);
 if(I.dependencies(card).includes('printed_parameter'))return require('./printed-tests').testCard(catalog,card);
 if(I.dependencies(card).includes('parameter_absent'))return require('./absent-tests').testCard(catalog,card);
 if(I.dependencies(card).includes('force_judgment_failure'))return require('./judgment-tests').testCard(catalog,card);
 if(I.dependencies(card).includes('cover_source_with_guts'))return require('./source-cover-tests').testCard(catalog,card);
 if(I.dependencies(card).includes('simultaneous_entry_group'))return require('./simultaneous-tests').testCard(catalog,card);
 if(I.dependencies(card).includes('reveal_top'))return require('./reveal-top-tests').testRevealCard(catalog,card);
 if(I.dependencies(card).includes('shuffle'))return require('./shuffle-node-tests').testShuffleCard(catalog,card);
 if(I.dependencies(card).includes('external_action'))return require('./external-tests').testExternalCard(catalog,card);
 if(I.dependencies(card).includes('enter_self'))return require('./self-entry-tests').testSelfCard(catalog,card);
 if(I.dependencies(card).includes('phase_jump'))return require('./phase-jump-tests').testPhaseCard(catalog,card);
 if(card.profiles[0].activation.trigger?.event==='self_entry_cover')return require('./self-cover-tests').testSelfCoverCard(catalog,card);
 if(card.profiles[0].activation.trigger?.event==='event_played')return require('./event-played-tests').testEventCard(catalog,card);
 if(card.profiles[0].activation.trigger?.event==='source_covered')return require('./covered-tests').testCoveredCard(catalog,card);
 if(I.dependencies(card).includes('optional'))return require('./optional-node-tests').testOptionalCard(catalog,card);
 if(I.dependencies(card).includes('choose_modes'))return require('./mode-node-tests').testModeCard(catalog,card);
 if(card.profiles[0].formal_cost)return require('./formal-node-tests').testFormalCard(catalog,card);
 if(card.card_no==='HV-P02-037')return require('./enter-node-tests').testSideCard(catalog,card);
 if(I.dependencies(card).includes('move_self')&&I.dependencies(card).includes('deck_selection'))return require('./self-move-node-tests').testSelfMoveCard(catalog,card);
 if(card.profiles[0].activation.trigger?.event==='character_entry')return require('./entry-observer-tests').testEntryCard(catalog,card);
 if(card.profiles[0].activation.skill_type==='permanent_entry_name')return require('./rename-node-tests').testRenameCard(catalog,card);
 if(I.dependencies(card).some(k=>!['sequence','deck_selection'].includes(k)))return C.testCard(catalog,card);
 const p=card.profiles[0],deckNodes=I.nodes(p).filter(n=>n.kind==='deck_selection');
 assert(deckNodes.length,'No scenario builder for card nodes');
 // These are scenario fixtures, not an admission pattern: admission checks every
 // recursive kind above. Future node modules extend fixture seeding as needed.
 for(const variant of ['positive','negative','empty']){
  const n=deckNodes[0],{k,ctx,player,shown}=T.deckFixture(catalog,n,variant);
  const source=k.addCard(card.card_no,0,'hand');
  k.state.turn.phase=p.activation.activation_phases[0];
  const before=k.snapshot();
  if(variant==='empty'){
   assert.throws(()=>k.playEvent(source),/OPEN-EVENT-NO-CHANGE/);assert.deepEqual(k.snapshot(),before);
  }else{
   const expected=variant==='positive'?shown.filter(id=>T.printedMatch(k.card(id).printed,n.selection.filters)).slice(0,n.selection.count_mode==='all'?shown.length:n.selection.count):[];
   if(n.secondary_selection&&expected.length){const secondary=shown.find(id=>!expected.includes(id)&&T.printedMatch(k.card(id).printed,n.secondary_selection.filters));if(secondary)expected.push(secondary);}
   assert(k.playEvent(source).played);
   assert.deepEqual(k.zone(player,'hand').filter(id=>id!==ctx.source.id),expected);
   assert(k.zone(0,'event').includes(source));
   const end=k.snapshot();k.restore(before);k.playEvent(source);assert.deepEqual(k.snapshot(),end);
  }
 }
}
function eligible(card,done=completed.map(m=>m.id)){
 const available=new Set(done);
 return I.entrySupported(card)&&I.dependencies(card).every(kind=>available.has(kind));
}
function testModules(catalog){
 const fs=I.forms(catalog),cards={},modules=[];
 for(const module of completed){
  const tested=module.test(catalog);assert.equal(tested,fs[module.id].size,'Every parameter form must be tested: '+module.id);
  modules.push({id:module.id,parameterForms:tested,dependentCards:new Set([...fs[module.id].values()].flatMap(v=>[...v.cards])).size});
 }
 for(const card of I.scope(catalog)){
  if(!eligible(card))continue;
  testCard(catalog,card);
  if(I.dependencies(card).some(k=>['reveal_and_retrieve','retrieve_slots','printed_parameter','parameter_absent','force_judgment_failure','cover_source_with_guts','simultaneous_entry_group','phase_jump','enter_self','external_action','shuffle','reveal_top'].includes(k))||['source_covered','event_played','self_entry_cover'].includes(card.profiles[0].activation.trigger?.event)){cards[I.short(card.card_no)]={profileId:card.profiles[0].profile_id,modules:I.dependencies(card)};continue;}
  if(I.dependencies(card).includes('protect_numeric_decrease'))require('./protect-node-tests').testProtectCard(catalog,card);
  if(I.dependencies(card).includes('invalidate_skill'))require('./invalid-node-tests').testInvalidCard(catalog,card);
  if(I.dependencies(card).includes('ban_action'))require('./ban-node-tests').testBanCard(catalog,card);
  if(I.dependencies(card).includes('enter'))require('./enter-node-tests').testEffectCard(catalog,card);
  if(card.profiles[0].activation.trigger?.event==='character_entry'){cards[I.short(card.card_no)]={profileId:card.profiles[0].profile_id,modules:I.dependencies(card)};continue;}
  if(I.dependencies(card).includes('all_result_cards_match'))require('./result-match-node-tests').testResultCard(catalog,card);
  if(I.dependencies(card).includes('all'))require('./all-node-tests').testAllCard(catalog,card);
  if(I.dependencies(card).includes('watch'))require('./watch-card-tests').testWatchCard(catalog,card);
  cards[I.short(card.card_no)]={profileId:card.profiles[0].profile_id,modules:I.dependencies(card)};
 }
 require('./script-review-tests').testReview(catalog);
 return {cards,modules};
}
module.exports={completed,eligible,testModules,testCard};
if(require.main===module){const fs=require('node:fs'),input=fs.readFileSync(0,'utf8');process.stdout.write(JSON.stringify(testModules(input?JSON.parse(input):require('./data/cards.json')))+'\n');}
