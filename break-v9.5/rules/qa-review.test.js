'use strict';
const assert=require('node:assert/strict'),F=require('./frequent-node-tests'),I=require('./node-inventory'),catalog=require('./data/cards.json');
const game=()=>F.game(catalog),card=code=>catalog.cards.find(c=>c.card_no==='HV-'+code),program=code=>card(code).profiles[0].program;
function addGuts(k,id,n){const c=k.card(id),z=c.zone.split('.')[1];for(let i=0;i<n;i++){k.addCard('HV-D01-009',c.owner,z);k.zone(c.owner,z).unshift(k.zone(c.owner,z).pop());}}
function run(k,id,code){return k.resolveProgram(program(code),k.card(id).owner,id);}
// Back attack: no payment prompt or consumption for same-name, banned, dash,
// or stale sources. Legal attacks still pay and enter; unrelated effects remain.
for(const problem of ['same-name','ban','dash','stale','legal','mixed']){
 const k=game(),id=k.addCard('HV-P03-033',0,'serve');addGuts(k,id,1);k.state.turn.phase='attack';
 if(problem==='same-name')k.addCard('HV-P03-033',0,'toss');
 if(['ban','mixed'].includes(problem))k.resolveProgram({kind:'ban_action',actor:'self',action:'enter_character',scope:{role:'attack'},duration:'this_turn'},0,id);
 if(problem==='dash')k.card(id).printed.parameters.attack='dash';
 const ctx=k._context(id,0);if(problem==='stale')ctx.source.incarnation--;
 let asks=0;const choose=k.choose;k.choose=r=>{if(r.kind==='activate_payment')asks++;return choose(r);};
 const n=structuredClone(program('P03-033'));if(problem==='mixed'){k.addCard('HV-D01-009',0,'deck');n.steps[0].then.steps.push({kind:'draw',actor:'self',count:1,count_mode:'exact',bind:'drawn'});}
 const before=k.snapshot();k._atomic(()=>k._run(n,ctx));
 assert.equal(asks,['legal','mixed'].includes(problem)?1:0,problem);
 assert.equal(k.zone(0,'drop').length,['legal','mixed'].includes(problem)?1:0);
 if(problem==='legal'){assert.equal(k.top(0,'attack'),id);assert.equal(k.parameter(id,'attack'),4);}
 else assert.equal(k.top(0,'serve'),id);
 if(problem==='mixed')assert.equal(k.zone(0,'hand').length,1);
 const after=k.snapshot();k.restore(before);k._atomic(()=>k._run(n,ctx));assert.deepEqual(k.snapshot(),after);
}
// P02-016: ordinary entry still draws/adds two; the conditional invalidation
// requires the named entry effect. One-touch(2)/(3) and Narita use the union.
{
 const k=game(),id=k.addCard('HV-P02-016',0,'toss');addGuts(k,id,3);k.addCard('HV-D01-009',0,'deck');const base=k.parameter(id,'toss');run(k,id,'P02-016');
 assert.equal(k.zone(0,'hand').length,1);assert.equal(k.parameter(id,'toss'),base+2);assert(!k.state.effects.some(e=>e.kind==='invalid'));
 k.card(id).entrySkillName='どんぴしゃり';addGuts(k,id,3);run(k,id,'P02-016');k.endTurn();k.beginTurn(1,'block');k.state.ball={owner:0,kind:'attack',offense:9};
 const target=k.addCard('HV-D01-009',1,'block');for(const N of [2,3])assert.equal(k.resolveProgram({kind:'keyword',keyword:'one_touch',N,parameters:{}},1,target),false);
 const narita=k.addCard('HV-P02-011',1,'hand');assert(!k._skillAllowed(k._context(narita,1),k.profile(narita)));
}
// QA1154: an incoming receiver chooses its name before role invalidation.
for(const code of ['P01-032','P02-029']){
 const c=card(code),p=c.profiles[0],phase=p.activation.trigger.destination_any[0],{k,id}=require('./batch-smoke').fixture(c,p,phase,{rich:true,conditioned:true,expanded:true,max:true,key:'positive'},0,catalog);k.enter(id,phase);k.endTurn();k.beginTurn(1,'receive');
 const receiver=k.addCard('HV-P01-072',1,'hand');k.choose=r=>r.kind==='name'?'日向翔陽':F.choose(r);k.enter(receiver,'receive');assert.equal(k.effectiveName(receiver),'日向翔陽');assert(!k._skillAllowed(k._context(receiver,1),k.profile(receiver)));
}
// Drop distinct-character conditions count paid characters, never coach Events.
for(const [code,school,threshold,cost]of [['P02-029','稲荷崎',6,3],['P04-013','烏野',8,1]])for(const useCharacter of [false,true]){
 const k=game(),id=k.addCard('HV-'+code,0,'attack');
 const unique=Array.from(new Map(catalog.cards.filter(c=>c.type==='character'&&c.profiles[0].variants[0].printed.affiliation_tags.includes(school)).map(c=>[c.profiles[0].variants[0].printed.name,c.card_no])).values()).filter(c=>c!=='HV-'+code);
 for(const c of unique.slice(0,threshold-1))k.addCard(c,0,'drop');
 const event=catalog.cards.find(c=>c.type==='event'&&c.profiles[0].variants[0].printed.affiliation_tags.includes(school));k.addCard(event.card_no,0,'drop');
 const payment=useCharacter?unique[threshold-1]:event.card_no;
 for(let i=0;i<cost;i++){const x=k.addCard(payment,0,code==='P02-029'?'attack':'hand');if(code==='P02-029')k.zone(0,'attack').unshift(k.zone(0,'attack').pop());}
 run(k,id,code);assert.equal(k.state.effects.filter(e=>e.kind==='invalid').length,useCharacter?1:0,code+' paid character threshold');
}
// QA1335 guarantees no benefit with fewer than three cards. Keep optional
// complete-cost behavior: no partial payment (the QA does not specify it).
for(const count of [0,1,2,3]){
 const k=game(),id=k.addCard('HV-P02-066',0,'toss');addGuts(k,id,2);for(let i=0;i<count;i++)k.addCard('HV-D01-009',0,'deck');const base=k.parameter(id,'toss');run(k,id,'P02-066');
 assert.equal(k.parameter(id,'toss'),base+(count===3?2:0));assert.equal(k.zone(0,'deck').length,count===3?0:count);assert.equal(k.zone(0,'drop').length,count===3?5:0);
 if(count===3){const name=k.addCard('HV-PR-013',0,'hand');k.choose=r=>r.kind==='name'?'木兎光太郎':F.choose(r);k.enter(name,'attack');assert.equal(k.effectiveName(name),'木兎光太郎');assert(!k._skillAllowed(k._context(name,0),k.profile(name)));}
}
// P03-063 with an empty deck still enters with no effect.
{
 const k=game(),id=k.addCard('HV-P03-063',0,'hand');k.state.turn.phase='serve';const value=k.card(id).printed.parameters.serve;k.enter(id,'serve');assert.equal(k.top(0,'serve'),id);assert.equal(k.parameter(id,'serve'),value);assert(!k.state.effects.length);
}
// P03-073: each of the three areas owes exactly two, not pooled six.
for(const shortage of [false,true]){
 const k=game(),id=k.addCard('HV-P03-073',0,'attack');for(const area of ['receive','toss','attack']){const top=area==='attack'?id:k.addCard('HV-D01-009',0,area);addGuts(k,top,shortage&&area==='receive'?1:2);}const before=k.snapshot();run(k,id,'P03-073');
 assert.equal(k.zone(0,'drop').length,shortage?0:6);if(shortage)for(const z of ['receive','toss','attack'])assert.deepEqual(k.zone(0,z),before.zones['0.'+z]);
}
// QA1876: the ordinary enter_self branch still pays, but cannot evade the
// one-blocker quota. This differs from a wholly impossible back-attack branch.
{
 const k=game(),id=k.addCard('HV-P04-020',0,'attack');addGuts(k,id,3);k.effect('numeric',{target:k.reference(id),parameter:'attack',operation:'add',value:3},k._context(id,0));run(k,id,'P04-020');k.endTurn();k.beginTurn(1,'block');
 const blocker=k.addCard('HV-D01-009',1,'hand');k.enter(blocker,'block');const temp=k.addCard('HV-P04-038',1,'receive');addGuts(k,temp,2);k.state.turn.phase='receive';run(k,temp,'P04-038');assert.equal(k.top(1,'receive'),temp);assert.equal(k.zone(1,'drop').length,2);assert.equal(k.top(1,'side:0'),null);
}
console.log('QA review: back-attack legality before fees/replay; invalidation mandatory cases, complete costs, character thresholds and blocked entry passed');
