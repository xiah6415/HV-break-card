'use strict';
const assert=require('node:assert/strict'),{TableSession,boardView}=require('./table-session'),H=require('../host-choice'),{Match}=require('./match');
const deck=Array(40).fill('D01-009'),options={id:'table-test',seed:7,decks:[deck,deck],deckKeys:['test','test'],mode:'numeric',delay:0,wantsAck:[true,false]};
const tick=()=>new Promise(resolve=>setTimeout(resolve,1));
(async()=>{
 let notices=[],latest=null,errors=[],boards=0;
 const t=new TableSession(options,{onBoard(){boards++;},onNotice(board,data,done){notices.push({board,data,done});},onRequest(r){latest=r;},onError(e){errors.push(e);}});t.start();
 for(let i=0;i<100;i++){
  if(notices.length)notices.shift().done();
  const r=t.waiting;if(r?.canManual)break;if(r)t.submit({kind:'answer',answer:r.kind==='firstService'?H.makeAnswer(r,r.actor===0?'serve':'receive'):H.aiAnswer(r)});else await tick();
 }
 assert(t.waiting?.canManual);const before=t.match.snapshot(),view=t.match.view(0),board=t.board();assert.deepEqual(board.players[1].hand,{length:view.players[1].hand.count});assert(!Object.hasOwn(board.players[1],'deckOrder'));assert(!Array.isArray(board.players[0].deck));
 // The presentation is disposable. Editing it cannot affect a physical card.
 board.players[0].hand.splice(0);board.players[0].area.serve.push('P01-001');assert.deepEqual(t.match.snapshot(),before);
 const r=t.waiting;t.submit({kind:'manual',matchId:r.matchId,requestId:r.requestId,epoch:r.epoch,actor:0,action:{kind:'draw'}});assert.equal(t.board().players[0].hand.length,view.players[0].hand.length+1);assert(t.undo());assert.equal(t.board().players[0].hand.length,view.players[0].hand.length);assert.deepEqual(t.match.snapshot().rng,before.rng);assert.throws(()=>t.submit({kind:'answer',answer:H.aiAnswer(r)}),/STALE/);
 // Notices and delayed AI callbacks are invalidated when a session stops.
 let staleNotice=0;for(let i=0;i<200&&!notices.length;i++){const r=t.waiting;if(r)t.submit({kind:'answer',answer:H.aiAnswer(r)});else await tick();}
 if(notices.length){const old=t.match.snapshot();t.stop();notices[0].done();await tick();assert.deepEqual(t.match.snapshot(),old);staleNotice++;}
 assert(staleNotice);assert.equal(errors.length,0);assert(boards>0);
 const other=new TableSession({...options,seed:1},{onBoard(){},onRequest(){},onNotice(b,d,done){done();},onError(e){throw e;}});other.start();
 if(!other.waiting){const old=other.match.snapshot();other.stop();await tick();assert.deepEqual(other.match.snapshot(),old);}else other.stop();
 // Core availability mirrors the established invalid-hand fix: only Events
 // remain playable while invalidated. No controller loop or payment follows.
 const m=new Match(options),k=m._kernel;k.state.match.pending=null;k.state.match.continuation=null;k.state.match.phase='rally';k.state.turn={id:1,player:0,phase:'receive',step:'free'};
 const id=k.addCard('HV-P02-011',0,'hand'),source=k.addCard('HV-D01-009',1,'attack');
 k._run({kind:'invalidate_skill',actor:'opponent',selector:{phase_tags:['receive'],source_zones:['hand']},duration:'this_turn'},k._context(source,1));
 assert(!m._playable(0).includes(id),'invalidated hand character cannot be offered');
 // Outgoing details are captured before turn-limited effects expire, so the
 // transition screen cannot report printed/base values beside a boosted ball.
 const mixed=['D01-009','D02-005','D04-006','D03-007'].flatMap(c=>Array(10).fill(c));const full=new Match({...options,decks:[mixed,mixed],wantsAck:[true,true]});let boosted=false,owner=null;
 for(let i=0;i<300;i++){const r=full.request(0)||full.request(1);if(r?.kind==='turnEnd'&&r.context.outgoing.kind==='attack'){owner=r.actor;const c=full.view(owner).players[owner].court.find(c=>c.role==='attack');full.command({kind:'manual',matchId:r.matchId,requestId:r.requestId,epoch:r.epoch,actor:owner,action:{kind:'adjust',player:owner,ref:{id:c.id,incarnation:c.incarnation},parameter:'attack',delta:1}});boosted=true;const next=full.request(owner);full.command({kind:'answer',answer:H.aiAnswer(next)});break;}full.command({kind:'answer',answer:H.aiAnswer(r)});}
 assert(boosted);const notice=full.view(0).match.notices.at(-1);assert.equal(notice.type,'turn');assert.equal(notice.toss+notice.attack,notice.ball.offense);assert.equal(notice.attack,full.view(0).players[owner].court.find(c=>c.role==='attack').parameters.attack+1);
 console.log('table session: view-only board/private counts, native manual/Undo/stale replies, cancelled notices/AI, invalid-hand refusal passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
