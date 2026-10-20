/* Build-time work index. Families schedule tests; they never grant execution rights. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {buildCoverage}=require('./coverage');
const root=__dirname;
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const approvalJSON=x=>Array.isArray(x)?'['+x.map(approvalJSON).join(', ')+']':x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+': '+approvalJSON(x[k])).join(', ')+'}':JSON.stringify(x);
const profileHash=p=>crypto.createHash('sha256').update(approvalJSON(p)).digest('hex');
const metadata=new Set(['node_id','shared_rule_ids','category_tags','classification_role','polarity']);
function visit(x,fn){if(Array.isArray(x))x.forEach(v=>visit(v,fn));else if(x&&typeof x==='object'){fn(x);for(const [k,v]of Object.entries(x))if(!metadata.has(k))visit(v,fn);}}
// Keep all enums, conditions, permissions, ordering, scopes and lifetimes.
// Only positive/negative integer magnitudes and literal name/tag lists vary.
// Family equality is deliberately weaker than executable-contract equality.
function contract(x,family=false,key=''){
 if(Array.isArray(x))return x.map(v=>family&&['names','exclude_names','tags','tags_any','years','years_any'].includes(key)?typeof v:contract(v,family,key));
 if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().filter(k=>!metadata.has(k)).map(k=>[k,contract(x[k],family,k)]));
 if(family&&Number.isInteger(x))return x===0?'integer:zero':x>0?'integer:positive':'integer:negative';
 return x;
}
function buildIndex({catalog=read('data/cards.json'),coverage=buildCoverage()}={}){
 const coverageById=new Map(coverage.profiles.map(p=>[p.profile_id,p]));
 const postings={},profiles={},families={};
 const add=(axis,value,id)=>{const terms=postings[axis]||=(Object.create(null));(terms[value]||=[]).push(id);};
 for(const c of catalog.cards)for(const p of c.profiles){
  const status=coverageById.get(p.profile_id);if(!status)throw Error('Missing coverage '+p.profile_id);
  const sets={phase:new Set(p.activation?.activation_phases||[]),tag:new Set(),polarity:new Set(),mechanism:new Set(),rule:new Set(p.shared_rule_ids||[])};
  if(p.activation?.trigger?.event==='self_entry')for(const phase of p.activation.trigger.destination_any||[])sets.phase.add(phase==='block'?'block':phase);
  for(const tree of [p.program,p.formal_cost])visit(tree,n=>{if(n.kind)sets.mechanism.add(n.kind);for(const t of n.category_tags||[])sets.tag.add(t);if(n.polarity)sets.polarity.add(n.polarity);for(const r of n.shared_rule_ids||[])sets.rule.add(r);});
  const executable={activation:p.activation,formal_cost:p.formal_cost,limit:p.limit,program:p.program,practice_override:p.practice_override,flags:p.flags};
  const family=digest(contract(executable,true)),id=p.profile_id;
  profiles[id]={profile_id:id,card_no:c.card_no,name:c.display_name,category:status.category,in_runtime_catalog:status.in_runtime_catalog,profile_sha256:profileHash(p),contract_sha256:digest(contract(executable)),family,...Object.fromEntries(Object.entries(sets).map(([k,s])=>[k,[...s].sort()]))};
  for(const [axis,set]of Object.entries(sets))for(const term of set)add(axis,term,id);
  add('category',status.category,id);add('runtime',String(status.in_runtime_catalog),id);add('family',family,id);
  (families[family]||=[]).push(id);
 }
 for(const terms of Object.values(postings))for(const ids of Object.values(terms))ids.sort();
 const candidates=query({postings,profiles},{category:'reuse_candidate'});
 const batches=Object.entries(families).map(([family,ids])=>({family,profiles:ids.filter(id=>profiles[id].category==='reuse_candidate').sort(),approved_witnesses:ids.filter(id=>profiles[id].category==='approved').sort()})).filter(b=>b.profiles.length).sort((a,b)=>b.profiles.length-a.profiles.length||a.family.localeCompare(b.family));
 return {schema_version:1,kind:'BATCH_WORK_INDEX_NOT_APPROVAL',sources:{...coverage.sources,'batch-index.js':crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex')},totals:{profiles:Object.keys(profiles).length,candidate_profiles:candidates.length,candidate_families:batches.length},postings,profiles,batches};
}
// AND between fields; OR between values in one field. Unknown terms match nothing.
function query(index,filters={}){
 let result=null;
 for(const [axis,values]of Object.entries(filters)){
  if(!Object.hasOwn(index.postings,axis))throw Error('Unknown index axis '+axis);
  const terms=index.postings[axis],union=new Set((Array.isArray(values)?values:[values]).flatMap(v=>Object.hasOwn(terms,v)?terms[v]:[]));
  result=result===null?union:new Set([...result].filter(id=>union.has(id)));
 }
 return [...(result||new Set(Object.keys(index.profiles)))].sort();
}
if(require.main===module)process.stdout.write(JSON.stringify(buildIndex(),null,2)+'\n');
module.exports={buildIndex,query,contract,visit,profileHash};
