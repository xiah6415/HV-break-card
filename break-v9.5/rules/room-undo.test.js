'use strict';
const A=require('node:assert/strict'),{RoomAuthority}=require('./room-authority'),H=require('../host-choice');
const deck=Array(40).fill('D01-009');let seq=0;
function setup(ai=false){const room=new RoomAuthority({id:'undo-test',players:['u0',ai?'AI':'u1'],decks:[deck,deck],seed:54});for(let i=0;i<18;i++){const r=room.match.request(0)||room.match.request(1);A(room.apply(room.players[r.actor],'play'+(++seq),{kind:'answer',answer:H.aiAnswer(r)}).ok);}return room;}
function cmd(room,actor,kind,extra={}){return {kind,actor,matchId:room.match._m.id,epoch:room.match.epoch,decisionIndex:room.match._m.decisionIndex,...extra};}
function send(room,actor,kind,extra={}){return room.apply(room.players[actor],'undo'+(++seq),cmd(room,actor,kind,extra));}
for(const actor of [0,1]){
 let room=setup(),before=room.match.snapshot(),index=room._undoIndex(actor),expected=room._replayUntil(index).snapshot();
 A(send(room,actor,'undoRequest').ok);const u=room.undoPending;A(u);A.equal(room.aiCommand(),null);
 const r=room.match.request(0)||room.match.request(1);A.equal(room.apply(room.players[r.actor],'blocked'+(++seq),{kind:'answer',answer:H.aiAnswer(r)}).error,'UNDO_PENDING');
 A.equal(send(room,actor,'undoReply',{undoId:u.id,approve:true}).error,'WRONG_SEAT');
 A.equal(send(room,1-actor,'undoReply',{undoId:'old',approve:true}).error,'STALE_UNDO');
 A.deepEqual(room.match.snapshot(),before);
 for(const v of Object.values(room.views(1,1)).map(JSON.parse)){A.deepEqual(Object.keys(v.undo.pending).sort(),['byActor','expiresAt','id','target']);A(!('targetIndex' in v.undo.pending));A(!Array.isArray(v.view.players[1-v.actor].hand));}
 const restored=new RoomAuthority({players:room.players,checkpoint:room.checkpoint(),log:room.log});A.deepEqual(restored.undoPending,u);room=restored;
 const oldEpoch=room.match.epoch,cid='approve'+(++seq),command=cmd(room,1-actor,'undoReply',{undoId:u.id,approve:true}),receipt=room.apply(room.players[1-actor],cid,command);A(receipt.ok,receipt.error);A.equal(room.undoPending,null);A(room.match.epoch>oldEpoch);
 const actual=room.match.snapshot();A.equal(actual.match.decisionIndex,index);A.deepEqual(actual.rng,expected.rng);A.deepEqual(actual.cards,expected.cards);A.deepEqual(actual.players,expected.players);A.deepEqual(actual.match.history,expected.match.history);A.deepEqual(actual.publicLog,expected.publicLog);
 A.deepEqual(room.apply(room.players[1-actor],cid,command),receipt,'approval is exactly once');A.deepEqual(room.match.snapshot(),actual);
 A(!room.apply(room.players[r.actor],'stale'+(++seq),{kind:'answer',answer:H.aiAnswer(r)}).ok,'old answer invalid after epoch changes');
}
for(const action of ['reject','cancel']){const room=setup(),before=room.match.snapshot();A(send(room,0,'undoRequest').ok);const id=room.undoPending.id;A(action==='reject'?send(room,1,'undoReply',{undoId:id,approve:false}).ok:send(room,0,'undoCancel',{undoId:id}).ok);A.equal(room.undoPending,null);A.deepEqual(room.match.snapshot(),before);}
{const room=setup(true),n=room.match._m.decisionIndex;A(send(room,0,'undoRequest').ok);A.equal(room.undoPending,null);A(room.match._m.decisionIndex<n,'AI accepts at authority');}
{const room=setup(),before=room.match.snapshot();A(send(room,0,'undoRequest').ok);A(!room.expireUndo(room.undoPending.expiresAt-1));A(room.expireUndo(room.undoPending.expiresAt));A.equal(room.undoPending,null);A.deepEqual(room.match.snapshot(),before);}
console.log('Multiplayer Undo: both seats, private target, pause, consent/reject/cancel, takeover, replay/RNG, stale/duplicate commands, AI passed');
