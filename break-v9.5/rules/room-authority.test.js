'use strict';
const assert=require('node:assert/strict'),{RoomAuthority}=require('./room-authority'),H=require('../host-choice');
const deck=['P03-046','D01-005','P02-003',...Array(2).fill('D01-012'),...Array(12).fill('D01-009'),...Array(12).fill('D01-001'),...Array(11).fill('D01-003')];
assert.equal(deck.length,40);
for(const ai of [false,true]){
 let room=new RoomAuthority({id:'room-test',decks:[deck,deck],players:['host',ai?'AI':'guest'],seed:7});let recovered=false,duplicate=false,checked=0;
 for(let i=0;i<2000;i++){
  const m=room.match,r=m.request(0)||m.request(1);if(!r)break;
  if(i===8){const cp=room.checkpoint(),rng=cp.snapshot.rng,old=m.epoch;room=new RoomAuthority({players:room.players,checkpoint:cp,log:room.log});assert.equal(room.match.epoch,old+1);assert.deepEqual(room.match.snapshot().rng,rng);recovered=true;continue;}
  const next=room.match.request(0)||room.match.request(1),uid=room.players[next.actor],command=uid==='AI'?room.aiCommand():{kind:'answer',answer:H.aiAnswer(next)},before=room.match.snapshot();
  const invalid=room.apply('stranger','bad-'+i,command);assert(!invalid.ok);assert.deepEqual(room.match.snapshot(),before,'wrong identity cannot mutate the match');
  const cid='cmd-'+i,result=room.apply(uid,cid,command);assert(result.ok,result.error);if(!duplicate){const after=room.match.snapshot();assert.deepEqual(room.apply(uid,cid,command),result);assert.deepEqual(room.match.snapshot(),after);duplicate=true;}
  const views=room.views(3,i);for(const [seat,who]of room.players.entries())if(who!=='AI'){const view=JSON.parse(views[who]);assert.equal(view.actor,seat);assert(!Array.isArray(view.view.players[1-seat].hand));assert.deepEqual(Object.keys(view.view.players[1-seat].deck),['count']);assert(!('snapshot' in view));assert(!view.view.request||view.view.request.actor===seat);checked++;}
 }
 assert.equal(room.match._m.phase,'finished');assert(recovered&&duplicate&&checked>20);console.log('Room authority '+(ai?'AI seat':'two players')+': complete match, identity isolation, private views, exactly-once commands, checkpoint takeover/RNG passed');
}
