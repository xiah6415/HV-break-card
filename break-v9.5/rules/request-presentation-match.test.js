'use strict';
const assert=require('node:assert/strict'),{LocalSession}=require('./local-session'),H=require('../host-choice');
const fixtures=[];
const deck=['P01-028','P01-025',...Array(38).fill('D01-009')];
for(const oldFirst of [false,true]){
 const s=new LocalSession({id:'trigger-labels',seed:7,decks:[deck,deck],mode:'numeric'}),m=s.match,k=m._kernel;
 Object.assign(m._m,{pending:null,continuation:null,phase:'rally',actor:0,turnNo:1,pc:'attack'});k.state.turn={id:1,player:0,phase:'attack',step:'free'};k.state.ball={kind:'attack',offense:0,owner:1};
 const find=code=>Object.values(k.state.cards).find(c=>c.owner===0&&c.cardNo==='HV-'+code).id,move=(id,z)=>k._atomic(()=>k._move(id,0,z,k._context(id,0)));
 move(find('D01-009'),'attack');const covered=find('P01-028'),entrant=find('P01-025');move(covered,'attack');move(entrant,'hand');
 for(const c of Object.values(k.state.cards).filter(c=>c.owner===0&&c.cardNo==='HV-D01-009'&&c.zone==='0.deck').slice(0,3))move(c.id,'hand');
 m._pump();let r=m.request(0);s.command({kind:'answer',answer:H.makeAnswer(r,entrant)});r=m.request(0);assert.equal(r.kind,'trigger_order');assert.match(r.prompt,/下一個先結算/);assert.equal(r.options.length,2);fixtures.push(structuredClone(r));assert(r.options.every(o=>o.card&&o.label.includes(o.card.cardNo.replace(/^HV-?/,''))&&!/^q\d+$/.test(o.label)));
 assert(r.options.find(o=>o.card.id===covered).label.includes('被覆蓋'));assert(r.options.find(o=>o.card.id===entrant).label.includes('登場'));
 const before=m.snapshot(),old=H.makeAnswer(r,r.options[0].value);m.restore(before);assert.throws(()=>m.dispatch(old),/STALE/);r=m.request(0);s.command({kind:'answer',answer:H.makeAnswer(r,r.options.find(o=>o.card.id===(oldFirst?covered:entrant)).value)});
 for(let i=0;(m.request(0)||m.request(1))?.origin==='kernel'&&i<30;i++){r=m.request(0)||m.request(1);s.command({kind:'answer',answer:H.aiAnswer(r)});}
 assert.equal(m.request(0).kind,'event');k.assertState();assert(s.undo());assert(m.request(0));
}
console.log('Native trigger ordering: real covered/entry sources and labels, both orders, stale refusal and local Undo passed');
// A real look/remainder Event exposes top/bottom and ordered placement using
// the existing host inputs; a no-match view is still a legal effect.
for(const destination of ['deck_top','deck_bottom']){
 const cards=['P03-078',...Array(39).fill('D01-009')],s=new LocalSession({id:'order-labels',seed:7,decks:[cards,cards],mode:'numeric'}),m=s.match,k=m._kernel;
 Object.assign(m._m,{pending:null,continuation:null,phase:'rally',actor:0,turnNo:1,pc:'drawEvent'});k.state.turn={id:1,player:0,phase:'draw',step:'free'};k.state.ball={kind:'serve',offense:1,owner:1};const id=Object.values(k.state.cards).find(c=>c.owner===0&&c.cardNo==='HV-P03-078').id;k._atomic(()=>k._move(id,0,'hand',k._context(id,0)));m._pump();
 const answer=value=>{const r=m.request(0);s.command({kind:'answer',answer:value===undefined?H.aiAnswer(r):H.makeAnswer(r,value)});};answer(id);assert.equal(m.request(0).kind,'reveal');answer(true);assert.equal(m.request(0).kind,'revealResult');assert.equal(m.request(0).options.length,3);answer([]);if(m.request(0).kind==='move_count')answer(0);
 let r=m.request(0);assert.equal(r.kind,'mode');fixtures.push(structuredClone(r));assert.deepEqual(r.options.map(o=>o.label),['放回牌庫頂','放回牌庫底']);answer(destination);r=m.request(0);assert.equal(r.kind,'move_cards');assert(r.input.ordered);fixtures.push(structuredClone(r));assert.match(r.prompt,destination==='deck_top'?/牌庫頂/:/牌庫底/);assert.match(r.prompt,/先選的先抽到/);const order=r.options.map(o=>o.value).reverse(),rng=m.snapshot().rng;
 for(const value of order)answer([value]);const actual=destination==='deck_top'?k.zone(0,'deck').slice(-3).reverse():k.zone(0,'deck').slice(0,3).reverse();assert.deepEqual(actual,order);assert.deepEqual(m.snapshot().rng,rng);k.assertState();
}
console.log('Native remainder: visible no-match result, translated top/bottom, ordered choices and both actual deck orders passed');

module.exports={fixtures};
