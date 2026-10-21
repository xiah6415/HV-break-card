/* One test per distinct node parameter form, with independent expected results. */
'use strict';
const assert=require('node:assert/strict'),{Kernel}=require('./core'),I=require('./node-inventory');
const ruleIds=require('./data/shared-rules.json').rules.map(r=>r.id),C=['serve','block','receive','toss','attack','side:0','side:1'],P=['serve','block','receive','toss','attack'];
const copy=x=>structuredClone(x),base='HV-D01-009';
function choose(r){if(r.kind==='reveal')return true;if(r.kind==='revealResult')return [];if(['activate_payment','optional'].includes(r.kind))return true;if(r.count!=null)return r.options.slice(0,r.count);return r.options.at(-1);}
function game(catalog){return new Kernel({catalog,ruleIds,fingerprint:'frequent-node-tests',mode:'sandbox',choose});}
function plain(k,p=0,z='attack'){const id=k.addCard(base,p,z);k.card(id).printed.parameters=Object.fromEntries(P.map(p=>[p,2]));return id;}
function forms(catalog,kind,fn){const rows=I.forms(catalog)[kind];for(const {node}of rows.values())fn(copy(node));return rows.size;}
function role(k,id){const c=k.card(id),z=c.zone.split('.')[1];if(!C.includes(z)||k.zone(c.owner,z).at(-1)!==id)return 'guts';return z==='block'?'center_blocker':z.startsWith('side:')?'side_blocker':z;}
function printed(k,id,f){const c=k.card(id),p=c.printed,profile=k.profiles[c.profileId];return Object.entries(f).every(([key,v])=>{
 if(key==='names')return v.includes(p.name);if(key==='exclude_names')return !v.includes(p.name);
 if(key==='type')return p.type===v;if(key==='role')return v==='character'?role(k,id)!=='guts':v==='block'?['center_blocker','side_blocker'].includes(role(k,id)):role(k,id)===v;
 if(key==='play_icons_any')return v.some(x=>profile.activation?.activation_phases.includes(x));
 if(key==='skillless')return !profile.program===v;
 if(key==='printed_attack_eq')return p.parameters?.attack===v;
 if(key==='current_receive_gte')return p.parameters?.receive>=v;
 if(key==='current_block_eq')return p.parameters?.block===v;
 const field={tags:'affiliation_tags',positions:'position_tags',positions_any:'position_tags',years:'year_tags',years_any:'year_tags'}[key];assert(field,'Untested selector filter '+key);
 return key.endsWith('_any')?v.some(x=>p[field].includes(x)):v.every(x=>p[field].includes(x));
});}
function testSelector(catalog){return forms(catalog,'selector',node=>{
 const k=game(catalog),source=plain(k,0,'hand'),ctx=k._context(source,0),f=node.filters;k.preflight(node);
 const profile=catalog.cards.flatMap(c=>c.profiles.map((p,index)=>({c,p,index}))).find(({p})=>(!f.skillless||!p.program)&&(!f.play_icons_any||f.play_icons_any.some(i=>p.activation?.activation_phases.includes(i))));assert(profile);
 for(const who of [0,1])for(const z of [...C,'hand','drop','event','deck','sets'])for(let i=0;i<2;i++){
  const id=k.addCard(profile.c.card_no,who,z,profile.index),p=k.card(id).printed;
  p.parameters=Object.fromEntries(P.map(p=>[p,2]));p.name=f.names?.[0]||'測試角色';p.type=f.type||'character';
  p.affiliation_tags=f.tags||['測試校'];p.position_tags=f.positions||f.positions_any?.slice(0,1)||['WS'];p.year_tags=f.years||f.years_any?.slice(0,1)||[1];
  if(f.current_receive_gte)p.parameters.receive=f.current_receive_gte;
  if(f.current_block_eq!=null)p.parameters.block=f.current_block_eq;
  if(f.printed_attack_eq!=null)p.parameters.attack=f.printed_attack_eq;
 }
 ctx.bind.milled=[k.zone(0,'drop')[0],k.zone(1,'event')[0]];
 const who=node.actor==='self'?0:1,z=node.zone;
 let pool=z==='court'?C.map(a=>k.zone(who,a).at(-1)):z==='block'?['block','side:0','side:1'].map(a=>k.zone(who,a).at(-1)):z==='court.guts'?C.flatMap(a=>k.zone(who,a).slice(0,-1)):z.endsWith('.guts')?k.zone(who,z.split('.')[0]).slice(0,-1):z==='event_or_drop'?[...k.zone(who,'event'),...k.zone(who,'drop')]:z==='$milled'?ctx.bind.milled:[...k.zone(who,z)];
 assert.deepEqual(k.pool(node,ctx),pool.filter(id=>printed(k,id,f)));
 k.assertState();
});}
function testNumeric(catalog){return forms(catalog,'numeric',n=>{
 const k=game(catalog),id=plain(k),ctx=k._context(id,0),ref=k.reference(id);k.preflight(n);ctx.bind.target=ref;ctx.bind.entered=ref;ctx.event.character=ref;
 ctx.bind.paid=[plain(k,0,'drop'),plain(k,0,'drop')];k.state.ball={owner:1,kind:'attack',offense:8};
 if(typeof n.target==='object')k._targets=()=>[ref]; // selector is a separately tested child node
 let v=typeof n.value==='number'?n.value:n.value.kind==='result_count'?2:n.value.kind==='sum_result_parameter'?4:2;
 const params=n.parameter==='all'?P:typeof n.parameter==='object'?[n.parameter.choose_from.at(-1)]:n.parameter==='chosen'?['attack']:[n.parameter];
 if(n.operation==='set')for(const parameter of P)k.effect('numeric',{target:ref,parameter,operation:'add',value:3},ctx);
 const before=k.snapshot();k._atomic(()=>k._run(n,ctx));
 if(n.target==='opponent_ball')assert.equal(k.state.ball.offense,8+v);
 else for(const p of params)assert.equal(k.parameter(id,p),n.operation==='set'?v:2+v);
 const end=k.snapshot();k.restore(before);k._atomic(()=>k._run(n,ctx));assert.deepEqual(k.snapshot(),end);
 k.endTurn();if(n.target!=='opponent_ball')for(const p of P)assert.equal(k.parameter(id,p),2);
});}
function testConditional(catalog){return forms(catalog,'conditional',node=>{
 for(const yes of [true,false]){const k=game(catalog),ctx=k._context(null,0);let checks=0,runs=0;
  k._predicate=()=>{checks++;return yes;};const original=k._run;k._run=function(n,c){if(n===node.then){runs++;return true;}return original.call(this,n,c);};
  assert.equal(k._run(node,ctx),yes);assert.equal(checks,1);assert.equal(runs,yes?1:0);
 }
});}
function testPaymentBranch(catalog){return forms(catalog,'payment_branch',()=>{
 for(const scenario of ['paid','declined','short']){const k=game(catalog),source=plain(k),ctx=k._context(source,0),guts=plain(k,0,'attack');k.zone(0,'attack').reverse();if(scenario==='short'){k.zone(0,'attack').shift();delete k.state.cards[guts];}
  k.choose=r=>r.kind==='activate_payment'?scenario!=='declined':choose(r);
  const branch={kind:'payment_branch',payment:{kind:'sequence',steps:[{kind:'pay_guts',areas:'source_area',count:1,count_mode:'exact',bind:'paid'}]},then:{kind:'draw',actor:'self',count:1,count_mode:'exact',bind:'drawn'}};
  const top=plain(k,0,'deck');const before=k.snapshot();assert.equal(k._atomic(()=>k._run(branch,ctx)),scenario==='paid');
  if(scenario==='paid'){assert.deepEqual(k.zone(0,'drop'),[guts]);assert(k.zone(0,'hand').includes(top));assert.deepEqual(ctx.bind.paid,[guts]);}
  else {assert.deepEqual(k.zone(0,'deck'),before.zones['0.deck']);assert.deepEqual(k.zone(0,'attack'),before.zones['0.attack']);}
 }
});}
function testPayGuts(catalog){return forms(catalog,'pay_guts',n=>{
 for(const shortage of [false,true]){const k=game(catalog),id=plain(k,0,'attack'),ctx=k._context(id,0);ctx.inPayment=true;
  const areas=n.areas==='court'?C:n.areas==='source_area'?['attack']:n.areas,count=n.count_each||n.count||Math.max(...n.allowed_counts),tops=[];
  for(const a of areas){if(!k.top(0,a))plain(k,0,a);tops.push(k.top(0,a));for(let i=0;i<(shortage?0:count);i++){plain(k,0,a);const list=k.zone(0,a);list.unshift(list.pop());}}
  const before=k.snapshot();if(shortage){assert.throws(()=>k._atomic(()=>k._run(n,ctx)));assert.deepEqual(k.snapshot(),before);continue;}
  k._atomic(()=>k._run(n,ctx));const expected=n.count_mode==='exact_each'?n.count_each*areas.length:n.count_mode==='one_of_exact'?Math.max(...n.allowed_counts):n.count;
  assert.equal(k.zone(0,'drop').length,expected);assert.equal(ctx.bind.paid.length,expected);assert(tops.every(id=>!k.zone(0,'drop').includes(id)));
 }
});}
function setFact(k,ctx,field,a){
 const source=k.card(ctx.source.id),make=(p,z,count)=>{for(let i=0;i<count;i++)plain(k,p,z);};
 if(field==='phase'){k.state.turn.phase=a;return;}
 if(field==='random.result'){ctx.bind.random={result:a};return;}
 if(field==='optional.performed'){ctx.bind.optional={performed:a};return;}
 if(field==='source.entry_skill_name'){source.entrySkillName=a;return;}
 if(field.startsWith('source.covered_character.')){source.coveredCharacter={[field.split('.').at(-1)]:a};return;}
 if(field==='self.attack.guts.count'){for(let i=0;i<a;i++){plain(k,0,'attack');k.zone(0,'attack').unshift(k.zone(0,'attack').pop());}return;}
 if(field==='opponent.block_defense'){const id=plain(k,1,'block');k.card(id).printed.parameters.block=a;return;}
 if(field==='self.court.distinct_affiliation_assignment_count'){source.printed.affiliation_tags=[];for(let i=0;i<a;i++){const id=i===0?source.id:plain(k,0,C.filter(z=>z!=='attack')[i-1]);k.card(id).printed.affiliation_tags=['校'+i];}return;}
 if(field==='revealed.affiliation_intersects_self_court'){source.printed.affiliation_tags=['甲'];const id=plain(k,0,'deck');k.card(id).printed.affiliation_tags=[a?'甲':'乙'];ctx.bind.revealed=[id];return;}
 if(field==='both.set.count_sum'){make(1,'sets',a);return;}
 if(field.startsWith('opponent_ball.')){k.state.ball={owner:1,kind:'attack',offense:8,[field.split('.')[1]]:a};return;}
 let m=field.match(/^(self|opponent)\.(hand|sets|set)\.count$/);if(m){make(m[1]==='self'?0:1,m[2]==='set'?'sets':m[2],a);return;}
 m=field.match(/^(self|opponent)\.(serve|receive|toss|attack)\.(effective_name|printed_attack)$/);if(m){const p=m[1]==='self'?0:1,id=k.top(p,m[2])||plain(k,p,m[2]);if(m[3]==='effective_name')k.card(id).printed.name=a;else k.card(id).printed.parameters.attack=a;return;}
 m=field.match(/^(paid|milled|retrieved|drawn|revealed|moved)\.(count|event_count|names_are_distinct)$/);if(m){const count=m[2]==='names_are_distinct'?2:a;ctx.bind[m[1]]=[];for(let i=0;i<count;i++){const id=m[2]==='event_count'?k.addCard('HV-P01-086',0,'drop'):plain(k,0,'drop');if(m[2]==='names_are_distinct')k.card(id).printed.name=a?'角色'+i:'同名';ctx.bind[m[1]].push(id);}return;}
 m=field.match(/^(source|target)\.(.*)$/);assert(m,'Unseeded fact '+field);const key=m[2];ctx.bind.target=ctx.source;
 if(key==='role'){const area=a==='side_blocker'?'side:0':a==='center_blocker'?'block':a;const old=k.zone(0,'attack');old.splice(old.indexOf(source.id),1);k.zone(0,area).push(source.id);source.zone='0.'+area;return;}
 if(key==='effective_name')source.printed.name=a;else if(key.startsWith('current_'))source.printed.parameters[key.slice(8)]=a;else source[{entry_origin:'entryOrigin',entry_reason:'entryReason',entry_turn:'entryTurn'}[key]]=a;
}
function testCompare(catalog){return forms(catalog,'compare',n=>{
 for(const yes of [true,false]){const k=game(catalog),id=plain(k),ctx=k._context(id,0);let a;
  if(n.op==='eq')a=yes?n.value:typeof n.value==='boolean'?!n.value:typeof n.value==='number'?n.value+1:'不符合';
  else if(n.op==='gte')a=n.value+(yes?0:-1);else if(n.op==='lte')a=n.value+(yes?0:1);
  else if(n.op==='in')a=yes?n.value[0]:'不符合';else if(n.op==='contains')a=yes?[n.value]:[];
  else if(n.op==='odd')a=(yes===n.value)?1:2;else if(n.op==='lt_field'){setFact(k,ctx,n.value,3);a=yes?2:3;}else throw Error('Unhandled comparison '+n.op);
  if(!yes&&n.op==='eq'&&n.field==='source.role')a=n.value==='attack'?'toss':'attack';
  if(!yes&&n.field==='random.result')a=n.value==='heads'?'tails':'heads';
  if(!yes&&n.field==='source.entry_origin')a=n.value==='hand'?'drop':'hand';
  if(!yes&&n.field==='source.entry_reason')a=n.value==='skill'?'rule':'skill';
  if(!yes&&n.field==='phase')a=n.value==='attack'?'draw':'attack';
  setFact(k,ctx,n.field,a);k.preflight(n);assert.equal(k._predicate(n,ctx),yes,JSON.stringify(n));k.assertState();
 }
});}
function testDraw(catalog){return forms(catalog,'draw',n=>{
 for(const banned of [false,true]){const k=game(catalog),ctx=k._context(null,0),player=n.actor==='self'?0:1,ids=[];for(let i=0;i<n.count+1;i++)ids.push(plain(k,player,'deck'));
  if(banned)k.effect('ban',{action:'add_hand',actor:player,scope:{}},ctx);
  k._atomic(()=>k._run(n,ctx));const expected=banned?[]:ids.slice(-n.count).reverse();assert.deepEqual(k.zone(player,'hand'),expected);assert.deepEqual(ctx.bind.drawn,expected);
 }
});}
module.exports={testNumeric,testSelector,testConditional,testPaymentBranch,testPayGuts,testCompare,testDraw,choose,game,setFact,printed};
