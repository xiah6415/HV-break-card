'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {buildAudit,extraChecks,gapFor,markdown,cardMarkdown}=require('./primitive-audit');
const {Kernel}=require('./core');
const catalog=require('./data/cards.json'),authority=require('../card-library.json').authority,rules=require('./data/shared-rules.json');
const files=['data/cards.json','core.js','legacy.js','approvals.json','legacy-skills.json','runtime-data.json','../card-library.json','../index.html'];
const hashes=()=>files.map(p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,p))).digest('hex'));
const before=hashes(),a=buildAudit(),nos=a.cards.map(c=>c.card_no),card=no=>a.cards.find(c=>c.card_no===no);
// Independent scope by source authority, including the non-HV- spelling of BP.
const short=no=>no.startsWith('HVBP-')?no.slice(2):no.startsWith('HV-')?no.slice(3):no;
const expected=catalog.cards.filter(c=>authority.cards[short(c.card_no)].kind==='unapproved');
assert.deepEqual(nos,expected.map(c=>c.card_no));assert.equal(a.totals.cards,209);assert.equal(a.totals.profiles,213);
assert.equal(a.totals.scripted_cards,209);assert.equal(new Set(nos).size,209);
assert.deepEqual([a.totals.batch_candidate,a.totals.host_gap,a.totals.core_gap,a.totals.review],[57,50,98,4]);
assert.equal(a.totals.interpreter_action_kinds,22);assert.equal(a.totals.primitive_families,16);
assert.equal(authority.cards['BP-009'].kind,'shared');assert(!card('HV-PR-022'));assert(!card('HV-P01-006'));assert(!card('HV-P01-015'));
const {profileHash}=require('./batch-index');
for(const c of a.cards){const source=expected.find(s=>s.card_no===c.card_no);assert.equal(c.profiles.length,source.profiles.length);
 for(const p of c.profiles){const s=source.profiles.find(s=>s.profile_id===p.profile_id);assert.equal(p.profile_sha256,profileHash(s));assert.deepEqual(p.script.trigger,s.activation);assert.deepEqual(p.script.cost.formal,s.formal_cost);assert.deepEqual(p.script.effect,s.program);assert.equal(p.original_texts.length,s.variants.length);}
 if(c.status==='batch_candidate')assert.deepEqual(c.gap_ids,[]);
 if(c.status==='host_gap')assert(c.gap_ids.every(g=>g.startsWith('host.')));
}
assert.equal(card('HV-P03-077').profiles.length,2);assert.equal(card('HV-P03-077').status,'review');
assert.equal(card('HV-P04-070').status,'core_gap');
// Exact-card issue: same opcode is NOT equivalent to supported semantics.
for(const no of ['HV-P01-021','HV-P01-076','HV-P03-088','HV-P03-097']){
 assert(!card(no));assert.equal(authority.cards[short(no)].kind,'shared');
}
assert(!card('HV-PR-078'));assert.equal(authority.cards['PR-078'].kind,'shared');
const constrained=count=>({program:{kind:'retrieve',count,count_mode:'exact',group_constraints:{single_area:true}}});
assert.equal(extraChecks(constrained(1)).length,0);assert.equal(extraChecks(constrained(2)).length,1);
// Regression: the completed retrieve module now enforces grouped selection.
const k=new Kernel({catalog,ruleIds:rules.rules.map(r=>r.id),fingerprint:'primitive-audit-counterexample',mode:'sandbox',choose:r=>r.options.slice(0,r.count)});
const ids=['receive','toss'].map(zone=>{const id=k.addCard('HV-D01-009',0,zone);k.addCard('HV-D01-009',0,zone);return id;});
const source=k.addCard('HV-P01-021',0,'attack');
const node={kind:'retrieve',pool:{kind:'selector',actor:'self',zone:'court.guts',filters:{}},destination:'self.hand',count:2,count_mode:'exact',bind:'retrieved',group_constraints:{single_area:true,distinct_names:true}};
assert.doesNotThrow(()=>k.preflight(node));assert.equal(k.resolveProgram(node,0,source),true);
assert.equal(k.zone(0,'hand').length,1,'Must not cross areas or repeat a name');
assert.equal(extraChecks({program:node})[0].key,'group_constraints');
// Inverse lists and unlock counts recomputed from full cards, not sums of overlaps.
for(const g of a.gaps){const affected=a.cards.filter(c=>c.gap_ids.includes(g.id));assert.deepEqual(g.card_nos,affected.map(c=>c.card_no));assert.equal(g.affected_cards,affected.length);assert.deepEqual(g.sole_gap_card_nos,affected.filter(c=>c.gap_ids.length===1).map(c=>c.card_no));}
for(const p of a.package_impact){const touched=a.cards.filter(c=>c.gap_ids.some(g=>p.fixes.includes(g)));assert.equal(p.affected_cards,touched.length);assert.deepEqual(p.card_nos,touched.filter(c=>c.gap_ids.every(g=>p.fixes.includes(g))).map(c=>c.card_no));}
const packets=a.candidate_packets.flatMap(p=>p.cards);assert.equal(packets.length,57);assert.equal(new Set(packets).size,57);
for(const p of a.candidate_packets)for(const no of p.cards)assert.deepEqual(card(no).primitives,p.primitives);
assert.throws(()=>gapFor({layer:'core',key:'preflight:Unsupported mechanism future_opcode'}),/Unmapped/);
assert.equal(a.policy.admissions_changed,0);assert.equal(a.policy.game_changed,false);
assert(markdown(a).includes('57張'));assert(cardMarkdown(a).includes('P04-070'));
assert.deepEqual(buildAudit(),a);assert.deepEqual(hashes(),before);
console.log('primitive-audit: 209-card authority scope, 213 exact source scripts, 16 families, 22 interpreter actions, completed constraint regression, overlap/unlock counts, variants and non-mutation passed');
