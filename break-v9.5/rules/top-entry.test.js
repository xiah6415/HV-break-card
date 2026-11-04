'use strict';
const assert=require('node:assert/strict'),{Kernel}=require('./core'),R=require('./runtime-data'),F=require('./frequent-node-tests');
const make=()=>new Kernel({catalog:R.catalog,ruleIds:R.ruleIds,fingerprint:R.fingerprint,mode:'live',choose:F.choose});
let cases=0;
for(const grouped of [false,true])for(const lowerHasSkill of [false,true]){
 const k=make();k.state.turn.phase='toss';const source=k.addCard('HV-P02-087',0,'event');
 for(let i=0;i<5;i++)k.addCard('HV-D01-009',0,'toss');for(let i=0;i<6;i++)k.addCard('HV-D01-009',0,'deck');
 const low=k.addCard(lowerHasSkill?'HV-P02-016':'HV-P01-063',0,'hand'),high=k.addCard('HV-P01-006',0,'hand'),seen=[];
 for(let i=0;i<2;i++)k.addCard('HV-D01-009',0,'hand');
 const entries=[['宮侑'],['影山飛雄']].map(names=>({kind:'enter',pool:{kind:'selector',actor:'self',zone:'hand',filters:{names}},destination:'toss',count:1,count_mode:'upto',bind:'entered'}));
 const program=grouped?{kind:'simultaneous_entry_group',entries,complete_group_before_triggers:true}:{kind:'sequence',steps:entries};
 const choose=k.choose;k.choose=r=>{seen.push(r);return choose(r);};
 const run=()=>k._atomic(()=>{k.preflight(program);k._run(program,k._context(source,0));k._drain();});
 const before=k.snapshot();run();assert.equal(k.top(0,'toss'),high);assert.equal(k.role(low),'guts');assert(!seen.some(r=>r.source===low),'covered entry must not ask for activation or payment');assert(!seen.some(r=>r.kind==='trigger_order'),'covered entry must not appear in trigger order');assert(seen.some(r=>r.source===high&&r.kind==='activate_payment'),'top entry retains its skill');assert(!k.state.publicLog.some(e=>e.type==='skill_resolved'&&e.source===low));
 const after=k.snapshot();k.restore(before);seen.length=0;run();assert.deepEqual(k.snapshot(),after,'Undo/replay remains deterministic');k.assertState();cases++;
}
// Printed "when covered" skills are expressly usable as Guts.
{
 const k=make();k.state.turn.phase='receive';const low=k.addCard('HV-P01-023',0,'receive'),top=k.addCard('HV-PR-023',0,'hand');k.enter(top,'receive');assert(k.zone(0,'drop').includes(low),'covered skill can pay by discarding this Guts');assert.equal(k.parameter(top,'receive'),k.card(top).printed.parameters.receive+2);cases++;
}
// A previously resolved "this turn, when Hinata enters" effect remains active
// after its original character is covered; it is not a new Guts activation.
{
 const k=make();k.state.turn.phase='toss';for(let i=0;i<5;i++)k.addCard('HV-D01-009',0,'toss');for(let i=0;i<3;i++)k.addCard('HV-D01-009',0,'deck');
 const id=k.addCard('HV-P01-006',0,'hand');k.enter(id,'toss');assert(k.state.effects.some(e=>e.kind==='watch'&&e.source?.id===id));
 const top=k.addCard('HV-P01-063',0,'hand');k.enter(top,'toss');assert.equal(k.role(id),'guts');
 const target=k.addCard('HV-D01-001',0,'hand');k.state.turn.phase='attack';k.enter(target,'attack');assert.equal(k.parameter(target,'attack'),k.card(target).printed.parameters.attack+2);cases++;
}
console.log('top entry:',cases,'live sequential/grouped entry cases, top-only prompts/order/payment, covered exception and Undo/replay passed');
