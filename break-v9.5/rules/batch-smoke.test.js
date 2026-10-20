'use strict';
const assert=require('node:assert/strict');
const {runBatch}=require('./batch-smoke'),{buildIndex}=require('./batch-index'),{Kernel}=require('./core');
const catalog=require('./data/cards.json');
const index=buildIndex(),r=runBatch({index});
assert.equal(r.totals.profiles,125);assert.equal(r.totals.cases,1530);assert.equal(r.totals.errors,0);
assert.equal(r.totals.profiles_with_performed_skill,96);
assert.equal(r.totals.smoke_pass_profiles+r.totals.inert_profiles+r.totals.needs_probe_review,125);
assert.equal(r.totals.resolved+r.totals.inert_events+r.totals.errors,1530);
for(const row of r.profiles){assert(row.cases.length>=10);assert(row.cases.some(c=>c.key.endsWith(':0')));assert(row.cases.some(c=>c.key.endsWith(':1')));assert(row.cases.every(c=>c.status==='resolved'||c.message==='OPEN-EVENT-NO-CHANGE'));}
assert(r.profiles.some(r=>r.unvisited_action_nodes.length));assert(r.profiles.some(r=>r.missing_condition_outcomes.length),'smoke must report incomplete branches');
assert.equal(r.profiles.find(p=>p.card_no==='HV-PR-078').status,'inert_in_all_probes','an inert probe is not a successful effect test');
const enteredOnly=r.profiles.find(p=>p.card_no==='HV-D03-002');assert.equal(enteredOnly.status,'sandbox_smoke_pass');assert(!enteredOnly.cases.some(c=>c.skill_performed),'successful entry must not count as performed skill');
assert.throws(()=>runBatch({index,filters:{category:'approved'}}),/requires reuse candidates/);
// Fault injection: ensure a real execution failure survives aggregation.
const copy=JSON.parse(JSON.stringify(index)),first=Object.values(copy.profiles).find(p=>p.card_no==='HV-P01-015');
const saved=Kernel.prototype._run;
try{Kernel.prototype._run=function(n,c){if(n.kind==='draw')throw Error('injected probe failure');return saved.call(this,n,c);};const broken=runBatch({index:copy,filters:{family:first.family}});assert(broken.totals.errors>0);assert(broken.profiles.some(p=>p.status==='needs_probe_review'));}finally{Kernel.prototype._run=saved;}
copy.profiles[first.profile_id].profile_sha256='stale';assert.throws(()=>runBatch({index:copy,filters:{family:first.family}}),/Stale profile index/);
// Host integration and live approval remain outside this utility.
assert(catalog.cards.flatMap(c=>c.profiles).every(p=>!p.runtime_approved));
console.log(JSON.stringify({message:'batch-smoke: all candidates, both players/phases, replay/rollback/conservation/cleanup, incomplete coverage and injected failure reporting passed',totals:r.totals}));
