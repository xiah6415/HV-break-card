'use strict';
const assert=require('node:assert/strict'),I=require('./node-inventory'),{fixture}=require('./batch-smoke'),M=require('./modules'),catalog=require('./data/cards.json');
const cases={
 'P02-050':{cost:2,param:'toss',yes:2,no:2,extraMove:true},
 'P02-074':{cost:1,param:'serve',yes:2,no:0,watch:true},
 'P03-031':{cost:2,param:'toss',yes:2,no:0},
 'P04-032':{cost:3,param:'attack',yes:7,no:5},
 'P04-057':{cost:3,keyword:'doshat'},
 'P04-063':{cost:3,param:'attack',yes:7,no:0},
 'P04-076':{cost:2,param:'toss',yes:1,no:0,draw:true},
 'D04-001':{cost:2,param:'attack',yes:2,no:0}
};
for(const [code,expected]of Object.entries(cases))for(const mode of ['all_match','mixed','short']){
 const card=catalog.cards.find(c=>I.short(c.card_no)===code);assert(M.eligible(card));const p=card.profiles[0],nodes=I.nodes(p),condition=nodes.find(n=>n.kind==='all_result_cards_match'),phase=p.activation.trigger.destination_any[0];
 const {k,id,entryReason}=fixture(card,p,phase,{rich:true,conditioned:true,expanded:true,max:true,key:'positive',...(mode==='mixed'?{focus:{node_id:condition.node_id,value:false}}:{})},0,catalog);
 if(mode==='short')for(const a of ['serve','block','receive','toss','attack','side:0','side:1'])for(const x of k.zone(0,a).slice(0,a===phase?k.zone(0,a).length:-1))k._atomic(()=>k._move(x,0,'deck',k._context(id,0)));
 const entryName=nodes.find(n=>n.kind==='compare'&&n.field==='source.entry_skill_name'),source=entryName?k.addCard(catalog.cards.find(c=>c.profiles[0].variants[0].printed.name===entryName.value).card_no,0,'event'):null;
 const seen=[],predicate=k._predicate;k._predicate=function(n,ctx){const value=predicate.call(this,n,ctx);if(n===condition)seen.push({value,paid:[...ctx.bind.paid]});return value;};
 function invoke(){if(source)k._atomic(()=>{k._enter(id,0,phase,k._context(source,0),'skill');k._drain();});else k.enter(id,phase,{reason:entryReason});}
 const before=k.snapshot();invoke();const after=k.snapshot(),effects=after.effects.slice(before.effects.length);
 if(mode==='short'){assert.deepEqual(seen,[]);assert(!after.decisions.slice(before.decisions.length).some(d=>d.request.kind==='activate_payment'));assert.equal(effects.length,0);}
 else {
  assert.equal(seen.length,1,code+' checks once after actual payment');assert.equal(seen[0].value,mode==='all_match');assert.equal(seen[0].paid.length,expected.cost);assert(seen[0].paid.every(x=>k.card(x).zone==='0.drop'),'Failed conditions still consume payment');
  if(expected.param)assert.equal(effects.filter(e=>e.kind==='numeric'&&e.target.id===id&&e.parameter===expected.param).reduce((n,e)=>n+e.value,0),mode==='all_match'?expected.yes:expected.no,code+' printed bonus');
  if(expected.watch)assert.equal(effects.some(e=>e.kind==='watch'),mode==='all_match');
  if(expected.keyword){assert.equal(effects.some(e=>e.kind==='keyword'&&e.keyword===expected.keyword&&e.N===8),mode==='all_match');if(mode==='all_match')assert.equal(k.outgoing('block',0).offense,8);}
  if(expected.draw)assert.equal(after.events.slice(before.events.length).filter(e=>e.type==='move'&&e.from==='0.deck'&&e.to==='0.hand').length,mode==='all_match'?1:0);
  if(expected.extraMove)assert.equal(after.events.slice(before.events.length).filter(e=>e.type==='move'&&e.to==='0.attack'&&e.reason!=='explicit_entry').length,mode==='all_match'?1:0);
 }
 k.restore(before);seen.length=0;invoke();assert.deepEqual(k.snapshot(),after,'Undo after payment and guard '+code+' '+mode);
}
console.log('result-match cards: eight printed effects x all/mixed/short; cost consumed on false, base bonus retained, guarded effects and Undo passed');
