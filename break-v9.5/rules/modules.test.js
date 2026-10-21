'use strict';
const assert=require('node:assert/strict'),M=require('./modules'),I=require('./node-inventory');
const catalog=require('./data/cards.json'),result=M.testModules(catalog);
const released=['P01-089','P03-078','P03-079','P04-085'];
assert.deepEqual(Object.keys(result.cards),released);
assert.deepEqual(result.modules.map(m=>[m.id,m.parameterForms]),[['sequence',1],['deck_selection',15]]);
const initial=I.inventory(catalog,['sequence'],['P01-086','P03-089']);
assert.equal(initial.scope,297);assert.equal(initial.kinds,48);assert.equal(initial.ranking[0].kind,'deck_selection');assert.equal(initial.ranking[0].additionalCards,4);
const next=I.inventory(catalog,M.completed.map(m=>m.id),[...released,'P01-086','P03-089']);
assert.deepEqual(next.ranking.slice(0,2).map(r=>[r.kind,r.additionalCards]),[['draw',2],['invalidate_skill',1]]);
// Extra container nesting does not change the kind dependencies or require an approval.
const nested=structuredClone(catalog),p=nested.cards.find(c=>c.card_no==='HV-P01-089').profiles[0];p.program={kind:'sequence',steps:[p.program]};
assert(M.testModules(nested).cards['P01-089']);
for(const mutate of [p=>p.program.steps.push({kind:'invented'}),p=>p.flags=['TARGET_MEMBERSHIP_UNRESOLVED'],p=>p.activation.skill_type='permanent_entry_name']){
 const c=structuredClone(catalog);mutate(c.cards.find(c=>c.card_no==='HV-P01-089').profiles[0]);assert(!M.eligible(c.cards.find(c=>c.card_no==='HV-P01-089')));
}
const bad=structuredClone(catalog);bad.cards.find(c=>c.card_no==='HV-P01-089').profiles[0].program.shared_rule_ids=['unimplemented-rule'];
assert.throws(()=>M.testModules(bad),/Unknown shared rule/);
console.log('node modules: 48 kinds inventoried; all 15 deck parameter forms; recursive dependency gate; 4 cards x 3 scenarios; incremental ranking passed');
