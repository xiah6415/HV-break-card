/* Node dependencies and parameter forms. Planning counts never grant execution. */
'use strict';
const baseline=require('./approvals.json').profiles,legacy=require('./legacy-skills.json').cards;
const META=new Set(['node_id','shared_rule_ids','category_tags','classification_role','polarity']);
const short=n=>n.startsWith('HV-')?n.slice(3):n.startsWith('HVBP-')?n.slice(2):n;
function walk(x,fn){if(Array.isArray(x))x.forEach(v=>walk(v,fn));else if(x&&typeof x==='object'){if(x.kind)fn(x);for(const[k,v]of Object.entries(x))if(!META.has(k))walk(v,fn);}}
function nodes(p){const result=[];walk(p.program,n=>result.push(n));walk(p.formal_cost,n=>result.push(n));return result;}
function scope(catalog){return catalog.cards.filter(c=>c.profiles[0].program&&!baseline[c.profiles[0].profile_id]&&!legacy[short(c.card_no)]);}
function clean(x){if(Array.isArray(x))return x.map(clean);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).filter(k=>!META.has(k)).sort().map(k=>[k,clean(x[k])]));return x;}
function parameters(n){
 const child=x=>Array.isArray(x)?x.map(child):x&&typeof x==='object'?(x.kind?'$node':Object.fromEntries(Object.entries(x).map(([k,v])=>[k,child(v)]))):x;
 const result=Object.fromEntries(Object.entries(n).filter(([k])=>!META.has(k)&&k!=='kind').map(([k,v])=>[k,child(v)]));
 // Child programs are dependencies, not parameter variants of their container.
 for(const k of ['steps','then','else','payment','condition','conditions','options','slots'])if(Object.hasOwn(result,k)&&(['sequence','conditional','payment_branch','optional','choose_modes','all','any','formal_declaration_cost','retrieve_slots'].includes(n.kind)))result[k]='$nodes';
 return clean(result);
}
function forms(catalog){const result={};for(const c of catalog.cards.filter(c=>c.profiles[0].program&&!legacy[short(c.card_no)]))for(const p of c.profiles)for(const n of nodes(p)){const bucket=result[n.kind]??=new Map(),key=JSON.stringify(parameters(n));if(!bucket.has(key))bucket.set(key,{node:n,cards:new Set()});bucket.get(key).cards.add(short(c.card_no));}return result;}
function entrySupported(c){const a=c.profiles[0].activation;return reviewClear(c)&&!!a&&LIVE_ENTRIES.includes(entryKey(c))&&(!['event','active'].includes(a.skill_type)||JSON.stringify(a.source_zones)==='["hand"]');}
function dependencies(c){return [...new Set(c.profiles.flatMap(p=>nodes(p).map(n=>n.kind)))].sort();}
const PRIORITY=['numeric','selector','conditional','payment_branch','pay_guts','compare','draw'];
const BASE_ENTRIES=['event','active','passive:self_entry'];
const LIVE_ENTRIES=[...BASE_ENTRIES,'permanent_entry_name','passive:character_entry','passive:source_covered','passive:event_played'];
const entryKey=c=>c.profiles[0].activation.skill_type==='passive'?'passive:'+c.profiles[0].activation.trigger?.event:c.profiles[0].activation.skill_type;
const reviewClear=c=>c.profiles.length===1&&!c.skill_text_variant_conflict&&!c.profiles[0].flags?.length;
function inventory(catalog,completed,released=[]){
 const fs=forms(catalog),done=new Set(completed),open=new Set(released),source=scope(catalog);
 const cards=source.map(c=>({code:short(c.card_no),dependencies:dependencies(c),entry:entryKey(c),reviewClear:reviewClear(c),released:open.has(short(c.card_no))}));
 const rows=Object.entries(fs).map(([kind,shapes])=>({kind,completed:done.has(kind),parameterForms:shapes.size,dependentCards:cards.filter(c=>c.dependencies.includes(kind)).length}));
 const rest=rows.filter(r=>!['sequence','deck_selection',...PRIORITY].includes(r.kind)).map(r=>({type:'node',kind:r.kind,frequency:r.dependentCards}));
 for(const kind of [...new Set(cards.map(c=>c.entry))].filter(k=>!BASE_ENTRIES.includes(k)))rest.push({type:'entry',kind,frequency:cards.filter(c=>c.entry===kind).length});
 rest.sort((a,b)=>b.frequency-a.frequency||(a.type==='entry')-(b.type==='entry')||a.kind.localeCompare(b.kind));
 const route=[...PRIORITY.map(kind=>({type:'node',kind,frequency:rows.find(r=>r.kind===kind).dependentCards})),...rest];
 const nodeSet=new Set(['sequence','deck_selection']),entrySet=new Set(BASE_ENTRIES),path=[];let nodeStep=0;
 for(const step of route){
  (step.type==='node'?nodeSet:entrySet).add(step.kind);if(step.type==='node')nodeStep++;
  const matches=cards.filter(c=>c.dependencies.every(k=>nodeSet.has(k)));
  const available=matches.filter(c=>c.reviewClear&&entrySet.has(c.entry));
  path.push({...step,nodeStep,completed:step.type==='node'?done.has(step.kind):LIVE_ENTRIES.includes(step.kind),nodesReady:matches.length,entryReady:available.length,currentEntryReady:matches.filter(c=>c.reviewClear&&LIVE_ENTRIES.includes(c.entry)).length});
 }
 const pending=path.find(s=>!s.completed);let next=pending;
 if(pending){const ready=new Set(done),entries=new Set(LIVE_ENTRIES);(pending.type==='node'?ready:entries).add(pending.kind);next={...pending,routeEntryReady:pending.entryReady,entryReady:cards.filter(c=>c.reviewClear&&entries.has(c.entry)&&c.dependencies.every(k=>ready.has(k))).length};}
 return {scope:cards.length,kinds:rows.length,completed:[...completed],completedEntries:LIVE_ENTRIES,rows,path,next,cards};
}
module.exports={short,walk,nodes,scope,forms,parameters,clean,entrySupported,dependencies,inventory,entryKey,PRIORITY,LIVE_ENTRIES};
if(require.main===module){const r=inventory(require('./data/cards.json'),require('./modules').completed.map(m=>m.id),Object.keys(require('./runtime-data.json').authority.cards).filter(c=>require('./runtime-data.json').authority.cards[c].kind==='shared'));console.log(JSON.stringify({scope:r.scope,kinds:r.kinds,completed:r.completed,path:r.path,next:r.next},null,2));}
