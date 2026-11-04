'use strict';
const assert=require('node:assert/strict'),{Match}=require('./match'),{TableSession,boardView}=require('./table-session'),{RoomAuthority}=require('./room-authority'),{rotateView}=require('./online-session'),H=require('../host-choice');
const deck=Array(40).fill('D01-009'),options={id:'surrender',seed:7,decks:[deck,deck],deckKeys:['a','b'],wantsAck:[true,true]};
for(const actor of [0,1]){
 const m=new Match(options),before=m.snapshot(),r=m.request(0)||m.request(1),cmd={kind:'surrender',actor,matchId:options.id,epoch:m.epoch};
 for(const bad of [{...cmd,actor:2},{...cmd,matchId:'old'},{...cmd,epoch:-1}]){assert.throws(()=>m.command(bad),/STALE/);assert.deepEqual(m.snapshot(),before);}
 m.command(cmd);assert.equal(m._m.winner,1-actor);assert.equal(m._m.endReason,'surrender');assert.equal(m.request(0),null);assert.equal(m.request(1),null);assert.deepEqual(m.snapshot().zones,before.zones);assert.deepEqual(m.snapshot().rng,before.rng);assert.throws(()=>m.command(cmd),/STALE/);assert.throws(()=>m.dispatch(H.aiAnswer(r)),/STALE/);
 const fresh=new Match(options);fresh.restore(m.snapshot());assert.equal(fresh._m.winner,1-actor);const rotated=boardView(rotateView(fresh.view(actor),actor),['a','b']);assert.equal(rotated.winner.idx,1);assert.equal(rotated.surrendered,0);
}
{
 let boards=0;const s=new TableSession(options,{onBoard:()=>boards++});s.start();s.surrender();assert.equal(s.match._m.winner,1);assert(!s.status().enabled);const cp=s.checkpoint(),resumed=TableSession.fromCheckpoint(cp);assert.equal(resumed.match._m.winner,1);assert.equal(resumed.match._m.endReason,'surrender');assert.equal(resumed.match._m.pc,'done');resumed.start();assert(!resumed.waiting);resumed.stop();s.stop();assert(boards>=2);
}
{
 let s;for(let seed=0;seed<30;seed++){const candidate=new TableSession({...options,seed,delay:60000});if(candidate.match.request(1)){s=candidate;break;}}assert(s);s.start();assert(!s.waiting);let late=false;const oldTimer=s._guard(s.token,()=>{late=true;});s.surrender();oldTimer();assert(!late);const restored=TableSession.fromCheckpoint(s.checkpoint());assert.equal(restored.match._m.winner,1);assert.equal(restored.match._m.endReason,'surrender');restored.stop();s.stop();
}
{
 const room=new RoomAuthority({...options,players:['host','guest']}),r=room.match.request(0)||room.match.request(1),actor=1-r.actor,cmd={kind:'surrender',actor,matchId:options.id,epoch:room.match.epoch},before=room.match.snapshot();
 assert(!room.apply('stranger','bad1',cmd).ok);assert(!room.apply(room.players[r.actor],'bad2',cmd).ok);assert.deepEqual(room.match.snapshot(),before);
 const result=room.apply(room.players[actor],'giveup',cmd);assert(result.ok,result.error);assert.equal(room.match._m.winner,r.actor);assert.deepEqual(room.apply(room.players[actor],'giveup',cmd),result);assert.equal(room.aiCommand(),null);
 const restored=new RoomAuthority({players:room.players,checkpoint:room.checkpoint(),log:room.log});assert.equal(restored.match._m.winner,r.actor);for(const [uid,raw]of Object.entries(restored.views(2,3))){const v=JSON.parse(raw);assert.equal(v.epoch,restored.match.epoch);assert.equal(v.view.match.phase,'finished');assert(!Array.isArray(v.view.players[1-v.actor].hand));}
}
console.log('surrender: either seat/turn, stale/forged commands, terminal/no Undo, late answers, card/RNG preservation, restore/journal, rotated result and authority takeover passed');
