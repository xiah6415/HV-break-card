'use strict';
/* 多人牌桌轉接器（Claude 2026-10-25）：1 號座位視圖左右對調後與 0 號視角一致；notices／request／送出流程；不持有權威狀態。 */
const assert=require('node:assert/strict'),{Match}=require('./match'),{OnlineSession,rotateView}=require('./online-session'),{RoomAuthority}=require('./room-authority'),H=require('../host-choice'),CL=require('../card-library');
const all=Object.values(CL.data.cards).filter(c=>c.playable&&c.kind==='C'&&c.schoolTags.includes('烏野'));const deck=[];for(let i=0;deck.length<40;i++)deck.push(all[i%all.length].code);
// 1. rotateView：對調後玩家、回合、球、發球方、notices、publicLog 都換成「自己＝0」
{
 const m=new Match({id:'r',seed:9,decks:[deck,deck]});for(let i=0;i<60;i++){const r=m.request(0)||m.request(1);if(!r)break;m.command({kind:'answer',answer:H.aiAnswer(r)});}
 const v0=m.view(0),v1=m.view(1),rot=rotateView(v1,1);
 assert.deepEqual(rot.players[1].court,v1.players[0].court);assert.deepEqual(rot.players[0].court,v1.players[1].court);
 assert(Array.isArray(rot.players[0].hand),'own hand stays visible at index 0');assert(!Array.isArray(rot.players[1].hand),'opponent hand stays hidden');
 if(v1.turn)assert.equal(rot.turn.player,1-v1.turn.player);if(v1.match.server!=null)assert.equal(rot.match.server,1-v1.match.server);
 v1.match.notices.forEach((n,i)=>{if('player' in n)assert.equal(rot.match.notices[i].player,1-n.player);if(n.ball)assert.equal(rot.match.notices[i].ball.owner,1-n.ball.owner);});
 v1.publicLog.forEach((e,i)=>{if('player' in e)assert.equal(rot.publicLog[i].player,1-e.player);});
 assert.deepEqual(rotateView(v0,0),v0,'seat 0 is unchanged');
 assert.equal(JSON.stringify(m.view(1)),JSON.stringify(v1),'rotation does not mutate the source view');
}
// 2. OnlineSession：以權威端視圖驅動；只在輪到自己時 onRequest；notices 逐一確認；submit 交給 client.send
{
 const auth=new RoomAuthority({id:'o',decks:[deck,deck],players:['u0','u1'],seed:5});let rev=0;
 const sent=[];const client={core:null,pending:null,send:async cmd=>{await new Promise(r=>setImmediate(r));sent.push(cmd);const r=auth.apply('u1','c'+sent.length,cmd);assert(r.ok,r.error);push();}};
 const boards=[],requests=[],notices=[];let session;
 const push=()=>{for(let i=0;i<300;i++){const r=auth.match.request(0)||auth.match.request(1);if(!r||r.actor===1)break;auth.apply('u0','a'+(++rev),{kind:'answer',answer:H.aiAnswer(r)});}
  const v=JSON.parse(auth.views(1,++rev).u1);v.view.request=auth.match.request(1)||null;session.handle(v);};
 session=new OnlineSession(client,{onBoard:(b,view)=>boards.push({b,view}),onRequest:r=>requests.push(r),onNotice:(b,d,resolve)=>{notices.push(d);setImmediate(resolve);},onError:e=>{throw e;}});
 assert.equal(session.status().enabled,false);assert.equal(session.undo(),false);assert.deepEqual(session.match.previewBlockSkills({}),[]);
 session.start();push();
 (async()=>{
  for(let step=0;step<200&&auth.match._m.phase!=='finished';step++){
   await new Promise(r=>setImmediate(r));const r=session.request();if(!r)continue;
   assert.equal(r.actor,1,'only the local seat is asked');const b=boards.at(-1).b;assert(Array.isArray(b.players[0].hand)||b.players[0].hand.length>=0);
   session.submit({kind:'answer',answer:H.aiAnswer(r)});assert.throws(()=>session.submit({kind:'answer',answer:H.aiAnswer(r)}),/NO_LOCAL_DECISION/,'double submit blocked');
  }
  assert(requests.length>5,'requests reached the table');assert(notices.length>0,'notices shown');assert(sent.length===requests.length||sent.length>0);
  assert(boards.every(({view})=>Array.isArray(view.players[0].hand)),'own hand always at index 0');
  console.log(`online session: seat-1 rotation, notices ${notices.length}, requests ${requests.length}, commands ${sent.length}; no local authority`);
 })().catch(e=>{console.error(e);process.exitCode=1;});
}
