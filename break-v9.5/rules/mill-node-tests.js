'use strict';
const assert=require('node:assert/strict'),I=require('./node-inventory'),F=require('./frequent-node-tests');
function testMill(catalog){
 const forms=I.forms(catalog).mill;
 for(const {node:n}of forms.values())for(const payment of [false,true])for(const size of [0,1,n.count,n.count+1]){
  const k=F.game(catalog),source=k.addCard('HV-D01-009',0,'attack'),player=n.actor==='opponent'?1:0,ids=Array.from({length:size},()=>k.addCard('HV-D01-001',player,'deck')),ctx=k._context(source,0);ctx.inPayment=payment;k.preflight(n);
  const requests=[];k.choose=r=>{requests.push(r);assert.equal(r.kind,'mill_count');assert(r.options.every(Number.isInteger),'Choose count before any hidden card is revealed');return r.options.at(-1);};
  const before=k.snapshot(),invoke=()=>k._atomic(()=>k._run(n,ctx));
  if(payment&&n.count_mode==='exact'&&size<n.count){assert.throws(invoke);assert.deepEqual(k.snapshot(),before);continue;}
  const count=Math.min(n.count,size);assert.equal(invoke(),count>0);assert.deepEqual(ctx.bind.milled,ids.slice(size-count).reverse());assert.deepEqual(k.zone(player,'drop'),ctx.bind.milled);assert.equal(k.zone(player,'deck').length,size-count);assert(!k.state.events.slice(before.events.length).some(e=>e.type==='hand_added'),'Mill is not a hand addition');if(payment)assert.deepEqual(ctx.paid,ctx.bind.milled);
  const after=k.snapshot();k.restore(before);const replay=k._context(source,0);replay.inPayment=payment;k._atomic(()=>k._run(n,replay));assert.deepEqual(k.snapshot(),after,'Mill Undo '+JSON.stringify(n));
  if(n.count_mode==='upto'){k.restore(before);k.choose=()=>0;assert.equal(k._atomic(()=>k._run(n,k._context(source,0))),false);assert.deepEqual(k.zone(player,'deck'),ids);assert.deepEqual(k.zone(player,'drop'),[]);}
 }
 return forms.size;
}
module.exports={testMill};
if(require.main===module)console.log('mill: '+testMill(require('./data/cards.json'))+' forms; both actors, exact/upto, short cost vs short effect, zero, top order and Undo passed');
