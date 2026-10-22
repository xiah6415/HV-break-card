'use strict';
const assert=require('node:assert/strict'),I=require('./node-inventory'),F=require('./frequent-node-tests'),{matchesPrinted}=require('./batch-fixtures');
function testResultMatch(catalog){
 const forms=I.forms(catalog).all_result_cards_match;
 for(const {node:n}of forms.values()){
  const def=catalog.cards.find(c=>matchesPrinted(c.profiles[0],n.filters));
  assert(def,'Printed card satisfying '+JSON.stringify(n.filters));
  const k=F.game(catalog),source=k.addCard('HV-D01-009',0,'attack'),ctx=k._context(source,0);k.preflight(n);
  const ids=[k.addCard(def.card_no,0,'drop'),k.addCard(def.card_no,0,'drop')];
  assert.throws(()=>k.preflight({...n,result:'unknown'}),/Unsupported result-match/);assert.throws(()=>k.preflight({...n,require_nonempty:false}),/Unsupported result-match/);
  const before=k.snapshot();
  for(const result of [undefined,[],ids.slice(0,1),ids]){
   if(result===undefined)delete ctx.bind[n.result];else ctx.bind[n.result]=result;
   assert.equal(k._predicate(n,ctx),!!result?.length,'Actual nonempty results only');
  }
  assert.deepEqual(k.snapshot(),before,'Read-only result predicate');
  // Every specified filter is required for every actual result, not merely one.
  for(const [filter,value]of Object.entries(n.filters)){
   const bad=k.addCard(def.card_no,0,'drop'),printed=k.card(bad).printed;
   if(filter==='tags')printed.affiliation_tags=[];
   else if(filter==='positions')printed.position_tags=[];
   else if(filter==='names')printed.name='Not the required printed name';
   else if(filter==='exclude_names')printed.name=value[0];
   else if(filter==='type')printed.type=value==='character'?'event':'character';
   else if(filter==='skillless'){
    const skilled=catalog.cards.find(c=>c.profiles[0].program);k.card(bad).profileId=skilled.profiles[0].profile_id;
   }else assert.fail('Untested result filter '+filter);
   for(const result of [[bad],[bad,...ids],[...ids,bad]]){ctx.bind[n.result]=result;assert.equal(k._predicate(n,ctx),false,filter+' rejects any nonmatching result');}
  }
  k.restore(before);ctx.bind[n.result]=ids;assert(k._predicate(n,ctx),'Restoring physical results restores the check');
 }
 // Court rename must not change the printed name of cards just paid as Guts.
 {
  const k=F.game(catalog),pair=k.addCard('HV-P01-072',0,'attack'),ctx=k._context(pair,0);k.effect('rename',{target:k.reference(pair),name:'日向翔陽'},ctx);
  assert.equal(k.effectiveName(pair),'日向翔陽');k._atomic(()=>k._move(pair,0,'drop',ctx));ctx.bind.paid=[pair];
  assert(!k._predicate({kind:'all_result_cards_match',result:'paid',filters:{names:['日向翔陽']},require_nonempty:true},ctx));
  assert(k._predicate({kind:'all_result_cards_match',result:'paid',filters:{names:['日向・孤爪']},require_nonempty:true},ctx));
 }
 return forms.size;
}
function testResultCard(catalog,card){for(const condition of I.nodes(card.profiles[0]).filter(n=>n.kind==='all_result_cards_match'))require('./card-scenarios').testCard(catalog,card,{condition});}
module.exports={testResultMatch,testResultCard};
if(require.main===module)console.log('all_result_cards_match: '+testResultMatch(require('./data/cards.json'))+' forms; all/mixed/empty/missing, every conjunct and printed paid names passed');
