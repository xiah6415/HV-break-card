/* Mechanism-indexed sandbox probes, NOT semantic approval or host integration. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {Kernel,capabilities}=require('./core'),{buildIndex,query,visit,profileHash}=require('./batch-index');
const {seedConditions}=require('./batch-fixtures');
const catalog=require('./data/cards.json'),rules=require('./data/shared-rules.json');
const fingerprint=crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'data/cards.json'))).digest('hex');
const byNo=new Map(catalog.cards.map(c=>[c.card_no,c]));
const copy=x=>JSON.parse(JSON.stringify(x)),hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const neutral=catalog.cards.filter(c=>c.profiles.length===1&&!c.profiles[0].program&&c.profiles[0].variants[0].printed.type==='character');
const eventCards=catalog.cards.filter(c=>c.profiles[0].variants[0].printed.type==='event');
const scenarios=[{key:'rich_first',rich:true,max:true},{key:'rich_last',rich:true,max:true,last:true},{key:'decline',rich:true,max:false},{key:'empty',rich:false,max:true},{key:'no_add',rich:true,max:true,noAdd:true}];
function fixture(card,p,phase,scenario,player){
 const k=new Kernel({catalog,ruleIds:rules.rules.map(r=>r.id),fingerprint,mode:'sandbox',choose:req=>{
  if(req.kind==='activate_payment'||req.kind==='optional')return scenario.max;
  if(req.count!=null)return (scenario.last?[...req.options].reverse():req.options).slice(0,req.count);
  return scenario.max?req.options.at(-1):req.options[0];
 }});
 k.state.turn={id:1,player,phase,step:'free'};
 k.state.ball={owner:1-player,kind:scenario.rich?'attack':'serve',offense:scenario.rich?8:2};
 if(scenario.conditioned){
  const id=k.addCard(card.card_no,player,'hand',card.profiles.indexOf(p));
  const seeded=seedConditions(k,{catalog,profile:p,source:id,player,phase});
  if(scenario.noAdd)k.resolveProgram({kind:'ban_action',actor:'self',action:'add_hand',scope:{origins:['skill']},duration:'this_turn'},player);
  return {k,id,...seeded};
 }
 const printed=p.variants[0].printed;
 const pick=(role,exclude=[])=>neutral.find(c=>{const v=c.profiles[0].variants[0].printed;return ![printed.name,...exclude].includes(v.name)&&v.parameters[role]!=='dash'&&printed.affiliation_tags.some(t=>v.affiliation_tags.includes(t));})||neutral.find(c=>{const v=c.profiles[0].variants[0].printed;return ![printed.name,...exclude].includes(v.name)&&v.parameters[role]!=='dash';});
 const filler=pick('attack');
 for(const owner of [0,1]){
  let previous=[];
  for(const area of ['serve','block','receive','toss','attack']){
   const c=pick(area,previous);previous=[c.profiles[0].variants[0].printed.name];
   if(scenario.rich)for(let i=0;i<8;i++)k.addCard(filler.card_no,owner,area);
   k.addCard(c.card_no,owner,area);
  }
  if(scenario.rich){
   for(let i=0;i<10;i++)k.addCard(filler.card_no,owner,'deck');
   for(let i=0;i<6;i++)k.addCard((i%2?filler:pick('receive')).card_no,owner,'hand');
   for(let i=0;i<3;i++)k.addCard(filler.card_no,owner,'drop');
   for(let i=0;i<5;i++)k.addCard(eventCards[i].card_no,owner,'event');
   for(let i=0;i<2;i++)k.addCard(eventCards[i].card_no,owner,'hand');
   k.addCard(filler.card_no,owner,'sets');
  }
 }
 const id=k.addCard(card.card_no,player,'hand',card.profiles.indexOf(p));
 if(scenario.noAdd)k.resolveProgram({kind:'ban_action',actor:'self',action:'add_hand',scope:{origins:['skill']},duration:'this_turn'},player);
 return {k,id};
}
function runCase(card,p,phase,s,player){
 const {k,id,entryReason='rule',notes=[]}=fixture(card,p,phase,s,player),before=k.snapshot(),physical=Object.keys(before.cards).sort(),runs=new Set(),predicates=new Map();
 const run=k._run,predicate=k._predicate,resolve=k._resolveSkill;let skillResults=[];
 k._run=function(n,c){if(n.node_id)runs.add(n.node_id);return run.call(this,n,c);};
 k._predicate=function(n,c){const result=predicate.call(this,n,c);if(n.node_id){const values=predicates.get(n.node_id)||new Set();values.add(result);predicates.set(n.node_id,values);}return result;};
 k._resolveSkill=function(profile,ctx){const result=resolve.call(this,profile,ctx);if(profile.profile_id===p.profile_id)skillResults.push(!!result);return result;};
 function execute(){skillResults=[];try{
  const result=p.activation.skill_type==='event'?k.playEvent(id):p.activation.skill_type==='active'?k.useSkill(id):k.enter(id,phase,{reason:entryReason});
  k.assertState();assert.deepEqual(Object.keys(k.state.cards).sort(),physical);
  const outcome={effects:k.state.effects.filter(e=>!before.effects.some(old=>old.id===e.id)).map(e=>({...copy(e),target_card:e.target?.id?k.card(e.target.id).cardNo:null})),hand_additions:k.state.events.slice(before.events.length).filter(e=>e.type==='hand_added').map(e=>({...copy(e),card_no:k.card(e.card).cardNo})),moves:Object.values(k.state.cards).filter(c=>c.zone!==before.cards[c.id].zone).map(c=>({id:c.id,card_no:c.cardNo,from:before.cards[c.id].zone,to:c.zone}))};
  return {status:'resolved',result,skill_performed:skillResults.some(Boolean),outcome};
 }catch(e){assert.deepEqual(k.snapshot(),before,'failed declarations must roll back');return {status:e.message==='OPEN-EVENT-NO-CHANGE'?'inert_event':'error',skill_performed:false,code:e.code||e.name,message:e.message};}}
 const first=execute(),after=k.snapshot();k.restore(before);const second=execute();assert.deepEqual(second,first,'deterministic result');assert.deepEqual(k.snapshot(),after,'replay state');k.restore(before);assert.deepEqual(k.snapshot(),before);
 if(first.status==='resolved'){
  k.restore(after);k.endTurn();assert.equal(k.state.queue.length,0);assert(k.state.effects.every(e=>e.duration.kind==='next_opponent_turn'&&e.duration.activeTurn===null));
  k.restore(after);k.loss(player);k.finishLoss();assert.equal(k.state.effects.length,0);assert.equal(k.state.queue.length,0);assert.deepEqual(Object.keys(k.state.cards).sort(),physical);
 }
 return {key:[phase,s.key,player].join(':'),...first,fixture_notes:notes,executed_nodes:[...runs].sort(),predicates:Object.fromEntries([...predicates].map(([key,v])=>[key,[...v].sort()]))};
}
function runBatch({index=buildIndex(),filters={category:'reuse_candidate'},conditioned=false}={}){
 const initial=hash(catalog),rows=[];
 for(const file of ['data/cards.json','data/shared-rules.json','core.js','legacy.js','build_runtime.py','coverage.js','approvals.json','runtime-data.json','batch-index.js'])assert.equal(index.sources[file],crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,file))).digest('hex'),'Stale work index: '+file);
 for(const id of query(index,filters)){
  const entry=index.profiles[id],card=byNo.get(entry.card_no),p=card.profiles.find(p=>p.profile_id===id);
  assert.equal(profileHash(p),entry.profile_sha256,'Stale profile index: '+id);
  if(entry.category!=='reuse_candidate')throw Error('Batch requires reuse candidates; refused '+id);
  const phases=p.activation.skill_type==='passive'?p.activation.trigger.destination_any:p.activation.activation_phases;
  if(!phases?.length)throw Error('Candidate has no probeable phase '+id);
  const cases=[];for(const phase of phases)for(const s of scenarios)for(const player of [0,1])cases.push(runCase(card,p,phase,s,player));
  const initialSkillPerformed=cases.some(c=>c.skill_performed);
  if(conditioned&&!initialSkillPerformed)for(const phase of phases)for(const s of [{key:'conditioned',max:true},{key:'conditioned_decline',max:false},{key:'conditioned_no_add',max:true,noAdd:true}])for(const player of [0,1]){
   try{cases.push(runCase(card,p,phase,{...s,conditioned:true},player));}
   catch(e){if(e.code!=='FIXTURE_GAP')throw e;cases.push({key:[phase,s.key,player].join(':'),status:'fixture_gap',skill_performed:false,message:e.message,executed_nodes:[],predicates:{}});}
  }
  const nodes=new Set(),conditions=new Set();for(const tree of [p.program,p.formal_cost])visit(tree,n=>{if(n.node_id&&capabilities.nodes.includes(n.kind))nodes.add(n.node_id);if(n.condition?.node_id)conditions.add(n.condition.node_id);});
  const executed=new Set(cases.flatMap(c=>c.executed_nodes)),unvisited=[...nodes].filter(n=>!executed.has(n)).sort();
  const missingConditions=[...conditions].sort().map(node_id=>{const observed=[...new Set(cases.flatMap(c=>c.predicates[node_id]||[]))].sort();return {node_id,observed,missing:[false,true].filter(b=>!observed.includes(b))};}).filter(c=>c.missing.length);
  rows.push({profile_id:id,card_no:card.card_no,profile_sha256:entry.profile_sha256,family:entry.family,initial_skill_performed:initialSkillPerformed,status:cases.some(c=>c.status==='error')?'needs_probe_review':cases.some(c=>c.status==='fixture_gap')?'needs_fixture_work':cases.some(c=>c.status==='resolved')?'sandbox_smoke_pass':'inert_in_all_probes',unvisited_action_nodes:unvisited,missing_condition_outcomes:missingConditions,cases});
 }
 assert.equal(hash(catalog),initial,'batch must not mutate catalog');
 const cases=rows.flatMap(r=>r.cases);
 return {schema_version:1,kind:'SANDBOX_SMOKE_NOT_EXECUTION_APPROVAL',conditioned,sources:{...index.sources,...Object.fromEntries(['batch-smoke.js','batch-fixtures.js'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,file))).digest('hex')]))},method:'Every indexed reuse candidate, every declared activation/entry phase, both players, five common fixtures; optional structured-condition fixtures for initially inert skills. Replay/rollback, physical conservation, turn/Loss cleanup. Observed actions include speculative payment-availability probes and failed transactions. skill_performed records the core boolean, including payment/move only; it does not prove the intended benefit. Does not prove card-text semantics, branch completeness, host/UI/Undo integration, deferred watcher behavior or all combinations.',totals:{profiles:rows.length,cases:cases.length,resolved:cases.filter(c=>c.status==='resolved').length,inert_events:cases.filter(c=>c.status==='inert_event').length,errors:cases.filter(c=>c.status==='error').length,fixture_gaps:cases.filter(c=>c.status==='fixture_gap').length,smoke_pass_profiles:rows.filter(r=>r.status==='sandbox_smoke_pass').length,initial_profiles_with_performed_skill:rows.filter(r=>r.initial_skill_performed).length,profiles_with_performed_skill:rows.filter(r=>r.cases.some(c=>c.skill_performed)).length,inert_profiles:rows.filter(r=>r.status==='inert_in_all_probes').length,needs_probe_review:rows.filter(r=>r.status==='needs_probe_review').length,profiles_with_unvisited_actions:rows.filter(r=>r.unvisited_action_nodes.length).length,profiles_with_missing_condition_outcomes:rows.filter(r=>r.missing_condition_outcomes.length).length},profiles:rows};
}
if(require.main===module)process.stdout.write(JSON.stringify(runBatch({conditioned:process.argv.includes('--conditions')}),null,2)+'\n');
module.exports={runBatch,runCase,fixture};
