'use strict';
const assert=require('node:assert/strict'),I=require('./node-inventory'),F=require('./frequent-node-tests'),{fixture}=require('./batch-smoke');
function testFormal(catalog){
 for(const card of catalog.cards)for(const p of card.profiles){const n=p.formal_cost;if(!n)continue;
  for(const mode of ['positive','short']){
   const k=F.game(catalog),id=k.addCard(card.card_no,0,'hand'),ctx=k._context(id,0),steps=n.steps,move=steps.find(n=>n.kind==='move_self'),guts=steps.find(n=>n.kind==='pay_guts');
   if(guts)for(const a of guts.areas){for(let i=0;i<(mode==='short'?guts.count-1:guts.count);i++)k.addCard('HV-D01-009',0,a);k.addCard('HV-D01-001',0,a);}
   if(mode==='short'&&move)k._atomic(()=>k._move(id,0,move.destination.split('.')[1],ctx));
   k.preflight(n);ctx.paid=['prior-skill'];ctx.bind.paid=['prior-skill'];const before=k.snapshot(),invoke=()=>k._atomic(()=>k._run(n,ctx));
   if(mode==='short'){assert.throws(invoke,/Formal declaration cost cannot be paid/);assert.deepEqual(k.snapshot(),before);assert.equal(ctx.inPayment,false);continue;}
   assert(invoke());assert(!ctx.paid.includes('prior-skill'));assert.deepEqual(ctx.bind.paid,ctx.paid);assert.equal(ctx.inPayment,false);
   if(move){assert.equal(k.card(id).zone,'0.'+move.destination.split('.')[1]);assert.deepEqual(ctx.paid,[id]);assert.equal(k.state.events.filter(e=>e.type==='move'&&e.id===id).length,1);}
   else assert.equal(ctx.paid.length,guts.count);
   const after=k.snapshot();k.restore(before);const replay=k._context(id,0);k._atomic(()=>k._run(n,replay));assert.deepEqual(k.snapshot(),after,'Formal cost replay '+card.card_no);
  }
 }
 const n=structuredClone(I.forms(catalog).formal_declaration_cost.values().next().value.node),k=F.game(catalog);
 for(const key of ['must_be_complete','performed_for_this_skill_only']){const bad={...n,[key]:false};assert.throws(()=>k.preflight(bad),/Unsupported declaration cost/);}
 const partial={...n,steps:[{kind:'move_self',destination:'owner.drop',reason:'declaration_cost'},{kind:'pay_guts',areas:['attack'],count:2,count_mode:'exact',bind:'paid'}]},id=k.addCard('HV-D01-009',0,'hand'),before=k.snapshot();assert.throws(()=>k.resolveProgram(partial,0,id),/Formal declaration cost cannot be paid/);assert.deepEqual(k.snapshot(),before,'An incomplete compound cost restores every earlier step');
 return I.forms(catalog).formal_declaration_cost.size;
}
function seedCard(catalog,card,focus){const p=card.profiles[0],phase=p.activation.activation_phases[0];return {...fixture(card,p,phase,{rich:true,conditioned:true,expanded:true,max:true,key:'positive',focus},0,catalog),phase};}
function testFormalCard(catalog,card){
 const p=card.profiles[0],condition=I.nodes(p).find(n=>n.kind==='conditional')?.condition;
 for(const mode of ['positive','negative','short']){
  const {k,id}=seedCard(catalog,card,mode==='negative'&&condition?{node_id:condition.node_id,value:false}:undefined);
  if(mode==='negative'&&condition?.kind==='count_compare'&&condition.pool.zone==='court'){const area=condition.pool.filters.role,def=catalog.cards.find(c=>!c.profiles[0].program&&c.profiles[0].variants[0].printed.parameters[area]!=='dash'&&!require('./batch-fixtures').matchesPrinted(c.profiles[0],Object.fromEntries(Object.entries(condition.pool.filters).filter(([key])=>key!=='role'))));k.addCard((def||catalog.cards.find(c=>c.card_no==='HV-D01-009')).card_no,0,area);}
  if(mode==='negative'&&!condition)for(const n of I.nodes(p).filter(n=>n.kind==='numeric'&&typeof n.target==='object'))for(const x of [...k.pool(n.target,k._context(id,0))])k._atomic(()=>k._move(x,0,'deck',k._context(id,0)));
  if(mode==='short')for(const n of p.formal_cost.steps){if(n.kind==='move_self')k._atomic(()=>k._move(id,0,n.destination.split('.')[1],k._context(id,0)));else if(n.kind==='pay_guts')for(const a of n.areas)for(const x of [...k.zone(0,a)].slice(0,-1))k._atomic(()=>k._move(x,0,'deck',k._context(id,0)));}
  const before=k.snapshot(),run=()=>k.useSkill(id);
  if(mode==='short'){assert.throws(run);assert.deepEqual(k.snapshot(),before,'Failed formal declaration rolls back '+card.card_no);continue;}
  const result=run(),after=k.snapshot(),moves=after.events.slice(before.events.length).filter(e=>e.type==='move');
  for(const n of p.formal_cost.steps){if(n.kind==='move_self')assert.equal(moves.filter(e=>e.id===id&&e.reason==='declaration_cost').length,1);else assert.equal(moves.filter(e=>e.from==='0.'+n.areas[0]&&e.to==='0.drop').length,n.count);}
  assert(!after.decisions.slice(before.decisions.length).some(d=>d.request.kind==='activate_payment'),'Formal cost is compulsory, not an optional payment branch');
  if(mode==='positive'){assert(result.performed,card.card_no+' must perform an effect after cost');const back=I.nodes(p).find(n=>n.kind==='keyword'&&n.keyword==='back_attack');if(back){assert.equal(k.top(0,'attack'),id);assert.equal(k.parameter(id,'attack'),back.N);assert.equal(k.card(id).entryOrigin,'hand');}}
  else assert.equal(after.effects.length,before.effects.length,card.card_no+' negative condition / empty target leaves cost paid');
  k.restore(before);run();assert.deepEqual(k.snapshot(),after,'Formal card Undo '+card.card_no+' '+mode);
 }
}
module.exports={testFormal,testFormalCard,seedCard};
