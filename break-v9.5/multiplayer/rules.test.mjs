import fs from 'node:fs';
import assert from 'node:assert/strict';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {ref,set,get,update,remove,runTransaction} from 'firebase/database';
const env=await initializeTestEnvironment({projectId:'demo-break-multi',database:{host:'127.0.0.1',port:9000,rules:fs.readFileSync(new URL('../database.rules.json',import.meta.url),'utf8')}});
let count=0;const ok=async p=>{await assertSucceeds(p);count++;},no=async p=>{await assertFails(p);count++;};
try{
 await env.clearDatabase();const a=env.authenticatedContext('host').database(),b=env.authenticatedContext('guest').database(),x=env.authenticatedContext('stranger').database(),u=env.unauthenticatedContext().database(),room='ROOM0001';
 const at=Date.now(),meta={id:room,title:'test',p0:'host',status:'waiting',mode:'strict',createdAt:at};
 await no(get(ref(u,'lobby')));await no(set(ref(u,'presence/host/c1'),{name:'fake',at}));
 await ok(set(ref(a,'presence/host/c1'),{name:'host',at}));await no(set(ref(x,'presence/host/c2'),{name:'fake',at}));
 await ok(set(ref(a,'rooms/'+room),{meta,authority:{uid:'host',connection:'c1',term:1},settings:{host:{deckJSON:'[]',ready:true}}}));
 await ok(set(ref(a,'rooms/'+room+'/presence/host/c1'),{name:'host',at}));
 await no(get(ref(b,'rooms/'+room)));await ok(get(ref(b,'rooms/'+room+'/meta')));await no(get(ref(x,'rooms/'+room+'/authority')));
 await ok(set(ref(b,'rooms/'+room+'/meta/p1'),'guest'));await no(set(ref(x,'rooms/'+room+'/meta/p1'),'stranger'));
 await ok(set(ref(b,'rooms/'+room+'/presence/guest/c2'),{name:'guest',at}));await ok(set(ref(b,'rooms/'+room+'/settings/guest'),{deckJSON:'[]',ready:true}));await no(get(ref(b,'rooms/'+room+'/settings/host')));await no(set(ref(b,'rooms/'+room+'/settings/host'),{deckJSON:'hack',ready:true}));
 const bundle={term:1,revision:0,writer:'c1',checkpointJSON:'{"private":"snapshot"}',logJSON:'{}',views:{host:'{"hand":["host-private"]}',guest:'{"hand":["guest-private"]}'},updatedAt:at};await ok(set(ref(a,'rooms/'+room+'/bundle'),bundle));
 await ok(get(ref(b,'rooms/'+room+'/bundle/views/guest')));await no(get(ref(b,'rooms/'+room+'/bundle/views/host')));await no(get(ref(b,'rooms/'+room+'/bundle')));await no(get(ref(b,'rooms/'+room+'/bundle/checkpointJSON')));await no(get(ref(b,'rooms/'+room+'/bundle/logJSON')));await no(get(ref(x,'rooms/'+room+'/bundle/views/guest')));await no(set(ref(b,'rooms/'+room+'/bundle/views/guest'),'forged'));
 await ok(set(ref(a,'rooms/'+room+'/meta/status'),'running'));const cmd={term:1,body:'{"kind":"answer"}',createdAt:at};await ok(set(ref(b,'rooms/'+room+'/commands/guest/cmd1'),cmd));await no(set(ref(b,'rooms/'+room+'/commands/host/forged'),cmd));await no(set(ref(b,'rooms/'+room+'/commands/guest/cmd1'),cmd));await no(get(ref(b,'rooms/'+room+'/commands/host')));await ok(get(ref(a,'rooms/'+room+'/commands')));
 await no(set(ref(b,'rooms/'+room+'/authority'),{uid:'guest',connection:'c2',term:2}));await ok(remove(ref(a,'rooms/'+room+'/presence/host/c1')));await no(set(ref(x,'rooms/'+room+'/authority'),{uid:'stranger',connection:'c3',term:2}));await ok(set(ref(b,'rooms/'+room+'/authority'),{uid:'guest',connection:'c2',term:2}));
 await ok(get(ref(b,'rooms/'+room+'/bundle')));await no(get(ref(a,'rooms/'+room+'/bundle/checkpointJSON')));await no(set(ref(a,'rooms/'+room+'/bundle'),{...bundle,revision:1}));await ok(set(ref(b,'rooms/'+room+'/bundle'),{...bundle,term:2,revision:1,writer:'c2'}));await no(set(ref(b,'rooms/'+room+'/bundle'),{...bundle,term:2,revision:1,writer:'c2'}));await no(set(ref(a,'rooms/'+room+'/commands/host/stale'),cmd));
 await no(get(ref(u,'rooms/'+room+'/bundle/views/guest')));await no(update(ref(b,'rooms/'+room+'/bundle'),{leak:'forbidden extra field'}));
 await ok(set(ref(b,'rooms/'+room+'/meta/status'),'closed'));await no(set(ref(b,'rooms/'+room+'/commands/guest/closed'),{...cmd,term:2}));await ok(remove(ref(a,'rooms/'+room)));
 await ok(set(ref(a,'rooms/ROOM0002'),{meta:{...meta,id:'ROOM0002',p1:'AI'},authority:{uid:'host',connection:'c1',term:1},settings:{host:{deckJSON:'[]',ready:true},AI:{deckJSON:'[]',ready:true}}}));await ok(set(ref(a,'rooms/ROOM0002/meta/status'),'closed'));await ok(remove(ref(a,'rooms/ROOM0002')));
 console.log('Firebase rules: '+count+' authorization/privacy/immutability/takeover checks passed');
}finally{await env.clearDatabase();await env.cleanup();}
