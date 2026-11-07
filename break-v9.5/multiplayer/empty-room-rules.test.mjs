import fs from 'node:fs';
import assert from 'node:assert/strict';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {ref,set,get,update,remove} from 'firebase/database';
const env=await initializeTestEnvironment({projectId:'demo-break-multi',database:{host:'127.0.0.1',port:9000,rules:fs.readFileSync(new URL('../database.rules.json',import.meta.url),'utf8')}});
const host=env.authenticatedContext('host').database(),guest=env.authenticatedContext('guest').database(),stranger=env.authenticatedContext('stranger').database();
let count=0;
const yes=async p=>{await assertSucceeds(p);count++;},no=async p=>{await assertFails(p);count++;};
async function seed(id,{presence={},votes={},status='running',p1='guest'}={}){
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.database();
  await set(ref(db,'rooms/'+id),{meta:{id,title:'empty room',p0:'host',p1,status,mode:'strict',createdAt:1,rematch:votes},authority:{uid:'host',connection:'h1',term:1},presence,bundle:{matchId:'current',checkpointJSON:'retained'}});
  await set(ref(db,'lobby/'+id),{room:id,title:'empty room',owner:'host',p0:'host',p1,status,mode:'strict',createdAt:1});
 });
}
const close=(db,id)=>update(ref(db,'rooms/'+id+'/meta'),{status:'closed',emptyClosed:true});
try{
 const present={host:{h1:{name:'host',at:1}},guest:{g1:{name:'guest',at:1}}};
 await seed('EMPTY001',{presence:present});
 await no(close(guest,'EMPTY001'));await no(close(host,'EMPTY001'));
 await no(set(ref(guest,'rooms/EMPTY001/meta/status'),'closed'));
 await yes(remove(ref(host,'rooms/EMPTY001/presence/host/h1')));
 await no(close(guest,'EMPTY001'));
 await yes(remove(ref(guest,'rooms/EMPTY001/presence/guest/g1')));
 await no(close(stranger,'EMPTY001'));
 await yes(close(guest,'EMPTY001'));await yes(remove(ref(guest,'lobby/EMPTY001')));
 assert.equal((await get(ref(host,'rooms/EMPTY001/meta/status'))).val(),'closed');
 await no(set(ref(host,'rooms/EMPTY001/meta/status'),'running'));
 await no(set(ref(guest,'rooms/EMPTY001/presence/guest/new'),{name:'guest',at:1}));
 await env.withSecurityRulesDisabled(async ctx=>assert.equal((await get(ref(ctx.database(),'rooms/EMPTY001/bundle/checkpointJSON'))).val(),'retained'));
 for(const [i,votes] of [{host:'current'},{guest:'current'},{host:'current',guest:'current'}].entries()){
  const id='VOTES00'+i;await seed(id,{votes,status:'finished'});await no(close(host,id));await no(close(guest,id));
 }
 await seed('STALE001',{votes:{host:'old-match',guest:'old-match'},status:'finished'});
 await yes(close(guest,'STALE001'));
 await seed('AIROOM01',{p1:'AI'});await yes(close(host,'AIROOM01'));
 await seed('WAIT0001',{status:'waiting'});await yes(close(guest,'WAIT0001'));
 await seed('WAIT0002',{status:'waiting',p1:null});await yes(close(host,'WAIT0002'));
 await seed('MULTITAB',{presence:{guest:{g2:{name:'guest tab 2',at:1}}}});
 await no(close(host,'MULTITAB'));
 // A join wins the race before the close write: server rejects closure.
 await seed('JOINRACE');await yes(set(ref(guest,'rooms/JOINRACE/presence/guest/new'),{name:'guest',at:1}));await no(close(host,'JOINRACE'));
 console.log('Empty-room rules: '+count+' checks passed (both seats, rematch, stale votes, AI, tabs, race, terminal close, retained checkpoint)');
}finally{await env.clearDatabase();await env.cleanup();}
