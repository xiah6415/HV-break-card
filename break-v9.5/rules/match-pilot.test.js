'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {runOld,runNew}=require('./match-pilot-fixtures');
(async()=>{
 const results=[];
 for(const deck of ['basic','skills','guts'])for(const seed of [1,7,13]){
 const options={seed,deck,mulligan:true,preferBlock:true};
 const old=await runOld(options),fresh=runNew(options);
 assert.equal(fresh.records.length,old.records.length,'decision count');
 for(let i=0;i<old.records.length;i++){
  assert.equal(fresh.records[i].kind,old.records[i].kind,'kind at '+i);
  assert.equal(fresh.records[i].actor,old.records[i].actor,'actor at '+i);
  try{assert.deepEqual(fresh.records[i].state,old.records[i].state);}catch(e){e.message='boundary '+i+' '+old.records[i].rawKind+' / '+fresh.records[i].rawKind+'\n'+e.message;throw e;}
 }
 assert.deepEqual(fresh.final,old.final);
 results.push({seed,deck,decisions:old.records.length,rallies:old.final.rally,winner:old.final.winner,rngCalls:old.final.rng.calls,kinds:[...new Set(fresh.records.map(r=>r.rawKind))],zoneAndIdentityEqualAtEveryDecision:true,parametersAndBallEqualAtEveryDecision:true});
 }
 const report={passed:true,matches:results.length,boundaries:results.reduce((n,r)=>n+r.decisions,0),results};
 if(process.env.PILOT_EVIDENCE_FILE)fs.writeFileSync(process.env.PILOT_EVIDENCE_FILE,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
