'use strict';
const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),L=require('./card-library'),E=require('./engine'),bridge=require('./rules/legacy'),R=require('./rules/runtime-data.json');
(async()=>{
 console.log(execFileSync('/usr/bin/python3',['rules/authority.test.py'],{encoding:'utf8'}).trim());
 assert.deepEqual(L.data.authority,R.authority);assert.deepEqual(L.data.authority.counts,{basic:183,shared:176,legacy:7,unapproved:175});
 for(const c of Object.values(L.data.cards)){const p=L.permission(c.code);assert.equal(L.strictAllowed(c.code),p.kind!=='unapproved');assert.equal(bridge.handles(c.code),p.kind==='shared');assert.equal(c.playable,L.strictAllowed(c.code));assert.equal(p.profileSha256,undefined);assert(Object.isFrozen(p));}
 const denied=L.card('P04-093'),before=denied.playable;denied.playable=true;try{assert.throws(()=>L.requirePlayable(denied.code),/尚未開放/);assert.equal(L.search('P04-093','playable').length,0);}finally{denied.playable=before;}
 for(const mode of ['numeric','strict']){const g=new E.Game({mode,seed:7,decks:['k1014','seijoh'],agents:[{wantsAck:true,choose:async()=>null},E.AI]}),p=g.players[0];g.beginTurn(p);g.moveCode(p.deck,p.hand,'P01-004');const state=JSON.stringify(g.cardSnapshot());await assert.rejects(g.resolveLegacy(p,'P01-004','atk'),/白名單/);await assert.rejects(g.resolveLegacy(p,'P01-013','atk'),/白名單/);await assert.rejects(g.resolveLegacy(p,'P04-092','atk'),/白名單/);assert.equal(JSON.stringify(g.cardSnapshot()),state);await assert.rejects(g.resolve(p,'P01-004','atk'),/核准/);}
 console.log('authority: 541 permissions, frozen execution sources, tested module grants, strict-vs-numeric separation and direct legacy bypass refusal passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
