'use strict';
const assert=require('node:assert/strict'),{Match}=require('./match'),H=require('../host-choice');
const codes=Object.keys(require('./legacy-skills.json').cards),seen=new Set();
const deck=['P01-078','P03-086','P03-087','PR-029'].flatMap(c=>[c,c]).concat(['P01-006','PR-022','PR-057','D01-009','P01-001','P01-004','D01-005','P01-009'].flatMap(c=>Array(4).fill(c)));
for(const seed of [1,7,11,19,29,43]){
 const m=new Match({seed,decks:[deck,deck]}),k=m._kernel;let steps=0,restored=false;
 while(m.snapshot().match.phase!=='finished'&&steps++<2000){let r=m.request(0)||m.request(1);assert(r);const beforeProbe=m.snapshot();m._playable(r.actor);assert.deepEqual(m.snapshot(),beforeProbe,'Legality probes preserve complete state, RNG and pending requests');let a=H.aiAnswer(r);
  const wanted={receiver:'PR-022',setter:'P01-006',attacker:'PR-057'}[r.kind];
  if(wanted){const o=r.options.find(o=>o.card?.cardNo==='HV-'+wanted);if(o)a=H.makeAnswer(r,o.value);}
  if(r.kind==='event'){const o=r.options.find(o=>o.card?.cardNo==='HV-PR-029')||r.options.find(o=>o.value!==null);if(o)a=H.makeAnswer(r,o.value);}
  if(!restored&&r.kind==='turnEnd'){const s=m.snapshot();m.restore(s);r=m.request(0)||m.request(1);a=H.aiAnswer(r);restored=true;}
  assert(H.validate(r,a).ok);m.dispatch(a);
  for(const e of k.state.events){if(['resolve_trigger','event_played','character_entry'].includes(e.type)){const id=e.source?.id||e.source||e.card||e.id;if(typeof id==='string'&&k.state.cards[id]){const code=k.card(id).cardNo.replace(/^HV-/,'');if(codes.includes(code))seen.add(code);}}}
 }
 assert.equal(m.snapshot().match.phase,'finished');assert.equal(Object.keys(k.state.cards).length,80);console.log('legacy core match seed '+seed+': '+steps+' decisions passed');
}
assert.deepEqual([...seen].sort(),codes.slice().sort(),'Full new-core matches must actually encounter every migrated card');
console.log('legacy migration native matches: all seven cards, complete games, 80 identities and mid-game restore passed');
