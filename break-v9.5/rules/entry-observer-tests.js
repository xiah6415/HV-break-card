'use strict';
const assert=require('node:assert/strict'),I=require('./node-inventory'),{fixture}=require('./batch-smoke'),{matchesPrinted}=require('./batch-fixtures');
const areas=['serve','block','receive','toss','attack','side:0','side:1'];
function setup(catalog,card,mode='positive'){
 const p=card.profiles[0],t=p.activation.trigger,sourceArea=t.source_role||I.nodes(p).find(n=>n.kind==='compare'&&n.field==='source.role'&&n.op==='eq')?.value||'receive';
 const {k,id}=fixture(card,p,sourceArea,{rich:true,conditioned:true,expanded:true,max:true,key:'positive'},0,catalog);
 if(mode==='short')for(const a of areas)for(const x of [...k.zone(0,a)]){if(a!==sourceArea&&x===k.top(0,a))continue;k._atomic(()=>k._move(x,0,'deck',k._context(id,0)));}
 k._atomic(()=>k._move(id,0,sourceArea,k._context(id,0)));
 const role=t.filters.role_any?.[0]||t.filters.role||'attack',dest=role==='block'?'block':role;
 const f=Object.fromEntries(Object.entries(t.filters).filter(([x])=>!['role','role_any','entry_origins'].includes(x)));
 const uniforms=I.nodes(p).filter(n=>n.kind==='uniform_affiliation').flatMap(n=>n.options.slice(0,1));
 const other=dest==='attack'?k.top(0,'toss'):dest==='toss'?k.top(0,'receive'):null;
 const def=catalog.cards.find(c=>{const q=c.profiles[0],v=q.variants[0].printed;return !q.program&&matchesPrinted(q,{type:'character',...f})&&v.parameters[dest]!=='dash'&&(!other||k.effectiveName(other)!==v.name)&&uniforms.every(tag=>v.affiliation_tags.includes(tag));});
 assert(def,'Real entry target for '+card.card_no);const target=k.addCard(def.card_no,0,'hand');
 // Uniform-affiliation conditions and multi-attack need actual same-school court Guts.
 if(card.card_no==='HV-P04-011'){const def=catalog.cards.find(c=>!c.profiles[0].program&&c.profiles[0].variants[0].printed.affiliation_tags.includes('烏野')&&c.profiles[0].variants[0].printed.name!==k.card(id).printed.name);for(let i=0;i<3;i++){k.addCard(def.card_no,0,sourceArea);const stack=k.zone(0,sourceArea);stack.unshift(stack.pop());}}
 for(const n of I.nodes(p).filter(n=>n.kind==='enter')){
  const pool=k.pool(n.pool,k._context(id,0)),other=n.destination==='attack'?id:n.destination==='toss'?k.top(0,'receive'):null;
  if(!pool.some(x=>k.card(x).printed.type==='character'&&k.card(x).printed.parameters[n.destination]!=='dash'&&(!other||k.effectiveName(x)!==k.effectiveName(other)))){
   const candidate=catalog.cards.find(c=>!c.profiles[0].program&&matchesPrinted(c.profiles[0],{type:'character',...n.pool.filters})&&c.profiles[0].variants[0].printed.parameters[n.destination]!=='dash'&&(!other||c.profiles[0].variants[0].printed.name!==k.effectiveName(other)));
   assert(candidate,'Legal actual effect-entry fixture '+card.card_no);const z=n.pool.zone==='court.guts'?'receive':n.pool.zone.split('.')[0],x=k.addCard(candidate.card_no,0,z);if(n.pool.zone.endsWith('.guts')){const a=k.zone(0,z);a.unshift(a.pop());}
  }
 }
 if(mode==='mismatch')k.card(target).printed.name='Not the requested entry name';
 if(mode==='wrong_role')for(const x of [...k.zone(0,sourceArea)])k._atomic(()=>k._move(x,0,'drop',k._context(id,0)));
 k.state.turn.phase=dest;
 return {k,id,target,dest,p};
}
function testEntryCard(catalog,card){
 const nodes=I.nodes(card.profiles[0]),hasCost=nodes.some(n=>n.kind==='pay_guts'),canDecline=nodes.some(n=>n.kind==='payment_branch');
 for(const mode of ['positive','wrong_role',hasCost?'short':canDecline?'decline':'condition_false']){
  const f=setup(catalog,card,mode),{k,id,target,dest,p}=f;
  if(mode==='condition_false'){while(k.zone(0,'event').length<=5)k.addCard('HV-D01-009',0,'event');}
  if(mode==='decline'){const choose=k.choose;k.choose=r=>r.kind==='activate_payment'?false:choose(r);}
  const before=k.snapshot(),start=before.events.length;k.enter(target,dest);
  const after=k.snapshot(),resolved=after.events.slice(start).filter(e=>e.type==='resolve_trigger'&&!e.generated);
  if(mode==='positive'&&nodes.some(n=>n.kind==='enter'))assert(resolved.length>=1,card.card_no+' actual chained observer triggers');else assert.equal(resolved.length,mode==='wrong_role'?0:1,card.card_no+' '+mode+' actual observer trigger');
  const effects=after.effects.slice(before.effects.length);
  if(mode==='positive')assert(effects.length>0||after.events.slice(start).some(e=>e.type==='hand_added'||e.type==='move'&&e.id===id),card.card_no+' must perform printed effect');
  else assert.equal(effects.length,0,card.card_no+' '+mode+' no bonus or generated watch');
  if(mode==='short')assert(!after.decisions.slice(before.decisions.length).some(d=>d.request.kind==='activate_payment'));
  k.restore(before);k.enter(target,dest);assert.deepEqual(k.snapshot(),after,'Entry observer Undo '+card.card_no+' '+mode);
 }
}
module.exports={setup,testEntryCard};
