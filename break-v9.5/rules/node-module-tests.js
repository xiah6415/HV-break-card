'use strict';
const assert=require('node:assert/strict'),{Kernel}=require('./core'),{forms,clean}=require('./node-inventory');
const ruleIds=require('./data/shared-rules.json').rules.map(r=>r.id);
// Independent printed-text oracle; do not use Kernel.matches to choose fixtures
// or calculate expected cards, otherwise a filter bug would validate itself.
function printedMatch(printed,filters){return Object.entries(filters).every(([key,value])=>{
 if(key==='type')return printed.type===value;
 if(key==='names')return value.includes(printed.name);
 const field={tags:'affiliation_tags',tags_any:'affiliation_tags',positions:'position_tags',positions_any:'position_tags'}[key];
 assert(field,'Untested deck filter '+key);
 return key.endsWith('_any')?value.some(v=>printed[field].includes(v)):value.every(v=>printed[field].includes(v));
});}
function game(catalog,choose){const k=new Kernel({catalog,ruleIds,fingerprint:'node-module-tests',mode:'sandbox',choose});k.state.turn.phase='draw';return k;}
function deckFixture(catalog,node,variant='positive',destination='deck_top'){
 const k=game(catalog,r=>r.kind==='reveal'?true:r.kind==='revealResult'?[]:r.kind==='move_count'?r.options.at(-1):r.kind==='mode'?destination:r.options.slice(0,r.count));
 const source=k.addCard('HV-D01-009',0,'hand'),ctx=k._context(source,0),player=k.owner(node.actor,ctx);
 const candidates=catalog.cards.flatMap(c=>c.profiles.map((p,index)=>({c,p,index})));
 function find(filters,inverse=false){const row=candidates.find(({p})=>{const yes=printedMatch(p.variants[0].printed,filters);return inverse?!yes:yes;});assert(row,'No printed fixture '+JSON.stringify(filters));return row;}
 const matching=find(node.selection.filters),negative=find(node.selection.filters,true);
 const secondary=node.secondary_selection?find(node.secondary_selection.filters):null;
 const ids=[];const add=row=>k.addCard(row.c.card_no,player,'deck',row.index);
 const tail=add(negative);
 if(variant!=='empty')for(let i=0;i<node.top_count;i++)ids.push(add(variant==='positive'&&i===node.top_count-1?matching:variant==='positive'&&secondary&&i===node.top_count-2?secondary:negative));
 // Keep an unexamined card below the view, except in the empty-deck case.
 if(variant==='empty'){k.zone(player,'deck').pop();delete k.state.cards[tail];}
 return {k,ctx,source,player,shown:ids.reverse(),tail};
}
function testSequence(catalog){
 const k=game(catalog),ctx=k._context(null,0),calls=[],original=k._run;
 const a={kind:'test-child',n:1},b={kind:'test-child',n:2};
 k._run=function(n,c){if(n.kind==='test-child'){calls.push(n.n);return n.n===1;}return original.call(this,n,c);};
 assert.equal(k._run({kind:'sequence',steps:[a,b]},ctx),true);assert.deepEqual(calls,[1,2]);
 assert.equal(k._run({kind:'sequence',steps:[]},ctx),false);
 return 1;
}
function checkDeck(catalog,node,variant,destination='deck_top'){
 const {k,ctx,player,shown,tail}=deckFixture(catalog,node,variant,destination),before=k.snapshot();
 if(variant==='empty'){assert.equal(k._atomic(()=>k._run(node,ctx)),false);assert.deepEqual(ctx.bind[node.bind],[]);return;}
 const selected=variant==='positive'?shown.filter(id=>printedMatch(k.card(id).printed,node.selection.filters)).slice(0,node.selection.count_mode==='all'?shown.length:node.selection.count):[];
 if(node.secondary_selection&&selected.length){const extra=shown.find(id=>!selected.includes(id)&&printedMatch(k.card(id).printed,node.secondary_selection.filters));if(extra)selected.push(extra);}
 assert.equal(k._atomic(()=>k._run(node,ctx)),true);
 assert.deepEqual(k.zone(player,'hand').filter(id=>id!==ctx.source.id),selected);
 assert.deepEqual(ctx.bind[node.selection.bind],selected);assert.deepEqual(ctx.bind[node.bind],shown);
 const remainder=shown.filter(id=>!selected.includes(id));
 const expected=node.remainder.destination==='choose_deck_top_or_bottom'&&destination==='deck_top'?[tail,...remainder.toReversed()]:[...remainder.toReversed(),tail];
 assert.deepEqual(k.zone(player,'deck'),expected);
 if(node.visibility==='look')assert(!k.state.publicLog.some(l=>l.type==='deck_view'&&l.cards),'private look must not publish cards');
 else assert.deepEqual(k.state.publicLog.find(l=>l.type==='deck_view').cards,shown.map(id=>({id,cardNo:k.card(id).cardNo})));
 const end=k.snapshot();k.restore(before);k._atomic(()=>k._run(node,k._context(ctx.source.id,0)));assert.deepEqual(k.snapshot(),end);
}
function testDeckSelection(catalog){
 const shapes=forms(catalog).deck_selection;
 for(const {node}of shapes.values()){
  for(const variant of ['positive','negative','empty'])checkDeck(catalog,node,variant);
  if(node.remainder.destination==='choose_deck_top_or_bottom')checkDeck(catalog,node,'positive','deck_bottom');
  const {k,ctx,player}=deckFixture(catalog,node);
  k.effect('ban',{action:'add_hand',actor:player,scope:{}},ctx);
  k._atomic(()=>k._run(node,ctx));assert.deepEqual(ctx.bind[node.selection.bind],[],'hand ban prevents adding');
 }
 return shapes.size;
}
module.exports={testSequence,testDeckSelection,deckFixture,printedMatch};
