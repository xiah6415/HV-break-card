import fs from 'node:fs';import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';import {ref,get,set,update,serverTimestamp} from 'firebase/database';
const env=await initializeTestEnvironment({projectId:'demo-break-multi',database:{host:'127.0.0.1',port:9000,rules:fs.readFileSync(new URL('../database.rules.json',import.meta.url),'utf8')}});let checks=0;const ok=p=>{checks++;return assertSucceeds(p)},no=p=>{checks++;return assertFails(p)};
const uid='agreement-owner',other=env.authenticatedContext('agreement-other',{firebase:{sign_in_provider:'google.com'}}).database(),own=env.authenticatedContext(uid,{firebase:{sign_in_provider:'google.com'}}).database(),anon=env.authenticatedContext('agreement-anon',{firebase:{sign_in_provider:'anonymous'}}).database(),guest=env.unauthenticatedContext().database(),stamp=serverTimestamp(),consent={version:1,usage:true,research:true,researchEnabled:true,acceptedAt:stamp,updatedAt:stamp},id='ab'.repeat(16),pub={id,recordId:'solo:test',createdAt:stamp},writer={uid,slot:'s00',recordId:'solo:test'},payload=JSON.stringify({format:'break.public-replay',padding:'x'.repeat(120)}),index={version:1,createdAt:stamp,rallies:3,winner:0,steps:10,mode:'strict',bytes:200,origin:'solo-ai-research',aiLevel:'hard',aiVersion:'retention-v1'};
try{
 await no(set(ref(own,'researchPublications/'+uid+'/s00'),pub));
 for(const db of [other,anon,guest]){await no(set(ref(db,'playerAgreements/'+uid),consent));await no(get(ref(db,'playerAgreements/'+uid)));}
 await no(set(ref(anon,'playerAgreements/agreement-anon'),consent));
 for(const patch of [{usage:false},{research:false},{version:2},{acceptedAt:1},{extra:true}])await no(set(ref(own,'playerAgreements/'+uid),{...consent,...patch}));
 await ok(set(ref(own,'playerAgreements/'+uid),consent));await ok(get(ref(own,'playerAgreements/'+uid)));
 await no(set(ref(own,'researchPublications/'+uid+'/s00'),pub));
 await env.withSecurityRulesDisabled(c=>set(ref(c.database(),'personalMatchIndex/'+uid+'/s00'),{recordId:'solo:test'}));
 await no(set(ref(own,'researchPublications/'+uid+'/s30'),pub));await no(set(ref(own,'researchPublications/'+uid+'/s00'),{...pub,recordId:'solo:wrong'}));
 await ok(set(ref(own,'researchPublications/'+uid+'/s00'),pub));await no(set(ref(own,'researchWriters/'+id),{...writer,uid:'agreement-other'}));await ok(set(ref(own,'researchWriters/'+id),writer));
 for(const db of [other,anon,guest]){await no(get(ref(db,'researchPublications/'+uid)));await no(get(ref(db,'researchWriters/'+id)));await no(set(ref(db,'publicReplays/'+id),payload));}
 await no(set(ref(own,'publicReplays/'+id),JSON.stringify({uid:'private',pad:'x'.repeat(120)})));await ok(set(ref(own,'publicReplays/'+id),payload));await ok(set(ref(own,'publicReplayIndex/'+id),index));await ok(get(ref(guest,'publicReplays/'+id)));await no(set(ref(other,'publicReplays/'+id),null));
 await ok(update(ref(own,'playerAgreements/'+uid),{researchEnabled:false,updatedAt:stamp}));
 await no(set(ref(own,'publicReplayIndex/'+id),{...index,aiLevel:'easy'}));await no(set(ref(own,'researchPublications/'+uid+'/s01'),pub));
 await ok(update(ref(own),{['publicReplays/'+id]:null,['publicReplayIndex/'+id]:null}));await ok(set(ref(own,'researchWriters/'+id),null));await ok(set(ref(own,'researchPublications/'+uid+'/s00'),null));
 console.log('Agreement/research rules:',checks,'checks passed: consent, Google owner isolation, source slots, sanitization guard, public reads and withdrawal after opt-out');
}finally{await env.withSecurityRulesDisabled(async c=>{const db=c.database();for(const path of ['playerAgreements/'+uid,'personalMatchIndex/'+uid,'researchPublications/'+uid,'researchWriters/'+id,'publicReplays/'+id,'publicReplayIndex/'+id])await set(ref(db,path),null)});await env.cleanup();}
