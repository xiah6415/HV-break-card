'use strict';
const assert=require('node:assert/strict');
const E=require('../engine'),bridge=require('./legacy');
const cases=[];
const copy=x=>JSON.parse(JSON.stringify(x));
function setup(choose) {
  const logs=[],g=new E.Game({seed:7,reveal:0,decks:['k1014','seijoh'],agents:[{wantsAck:true,choose},E.AI],onLog:s=>logs.push(s)});
  for(const q of g.players) {q.hand=[];q.deck=[];q.drop=[];q.ev=[];q.sets=[];for(const a in q.area)q.area[a]=[];}
  const p=g.players[0];g.beginTurn(p);p.area.receive=['P04-026'];p.ts.receiver='P04-026';p.ts.rcv=5;
  return {g,p,logs};
}
function cards(g) {return g.players.flatMap(p=>[...p.hand,...p.deck,...p.drop,...p.ev,...p.sets,...Object.values(p.area).flat(),...(p.ts.sides||[])]).sort();}
async function check(name,fn){await fn();cases.push({name,passed:true});}
(async()=>{
  for(const n of [0,1])await check('Optional draw '+n+' uses the later hand count and a chosen court target',async()=>{
    const seen=[],{g,p,logs}=setup(async(g,p,r)=>{seen.push(r.kind);if(r.kind==='rulesChoice')return n;assert.equal(p.deck.length,1-n);assert.equal(p.ev.length,1);return 'attack';});
    p.hand=['P01-088','D04-003','D04-003','D04-003'];p.deck=['D04-003'];p.area.attack=['P01-035'];p.ts.attacker='P01-035';p.ts.atk=4;
    const before=cards(g);await g.resolve(p,'P01-088','rcv');assert.deepEqual(cards(g),before);
    assert.equal(g.parameter(p,'attack','rcv'),n?2:3);assert.equal(p.ts.rcv,5);assert.equal(p.ts.atk,4);
    assert.equal(logs.filter(x=>x.includes('抽到')).length,n);assert.deepEqual(seen,['rulesChoice','target']);
  });
  await check('Hand-cost skill can target a side character, never its Guts',async()=>{
    const {g,p}=setup(async(g,p,r)=>{assert.equal(p.drop.length,1,'formal declaration cost visible before target');assert(!r.options.some(o=>o.value==='receive'));return 'side:0';});
    p.hand=['P01-013'];p.area.attack=['P01-002','P01-004'];p.ts.sides=['D01-009'];
    const before=cards(g);assert(bridge.canPlay(g,p,'P01-013','rcv'));await g.resolve(p,'P01-013','rcv');
    assert.deepEqual(p.drop,['P01-013']);assert.equal(g.parameter(p,'side:0','rcv'),4);assert.equal(g.parameter(p,'attack','rcv'),5);assert.deepEqual(cards(g),before);
  });
  for(const pay of [false,true])await check('Optional discard '+pay+' changes the same selected target exactly once',async()=>{
    const {g,p,logs}=setup(async(g,p,r)=>r.kind==='target'?'attack':r.kind==='skill'?pay:r.options.at(-1).value);
    p.hand=['P04-089','D04-003','D04-003'];p.deck=['P04-089','D04-003'];p.area.attack=['P01-035'];
    const before=cards(g);await g.resolve(p,'P04-089','rcv');assert.deepEqual(cards(g),before);
    assert.equal(g.parameter(p,'attack','rcv'),pay?4:2);assert.equal(p.ts.rcv,5);assert.equal(p.drop.length,pay?1:0);
    assert.equal(p.hand.length,pay?2:3);assert.equal(logs.filter(s=>s.includes('抽到')).length,1);assert.equal(logs.filter(s=>s.includes('棄掉')).length,pay?1:0);
    g.moveCard(p.deck,p.hand,0);assert(bridge.canPlay(g,p,'P04-089','rcv'),'invalid skill still permits Event placement');
    const prior=copy({deck:p.deck,fx:p.effects});await g.resolve(p,'P04-089','rcv');assert.deepEqual({deck:p.deck,fx:p.effects},prior);
  });
  await check('No-add restriction skips the draw but preserves target bonuses',async()=>{
    const {g,p}=setup(async(g,p,r)=>{assert.equal(r.kind,'target');return 'receive';});p.hand=['P01-088'];p.deck=['D04-003'];p.restrict.no_add=1;
    await g.resolve(p,'P01-088','rcv');assert.equal(p.deck.length,1);assert.equal(p.ts.rcv,7);assert.deepEqual(p.newCount,{});
  });
  await check('An inert optional event is unavailable; a compulsory draw may resolve without a target',async()=>{
    const {g,p}=setup(async(g,p,r)=>r.kind==='skill'?false:r.options[0].value);p.area.receive=[];p.hand=['P01-088'];p.deck=['D04-003'];p.restrict.no_add=1;
    assert(!bridge.canPlay(g,p,'P01-088','rcv'));delete p.restrict.no_add;assert(bridge.canPlay(g,p,'P01-088','rcv'));
    const options=[];p.agent.choose=async(g,p,r)=>{options.push(r.options.map(o=>o.value));return r.options[0].value;};
    await g.resolve(p,'P01-088','rcv');assert.deepEqual(options,[[1]],'zero draw would be inert and is not offered');assert.equal(p.hand.length,1);
  });
  await check('Partial resolution: compulsory draw plus no eligible target',async()=>{
    const {g,p}=setup(async(g,p,r)=>{assert.equal(r.kind,'skill');return false;});p.hand=['P04-089'];p.deck=['D04-003'];p.area.receive=['D04-010'];
    assert(bridge.canPlay(g,p,'P04-089','rcv'));await g.resolve(p,'P04-089','rcv');assert.deepEqual(p.hand,['D04-003']);assert.equal(p.ts.rcv,5);
  });
  await check('Wrong phase and missing hand are excluded; invalid Turn1 Event remains placeable',async()=>{
    const {g,p}=setup(()=>{throw Error('no choice expected');});p.hand=['P01-013','P04-089'];p.ts.used['P04-089']=1;
    const before=copy({hand:p.hand,deck:p.deck,used:p.ts.used});assert(!bridge.canPlay(g,p,'P01-013','drw'));assert(bridge.canPlay(g,p,'P04-089','rcv'));assert(!bridge.canPlay(g,p,'P01-088','rcv'));
    assert.deepEqual({hand:p.hand,deck:p.deck,used:p.ts.used},before);
  });
  for(const lossAt of ['target','rulesChoice'])await check('Loss during '+lossAt+' retains completed placement/draw/target, with no later write',async()=>{
    const {g,p}=setup(async(g,p,r)=>r.kind===lossAt?{__loss:true}:r.kind==='target'?'receive':true);
    p.hand=['P04-089','D04-003'];p.deck=['D04-003'];let error;
    try{await g.resolve(p,'P04-089','rcv');}catch(e){error=e;}
    assert(error?.why.includes('主動 Loss'));assert.deepEqual(p.ev,['P04-089']);assert.equal(p.deck.length,0);assert.equal(p.drop.length,0);assert.equal(p.ts.rcv,lossAt==='target'?5:6);
    const before=copy(p.hand);await new Promise(r=>setImmediate(r));assert.deepEqual(p.hand,before);
  });
  await check('Invalid response is re-asked without drawing twice',async()=>{
    let count=0;const {g,p,logs}=setup(async(g,p,r)=>{if(r.kind==='target')return count++?'receive':'not-a-zone';return 1;});
    p.hand=['P01-088'];p.deck=['D04-003'];await g.resolve(p,'P01-088','rcv');assert.equal(count,2);assert.equal(p.ts.rcv,7);assert.equal(logs.filter(s=>s.includes('抽到')).length,1);
  });
  await check('Existing receive modifiers and renamed identity survive projection and cleanup',async()=>{
    const {g,p}=setup(async()=> 'receive');p.hand=['P01-013'];p.area.receive=['PR-057'];p.ts.receiver='PR-057';p.ts.rcv=8;p.effects.receive={card:'PR-057',name:'日向 翔陽',mods:{rcv:3}};
    await g.resolve(p,'P01-013','rcv');assert.equal(p.ts.rcv,10);assert.equal(p.effects.receive.mods.rcv,5);assert.equal(g.cardName(p,'receive'),'日向 翔陽');g.finishTurn(p);assert.deepEqual(p.effects,{});
  });
  await check('Only released shared profiles are admitted',async()=>{
    assert.equal(bridge.approvals.length,257);assert(!bridge.handles('P03-087'));assert(bridge.handles('P03-057'));assert(bridge.handles('P04-088'));
  });
  await check('Stale effects from a replaced card cannot swallow or contaminate a new bonus',async()=>{
    const {g,p}=setup(async()=> 'receive');p.hand=['P01-013'];p.area.receive=['P01-004'];p.ts.receiver='P01-004';p.ts.rcv=5;
    p.effects.receive={card:'P01-002',name:'過期名稱',mods:{rcv:9}};
    await g.resolve(p,'P01-013','rcv');assert.equal(p.ts.rcv,7);assert.equal(g.parameter(p,'receive','rcv'),7);
    assert.deepEqual(p.effects.receive,{card:'P01-004',ref:g.cardReference(p,'receive'),mods:{rcv:2}});
  });
  console.log(JSON.stringify({passed:cases.length,failed:0,cases},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
