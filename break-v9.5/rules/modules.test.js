'use strict';
const assert=require('node:assert/strict'),M=require('./modules'),I=require('./node-inventory');
const catalog=require('./data/cards.json'),result=M.testModules(catalog);
assert.equal(Object.keys(result.cards).length,213);
assert.deepEqual(result.modules.map(m=>[m.id,m.parameterForms]),[['sequence',1],['deck_selection',15],['numeric',77],['selector',152],['conditional',1],['payment_branch',1],['pay_guts',16],['compare',97],['draw',5],['move',20],['count_compare',13],['retrieve',7],['watch',26],['uniform_affiliation',18],['all',1],['keyword',15],['rename_before_entry',25],['all_result_cards_match',18],['move_self',6],['mill',6],['enter',7],['formal_declaration_cost',1]]);
const plan=I.inventory(catalog,M.completed.map(m=>m.id));
assert.equal(plan.scope,297);assert.equal(plan.kinds,48);
assert.deepEqual(plan.path.filter(r=>r.type==='node').slice(0,7).map(r=>r.kind),I.PRIORITY);
assert.deepEqual(plan.path.filter(r=>r.type==='node'&&[7,10,13,20].includes(r.nodeStep)).map(r=>[r.nodeStep,r.nodesReady,r.entryReady]),[[7,31,27],[10,96,88],[13,133,122],[20,225,213]]);
assert(plan.path.some(r=>r.type==='entry'&&r.kind==='permanent_entry_name'&&r.completed));
assert(plan.path.some(r=>r.type==='entry'&&r.kind==='passive:character_entry'&&r.completed));
assert.deepEqual([plan.next.kind,plan.next.entryReady],['ban_action',221]);
const north=catalog.cards.find(c=>c.card_no==='HV-P04-070');assert.deepEqual(north.profiles[0].flags,[]);assert.deepEqual(I.dependencies(north).filter(k=>!M.completed.some(m=>m.id===k)),['protect_numeric_decrease']);assert(!M.eligible(north),'User ruling resolves data, not an unfinished module');
const nested=structuredClone(catalog),p=nested.cards.find(c=>c.card_no==='HV-P01-089').profiles[0];p.program={kind:'sequence',steps:[p.program]};assert(M.testModules(nested).cards['P01-089']);
for(const mutate of [p=>p.program.steps.push({kind:'invented'}),p=>p.flags=['TARGET_MEMBERSHIP_UNRESOLVED'],p=>p.activation.skill_type='unknown_entry']){const c=structuredClone(catalog);mutate(c.cards.find(c=>c.card_no==='HV-P01-089').profiles[0]);assert(!M.eligible(c.cards.find(c=>c.card_no==='HV-P01-089')));}
const bad=structuredClone(catalog);bad.cards.find(c=>c.card_no==='HV-P01-089').profiles[0].program.shared_rule_ids=['unimplemented-rule'];assert.throws(()=>M.testModules(bad),/Unknown shared rule/);
console.log('frequent node group: 22 completed modules / 528 parameter forms / 213 cards x 3 scenarios; cumulative node+entry path passed');
