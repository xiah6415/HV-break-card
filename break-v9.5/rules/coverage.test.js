'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {buildCoverage}=require('./coverage'),{Kernel}=require('./core');
const catalog=require('./data/cards.json'),rules=require('./data/shared-rules.json');
const files=['core.js','legacy.js','runtime-data.json','approvals.json','data/cards.json'];
const hashes=()=>files.map(p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,p))).digest('hex'));
const before=hashes(),r=buildCoverage(),card=no=>r.cards.find(c=>c.card_no==='HV-'+no),profile=no=>r.profiles.find(p=>p.card_no==='HV-'+no);
assert.equal(r.totals.cards,541);assert.equal(r.totals.profiles,545);assert.equal(r.totals.skill_cards,358);
assert.equal(Object.values(r.card_categories).reduce((a,b)=>a+b),541);assert.equal(Object.values(r.profile_categories).reduce((a,b)=>a+b),545);assert.equal(new Set(r.cards.map(c=>c.card_no)).size,541);assert.equal(new Set(r.profiles.map(p=>p.profile_id)).size,545);
assert.equal(r.card_categories.no_skill,183);assert.equal(r.card_categories.approved,47);assert.equal(r.profiles.filter(p=>p.live_approved).length,47);assert(r.profiles.filter(p=>p.live_approved).every(p=>p.reasons.length===0));assert(catalog.cards.flatMap(c=>c.profiles).every(p=>p.runtime_approved===false));
// Regression anchors: syntax admission cannot stand in for host integration.
const kernel=new Kernel({catalog,ruleIds:rules.rules.map(x=>x.id),fingerprint:'coverage-regression',mode:'sandbox'}),p087=catalog.cards.find(c=>c.card_no==='HV-P03-087').profiles[0];
assert.doesNotThrow(()=>kernel.preflight(p087.program));assert.equal(card('P03-087').category,'host_gap');assert(profile('P03-087').reasons.some(x=>x.key==='guts_areas:"court"'));
assert.equal(card('PR-057').category,'core_gap');assert(profile('PR-057').reasons.some(x=>x.group==='rename_entry'));assert.equal(card('PR-022').category,'core_gap');assert(profile('PR-022').reasons.some(x=>x.detail.includes('a_pass')));assert.equal(card('P01-006').category,'core_gap');assert(profile('P01-006').reasons.some(x=>x.group==='deck_operations'));
// More than one blocker must survive, even when one causes preflight to stop early.
assert(profile('PR-081').reasons.some(x=>x.detail.includes('blockout')));assert(profile('PR-081').reasons.some(x=>x.key.startsWith('move_quantity:one_of_exact')));
assert.equal(card('P04-070').category,'ruling_review');assert(profile('P04-070').reasons.some(x=>x.detail.includes('TARGET_MEMBERSHIP_UNRESOLVED')));assert.equal(card('P02-064').category,'ruling_review');assert.equal(card('P03-077').profile_ids.length,2);assert.equal(card('P03-077').category,'ruling_review');
assert.equal(card('P03-069').category,'reuse_candidate');assert.equal(card('P03-069').live_approved,false);assert.equal(card('P03-069').in_runtime_catalog,true);assert(r.profiles.filter(p=>p.category==='reuse_candidate').every(p=>p.kernel_admission.passed&&!p.live_approved&&!p.reasons.length));
assert(r.profiles.some(p=>p.reasons.some(x=>x.path.startsWith('formal_cost.steps'))),'formal costs must contribute blockers');
for(const gap of r.gap_groups){assert.equal(gap.affected_cards,new Set(gap.card_nos).size);assert.equal(gap.single_gap_group_cards,gap.single_gap_group_card_nos.length);for(const no of gap.single_gap_group_card_nos)assert.deepEqual(r.cards.find(c=>c.card_no===no).gap_groups,[gap.key]);}
assert.deepEqual(hashes(),before);assert.deepEqual(buildCoverage(),r,'inventory must be deterministic');
console.log('coverage: complete card/profile partitions, approval/source integrity, host-vs-core blockers, costs, all blocker paths, variants and deterministic non-mutating audit passed');
