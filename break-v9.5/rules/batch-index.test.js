'use strict';
const assert=require('node:assert/strict');
const {buildIndex,query,contract,profileHash}=require('./batch-index');
const catalog=require('./data/cards.json'),approvals=require('./approvals.json');
const before=JSON.stringify(catalog),index=buildIndex();
assert.equal(index.totals.profiles,545);assert.equal(index.totals.candidate_profiles,93);
assert.equal(new Set(index.batches.flatMap(b=>b.profiles)).size,93);
assert.equal(index.batches.reduce((n,b)=>n+b.profiles.length,0),93);
for(const [axis,terms]of Object.entries(index.postings))for(const term of Object.keys(terms)){
 const expected=Object.values(index.profiles).filter(p=>axis==='family'?p.family===term:axis==='category'?p.category===term:axis==='runtime'?String(p.in_runtime_catalog)===term:p[axis].includes(term)).map(p=>p.profile_id).sort();
 assert.deepEqual(query(index,{[axis]:term}),expected);
}
for(const phase of ['serve','draw','block','receive','toss','attack'])for(const mechanism of ['numeric','draw','pay_guts','retrieve','watch']){
 assert.deepEqual(query(index,{category:'reuse_candidate',phase,mechanism}),Object.values(index.profiles).filter(p=>p.category==='reuse_candidate'&&p.phase.includes(phase)&&p.mechanism.includes(mechanism)).map(p=>p.profile_id).sort());
}
assert.equal(query(index,{category:'reuse_candidate',runtime:'true'}).length,93);
const runtime=require('./runtime-data.json');for(const p of runtime.catalog.cards.flatMap(c=>c.profiles).filter(p=>!p.runtime_approved))assert.equal(p.program,null,'metadata inclusion never admits a skill');
assert.deepEqual(query(index,{mechanism:'does-not-exist'}),[]);assert.deepEqual(query(index,{mechanism:[]}),[]);
assert.deepEqual(query(JSON.parse(JSON.stringify(index)),{category:'__proto__'}),[]);
assert.throws(()=>query(index,{unknown:'draw'}),/Unknown index axis/);
assert.equal(query(index,{phase:['receive','attack']}).length,new Set([...query(index,{phase:'receive'}),...query(index,{phase:'attack'})]).size);
const node={kind:'numeric',value:2,operation:'add',duration:'this_turn',target:{filters:{names:['A']}}};
assert.deepEqual(contract(node,true),contract({...node,value:4,target:{filters:{names:['B']}}},true));
for(const changed of [{value:-2},{value:0},{operation:'set'},{duration:'next_opponent_turn'},{target:{filters:{exclude_names:['A']}}}])assert.notDeepEqual(contract(node,true),contract({...node,...changed},true));
assert.notDeepEqual(contract(node),contract({...node,value:4}));
for(const c of catalog.cards)for(const p of c.profiles){assert.equal(index.profiles[p.profile_id].profile_sha256,profileHash(p));if(approvals.profiles[p.profile_id])assert.equal(profileHash(p),approvals.profiles[p.profile_id].profile_sha256);}
assert.equal(JSON.stringify(catalog),before);assert.deepEqual(buildIndex(),index);
console.log('batch-index: all postings vs independent full scan, intersections/unions, candidate partition, contract boundaries, approval hashes and deterministic non-mutation passed');
