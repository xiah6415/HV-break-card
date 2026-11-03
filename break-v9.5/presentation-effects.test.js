'use strict';
const assert=require('node:assert/strict'),{drawChanges}=require('./presentation-effects');
const view=(id,log,hand,opp={count:7})=>({match:{id},publicLog:log,players:[{hand},{hand:opp}]});
const a=view('m',[],[{id:'a',cardNo:'HV-D01-001'}]),b=view('m',[{type:'draw',player:0,count:1},{type:'draw',player:1,count:2}],[...a.players[0].hand,{id:'b',cardNo:'HV-D01-002'}]);
assert.deepEqual(drawChanges(a,b),[{player:0,count:1,cards:[{id:'b',cardNo:'HV-D01-002'}]},{player:1,count:2,cards:[]}]);
assert.deepEqual(drawChanges(null,b),[]);assert.deepEqual(drawChanges(b,b),[]);assert.deepEqual(drawChanges(b,a),[]);assert.deepEqual(drawChanges(a,{...b,match:{id:'new'}}),[]);
assert.deepEqual(drawChanges(a,{...b,publicLog:[{type:'deck_selected',player:0,count:1}]}),[]);
console.log('presentation draw detection: actual draw, own cards, opponent backs, no re-render/restore/retrieve false animation passed');
