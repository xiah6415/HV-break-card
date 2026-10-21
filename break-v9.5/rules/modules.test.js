'use strict';
const assert=require('node:assert/strict');
const {testModules}=require('./modules');
const catalog=require('./data/cards.json');
const result=testModules(catalog);
assert.deepEqual(Object.keys(result.cards),['P01-086','P03-089']);
assert.deepEqual(result.modules,[{id:'retrieve.school-character',cards:2,cases:6}]);
// A script outside completed module shapes stays locked, without a new approval list.
for(const change of [
 p=>p.formal_cost={steps:[]},p=>p.program.steps[0].count=2,
 p=>p.program.steps[0].group_constraints={distinct_names:true},
 p=>p.program.steps.push({kind:'invented_operation'}),
 p=>p.program.steps[0].pool.filters.unknown=true,
 p=>p.flags=['TARGET_MEMBERSHIP_UNRESOLVED']
]){
 const c=structuredClone(catalog);change(c.cards.find(c=>c.card_no==='HV-P01-086').profiles[0]);
 const current=testModules(c);
 assert.equal(current.cards['P01-086'],undefined);
 assert(current.cards['P03-089']);
}
// A matching script whose actual test fails aborts release of the whole batch.
const bad=structuredClone(catalog);
bad.cards.find(c=>c.card_no==='HV-P01-086').profiles[0].program.shared_rule_ids=['unimplemented-rule'];
assert.throws(()=>testModules(bad),/Unknown shared rule/);
console.log('modules: 2 cards / 6 scenarios; unsupported dependencies stay locked; failed card aborts batch');
