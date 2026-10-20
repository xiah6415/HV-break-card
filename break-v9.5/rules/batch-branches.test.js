'use strict';
const assert=require('node:assert/strict'),{fixture,runBatch}=require('./batch-smoke'),{driveFollowups}=require('./batch-branches'),{visit}=require('./batch-index');
const catalog=require('./data/cards.json'),sourceBefore=JSON.stringify(catalog),cases=[];
function check(name,fn){fn();cases.push(name);}
function setup(no,player=0,phase=null,focus=null){
 const card=catalog.cards.find(c=>c.card_no==='HV-'+no),p=card.profiles[0];phase ||= p.activation.activation_phases[0]||p.activation.trigger.destination_any[0];
 const f=fixture(card,p,phase,{conditioned:true,expanded:true,max:true,focus},player);
 return {...f,p,phase,player,act:()=>p.activation.skill_type==='event'?f.k.playEvent(f.id):p.activation.skill_type==='active'?f.k.useSkill(f.id):f.k.enter(f.id,phase,{reason:f.entryReason})};
}
const numeric=k=>k.state.effects.filter(e=>e.kind==='numeric').map(e=>[e.parameter,e.value]);
// Expected outcomes come from the frozen Japanese card text, independently of
// the branch seeder and its observed-node metric.
const immediate={
 'D01-011':[['receive',1],['receive',1]],'D03-001':[['toss',1]],
 'P01-077':[['receive',2]],'P02-017':[['toss',2]],
 'P02-061':[['receive',3],['receive',3]],'P02-073':[['attack',4]],
 'P03-021':[['toss',2]],'P03-067':[['receive',4]],
 'P04-053':[['attack',3]],'P04-060':[['attack',2],['attack',2]],
 'P04-063':[['attack',7]],'PR-030':[['receive',2]],
 'PR-049':[['receive',3]],'PR-084':[['attack',1],['attack',1]],
};
for(const [no,expected]of Object.entries(immediate))for(const player of [0,1])check(no+' immediate p'+player,()=>{const f=setup(no,player);f.act();assert.deepEqual(numeric(f.k),expected);if(no==='P03-067')assert.equal(f.k.state.ball.offense,6);if(no==='PR-084'){const es=f.k.state.effects.filter(e=>e.kind==='numeric');assert.deepEqual(es[0].target,es[1].target);const c=f.k.card(es[0].target.id);assert.equal(c.entryReason,'skill');assert.equal(c.entryTurn,f.k.state.turn.id);}});
for(const no of ['D03-001','P02-073','P03-021','P02-092'])check(no+' retrieve then mandatory hand move',()=>{
 const f=setup(no),before=f.k.snapshot();f.act();const additions=f.k.state.events.slice(before.events.length).filter(e=>e.type==='hand_added'&&e.operation==='add_hand');assert.equal(additions.length,1);
 const destination=no==='D03-001'?'deck':'drop',moved=Object.values(f.k.state.cards).filter(c=>before.cards[c.id].zone==='0.hand'&&c.zone==='0.'+destination);assert.equal(moved.length,1);if(no==='D03-001')assert.equal(f.k.zone(0,'deck')[0],moved[0].id);
});
check('P04-007 sum actual paid Guts block parameters',()=>{const f=setup('P04-007'),before=f.k.snapshot();f.act();const paid=Object.values(f.k.state.cards).filter(c=>before.cards[c.id].zone==='0.receive'&&c.zone==='0.drop');assert.equal(paid.length,3);assert.equal(new Set(paid.map(c=>c.printed.name)).size,3);assert(paid.every(c=>c.printed.affiliation_tags.includes('烏野')));assert.deepEqual(numeric(f.k),[['receive',paid.reduce((n,c)=>n+c.printed.parameters.block,0)]]);});
for(const no of ['P04-007','P04-063'])for(const kind of ['all_result_cards_match','compare'])check(no+' paid guard false '+kind,()=>{
 const card=catalog.cards.find(c=>c.card_no==='HV-'+no),ns=[];visit(card.profiles[0].program,n=>ns.push(n));const n=ns.find(n=>kind==='compare'?n.kind==='compare'&&n.field==='paid.names_are_distinct':n.kind==='all_result_cards_match');
 const f=setup(no,0,null,{node_id:n.node_id,value:false}),before=f.k.snapshot();f.act();assert.equal(numeric(f.k).length,0);assert.equal(Object.values(f.k.state.cards).filter(c=>before.cards[c.id].zone==='0.'+f.phase&&c.zone==='0.drop').length,3,'the payment is retained even when the dependent guard fails');
});
for(const printedReceive of [3,4])check('D01-011 checks receive after first bonus, base '+printedReceive,()=>{
 const f=setup('D01-011'),card=catalog.cards.find(c=>{const p=c.profiles[0];return !p.program&&p.variants[0].printed.parameters.receive===printedReceive;});const target=f.k.addCard(card.card_no,0,'receive'),choose=f.k.choose;
 f.k.choose=req=>req.kind==='target'?[target]:choose(req);f.act();assert.equal(f.k.parameter(target,'receive'),5);assert.equal(f.k.state.effects.filter(e=>e.kind==='numeric').length,printedReceive===3?2:1);
});
check('PR-084 earlier-turn skill entry does not gain this-turn bonus',()=>{
 const card=catalog.cards.find(c=>c.card_no==='HV-PR-084'),ns=[];visit(card.profiles[0].program,n=>ns.push(n));const n=ns.find(n=>n.kind==='equal_fields'),f=setup('PR-084',0,null,{node_id:n.node_id,value:false});f.act();assert.deepEqual(numeric(f.k),[['attack',1]]);
});
const watched={
 'D02-001':{attack:-2},'P01-079':{receive:-2},'P02-074':{toss:-1},
 'P02-086':{receive:-2},'P03-003':{block:-3},'P03-005':{attack:-2},
 'P03-082':{attack:1},'P04-004':{receive:-1},'P04-090':{block:-1,receive:-1},
 'P04-097':{receive:-3},'PR-031':{block:-2},
};
for(const [no,parameters]of Object.entries(watched))for(const player of [0,1])check(no+' two real later entries p'+player,()=>{
 const f=setup(no,player,no==='P02-086'?'serve':null);f.act();const before=Object.keys(f.k.state.cards).sort(),receipts=driveFollowups(f.k,f.followups);assert.equal(receipts.length,Object.keys(parameters).length*2);
 for(const r of receipts){const plan=f.followups.find(p=>p.node_id===r.node_id),param=Object.keys(parameters).length===1?Object.keys(parameters)[0]:plan.area;assert.equal(r.effective_parameters[param],r.parameters[param]+parameters[param],no+' actual watch parameter');for(const other of Object.keys(r.parameters))if(other!==param)assert.equal(r.effective_parameters[other],r.parameters[other],no+' unrelated parameter');}
 assert.deepEqual(Object.keys(f.k.state.cards).sort(),before);f.k.assertState();
});
check('P02-082 drops first side once; second side survives',()=>{const f=setup('P02-082');f.act();const rs=driveFollowups(f.k,f.followups);assert.equal(rs.length,2);assert.equal(rs[0].zone,'1.drop');assert(rs[1].zone.startsWith('1.side:'));});
check('P01-057 excludes rule draw and responds once per actual recovery',()=>{const f=setup('P01-057');f.act();f.k.endTurn();f.k.beginTurn(1,'draw');const hand=f.k.zone(0,'hand').length;f.k.drawRule(1);assert.equal(f.k.zone(0,'hand').length,hand);const rs=driveFollowups(f.k,f.followups);assert.equal(rs.length,2);assert.equal(f.k.zone(0,'hand').length,hand+2);});
check('P02-086 draw-phase play does not create the serve-only watcher',()=>{const f=setup('P02-086',0,'draw');f.act();assert.equal(f.k.state.effects.filter(e=>e.kind==='watch').length,0);});
check('P04-090 committed watchers survive source leaving Event',()=>{const f=setup('P04-090');f.act();f.k.resolveProgram({kind:'move_self',destination:'owner.drop'},0,f.id);assert.equal(driveFollowups(f.k,f.followups).length,4);});
const baseline=runBatch({conditioned:true}),expanded=runBatch({branches:true});
assert.equal(expanded.totals.profiles,125);assert.equal(expanded.totals.cases,1938);assert.equal(expanded.totals.errors,0);assert.equal(expanded.totals.fixture_gaps,0);assert.equal(expanded.totals.profiles_with_unvisited_actions,0);assert.equal(expanded.totals.profiles_with_missing_condition_outcomes,0);
let preserved=0;for(const original of baseline.profiles){const current=expanded.profiles.find(p=>p.profile_id===original.profile_id);assert.deepEqual(current.cases.slice(0,original.cases.length),original.cases);preserved+=original.cases.length;}assert.equal(preserved,1764);
assert.equal(expanded.profiles.filter(p=>p.cases.some(c=>c.key.includes(':branch_'))).length,49);
assert.equal(JSON.stringify(catalog),sourceBefore);
console.log(JSON.stringify({passed:cases.length,failed:0,cases,preserved_baseline_cases:preserved,totals:expanded.totals},null,2));
