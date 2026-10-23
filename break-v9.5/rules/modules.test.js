'use strict';
const assert=require('node:assert/strict'),M=require('./modules'),I=require('./node-inventory');
const catalog=require('./data/cards.json'),result=M.testModules(catalog);
assert.equal(Object.keys(result.cards).length,291);
assert.deepEqual(result.modules.map(m=>[m.id,m.parameterForms]),[['sequence',1],['deck_selection',15],['numeric',77],['selector',153],['conditional',1],['payment_branch',1],['pay_guts',16],['compare',97],['draw',5],['move',20],['count_compare',13],['retrieve',7],['watch',26],['uniform_affiliation',18],['all',1],['keyword',15],['rename_before_entry',25],['all_result_cards_match',18],['move_self',6],['mill',6],['enter',7],['formal_declaration_cost',1],['ban_action',14],['invalidate_skill',11],['choose_modes',1],['optional',2],['any',1],['equal_fields',1],['result_count',1],['sum_result_parameter',1],['draw_to_hand_size',2],['exchange',1],['each_player_optional_draw',1],['protect_numeric_decrease',5],['phase_jump',1],['enter_self',3],['external_action',5],['shuffle',2],['move_result',1],['reveal_top',1],['simultaneous_entry_group',1],['cover_source_with_guts',1],['force_judgment_failure',1],['parameter_absent',1],['printed_parameter',1],['retrieve_slots',1]]);
const plan=I.inventory(catalog,M.completed.map(m=>m.id));
assert.equal(plan.scope,297);assert.equal(plan.kinds,48);
assert.deepEqual(plan.path.filter(r=>r.type==='node').slice(0,7).map(r=>r.kind),I.PRIORITY);
assert.deepEqual(plan.path.filter(r=>r.type==='node'&&[7,10,13,20].includes(r.nodeStep)).map(r=>[r.nodeStep,r.nodesReady,r.entryReady]),[[7,31,27],[10,96,88],[13,133,122],[20,225,213]]);
assert(plan.path.some(r=>r.type==='entry'&&r.kind==='permanent_entry_name'&&r.completed));
assert(plan.path.some(r=>r.type==='entry'&&r.kind==='passive:character_entry'&&r.completed));
assert.deepEqual([plan.next.kind,plan.next.entryReady],['reveal_and_retrieve',292]);
const north=catalog.cards.find(c=>c.card_no==='HV-P04-070');assert.deepEqual(north.profiles[0].flags,[]);assert.deepEqual(I.dependencies(north).filter(k=>!M.completed.some(m=>m.id===k)),[]);assert(M.eligible(north),'Continuous protection module applies the user ruling');
const nested=structuredClone(catalog),p=nested.cards.find(c=>c.card_no==='HV-P01-089').profiles[0];p.program={kind:'sequence',steps:[p.program]};assert(M.testModules(nested).cards['P01-089']);
for(const mutate of [p=>p.program.steps.push({kind:'invented'}),p=>p.flags=['TARGET_MEMBERSHIP_UNRESOLVED'],p=>p.activation.skill_type='unknown_entry']){const c=structuredClone(catalog);mutate(c.cards.find(c=>c.card_no==='HV-P01-089').profiles[0]);assert(!M.eligible(c.cards.find(c=>c.card_no==='HV-P01-089')));}
const bad=structuredClone(catalog);bad.cards.find(c=>c.card_no==='HV-P01-089').profiles[0].program.shared_rule_ids=['unimplemented-rule'];assert.throws(()=>M.testModules(bad),/Unknown shared rule/);
console.log('frequent node group: 46 completed modules / 589 parameter forms / 291 cards x 3 scenarios; cumulative node+entry path passed');
