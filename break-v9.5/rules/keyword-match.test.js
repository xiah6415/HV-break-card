'use strict';
const assert=require('node:assert/strict'),{Match}=require('./match'),F=require('./frequent-node-tests');
function setup(){const deck=[...Array(4).fill('P01-060'),...Array(4).fill('P03-091'),...Array(32).fill('D01-009')],m=new Match({seed:7,decks:[deck,deck]}),k=m._kernel;Object.assign(m._m,{pending:null,continuation:null,phase:'rally',actor:0,turnNo:1});k.state.turn={id:1,player:0,phase:'block',step:'free'};k.state.ball={kind:'attack',offense:8,owner:1};return {m,k};}
const envelope=(r,value)=>({matchId:r.matchId,requestId:r.requestId,epoch:r.epoch,actor:r.actor,value});
{
 const {m,k}=setup(),take=(code,z)=>{const id=k.zone(0,'deck').find(id=>k.card(id).cardNo==='HV-'+code);k._atomic(()=>k._move(id,0,z,k._context(id,0)));return id;};take('D01-009','block');take('D01-009','block');take('P03-091','hand');const source=take('P01-060','hand');k.choose=F.choose;k.enter(source,'block');assert.equal(k.state.turn.phase,'draw');m._m.pc='blockEvent';m._pump();let r=m.request(0);assert.equal(r.kind,'ack');m.dispatch(envelope(r,true));r=m.request(0);assert.equal(k.state.turn.step,'free');assert.equal(r.kind,'event');assert(r.options.some(o=>o.card?.cardNo==='HV-P03-091'),'Draw-phase Events remain usable after the required draw');
}
{
 const {m,k}=setup();k.state.turn.phase='end';k.state.turn.step='start';k.state.keywordOutgoing={player:0,kind:'attack',offense:3,turn:1};m._m.pc='tossEvent';m._pump();let r=m.request(0);assert.equal(r.kind,'turnEnd');assert.equal(r.context.outgoing.offense,3);const saved=m.snapshot();m.restore(saved);r=m.request(0);m.dispatch(envelope(r,true));assert.equal(k.state.ball.kind,'attack');assert.equal(k.state.ball.offense,3);assert.equal(k.state.turn.player,1);
}
console.log('keyword match: one-touch required draw/free Event window and two-attack end/handoff/restore passed');
