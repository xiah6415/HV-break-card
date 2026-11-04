'use strict';
const assert=require('node:assert/strict'),Sharing=require('./deck-sharing');
(async()=>{
 const data={},storage={getItem:k=>data[k]||null,setItem:(k,v)=>data[k]=v},deck={name:'test',cards:{'P01-001':40}},calls=[],cloud=new Map();
 const user=uid=>({uid,isAnonymous:false,providerData:[{providerId:'google.com'}]});
 const api={async publish(d,a,id){calls.push(['publish',id]);cloud.set(id,JSON.stringify(d))},async remove(id){calls.push(['remove',id]);cloud.delete(id)}};
 const s=new Sharing(storage,{deck:()=>deck});s.set('new',true);await s.sync();assert.equal(calls.length,0);assert.match(s.status('new'),/登入/);assert.equal(s.row('old').public,false);
 await s.bind(user('a'),api,true,'作者');await s.sync();assert.equal(calls.length,1);const id=s.row('new').remoteId;assert.match(s.status('new'),/已公開/);
 const r=new Sharing(storage,{deck:()=>deck});await r.bind(user('a'),api,true,'作者');await r.sync();assert.equal(calls.length,1,'reload no duplicate');
 deck.name='edit';await r.sync();assert.equal(calls.length,2);assert.equal(calls[1][1],id);assert.equal(cloud.size,1);
 r.bind(user('b'),api,true,'其他');await r.sync();assert.equal(calls.length,2,'other account cannot publish prior owner deck');
 await r.bind(user('a'),api,false,'作者');deck.name='offline';await r.sync();assert.equal(calls.length,2);await r.bind(user('a'),api,true,'作者');assert.equal(calls.length,3);
 r.set('new',false);await r.sync();assert.equal(cloud.size,0);assert.equal(r.row('new').remoteId,null);
 let fail=true;const flaky={...api,async publish(...args){if(fail)throw Error('offline');return api.publish(...args)}};await r.bind(user('a'),flaky,true,'作者');r.set('new',true);await r.sync();assert.equal(r.error,'offline');const retryId=r.row('new').remoteId;fail=false;await r.sync();assert.equal(r.row('new').remoteId,retryId);assert.equal(cloud.size,1);
 // Switching private while an upload is in flight must remove the eventual copy.
 let release,started;const begun=new Promise(resolve=>started=resolve),wait=new Promise(resolve=>release=resolve),slow={...api,async publish(...args){started();await wait;return api.publish(...args)}};
 await r.bind(user('a'),slow,true,'作者');deck.name='inflight';const pending=r.sync();await begun;r.set('new',false);release();await pending;await r.sync();assert.equal(cloud.size,0);assert.equal(r.row('new').public,false);
 console.log('deck sharing: guest pending, old private, stable ID, reload, update, accounts, offline, private, retry and in-flight privacy passed');
})().catch(e=>{console.error(e);process.exitCode=1});
