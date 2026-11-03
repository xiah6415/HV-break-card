'use strict';
const assert=require('node:assert/strict'),{Match}=require('./rules/match'),{rotateView}=require('./rules/online-session'),S=require('./rules/status-view'),E=require('./engine'),I=require('./rules/node-inventory'),catalog=require('./rules/data/cards.json');
const d=Object.entries(E.DECKS.seijoh.cards).flatMap(([c,n])=>Array(n).fill(c)),m=new Match({id:'status',decks:[d,d]}),k=m._kernel,source=k.zone(0,'deck')[0],ctx=k._context(source,0);
k._atomic(()=>k._move(source,0,'attack',ctx));
const effect=k.effect('ban',{actor:1,action:'add_hand',scope:{origins:['skill']}},ctx,'next_opponent_turn');
let a=m.view(0);assert.equal(a.statuses[0].scheduled,true);assert.match(a.statuses[0].label,/技能加手牌/);assert.match(a.statuses[0].detail,/含技能抽牌/);assert(a.statuses[0].source);const before=m.snapshot();m.view(0);m.view(1);assert.deepEqual(m.snapshot(),before,'projection is read-only');
k.state.turn={id:2,player:1,phase:'draw',step:'free'};effect.duration.activeTurn=2;
a=m.view(1);assert(a.statuses[0].active);assert(!k.permission({action:'add_hand',player:1,origin:'skill'}).allowed);assert(k.permission({action:'add_hand',player:1,origin:'rule'}).allowed);const rotated=rotateView(a,1);assert.equal(rotated.statuses[0].player,0);assert.equal(a.statuses[0].player,1);
k._cleanup(false);assert.equal(m.view(0).statuses.length,0);
const hidden=k.zone(0,'hand')[0]||k.zone(0,'deck')[0],hiddenContext=k._context(hidden,0);k.effect('invalid',{actor:1,selector:{source_zones:['hand'],phase_tags:['receive']}},hiddenContext);assert.equal(m.view(1).statuses[0].source,null,'opponent hidden source omitted');assert(m.view(0).statuses[0].source);assert(!JSON.stringify(m.view(1).statuses).includes(hidden));
for(const kind of ['ban_action','invalidate_skill','parameter_absent','force_judgment_failure'])for(const {node:n}of I.forms(catalog)[kind].values()){
 const e={...n,...(n.kind==='parameter_absent'?{role:n.target.filters.role}:{}),kind:{ban_action:'ban',invalidate_skill:'invalid',parameter_absent:'absent',force_judgment_failure:'judgment_failure'}[kind]};assert(S.description(e)?.label);assert(!/undefined/.test(JSON.stringify(S.description(e))));
}
const n=k.effect('ban',{actor:1,action:'add_hand',scope:{origins:['rule','skill'],phases:['draw']}},hiddenContext,'this_draw_phase');assert(m.view(1).statuses.some(s=>s.id===n.id));k.state.turn.phase='receive';assert(!m.view(1).statuses.some(s=>s.id===n.id));
console.log('negative statuses: all restriction forms, waiting/active/expiry, rule vs skill draw, read-only, hidden source privacy and seat-1 rotation passed');
