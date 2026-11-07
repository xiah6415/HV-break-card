import fs from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {ref,set,get,update,remove} from 'firebase/database';
const env=await initializeTestEnvironment({projectId:'demo-break-multi',database:{host:'127.0.0.1',port:9000,rules:fs.readFileSync(new URL('../database.rules.json',import.meta.url),'utf8')}});
const google={firebase:{sign_in_provider:'google.com'},email_verified:true};
const moderator=env.authenticatedContext('moderator',google).database(),ordinary=env.authenticatedContext('ordinary',google).database(),unverified=env.authenticatedContext('unverified',{...google,email_verified:false}).database(),anonymous=env.authenticatedContext('anon',{firebase:{sign_in_provider:'anonymous'},email_verified:true}).database();
let checks=0;const yes=async p=>{await assertSucceeds(p);checks++;},no=async p=>{await assertFails(p);checks++;};
async function seed(id,{presence={},spectators={},votes={}}={}){
 await env.withSecurityRulesDisabled(async c=>{
  const db=c.database();
  await set(ref(db,'rooms/'+id),{meta:{id,title:'moderator fixture',p0:'host',p1:'guest',status:'finished',mode:'strict',createdAt:1,rematch:votes},authority:{uid:'host',connection:'h1',term:1},presence,spectators,bundle:{matchId:'current',checkpointJSON:'PRIVATE',logJSON:'PRIVATE',views:{host:'PRIVATE',guest:'PRIVATE'}}});
  await set(ref(db,'lobby/'+id),{room:id,title:'moderator fixture',owner:'host',status:'finished',mode:'strict',createdAt:1});
 });
}
const close=(db,id)=>update(ref(db,'rooms/'+id+'/meta'),{status:'closed',emptyClosed:true});
try{
 await env.withSecurityRulesDisabled(async c=>{for(const uid of ['moderator','unverified','anon'])await set(ref(c.database(),'roomModerators/'+uid),true);});
 await seed('MODROOM1');
 await yes(get(ref(moderator,'roomModerators/moderator')));
 await no(get(ref(ordinary,'roomModerators/moderator')));await no(get(ref(moderator,'roomModerators')));
 await no(set(ref(moderator,'roomModerators/moderator'),true));await no(set(ref(ordinary,'roomModerators/ordinary'),true));
 for(const db of [ordinary,unverified,anonymous]){
  await no(get(ref(db,'rooms/MODROOM1/presence')));
  await no(close(db,'MODROOM1'));
 }
 for(const p of ['meta','presence','spectators','bundle/matchId'])await yes(get(ref(moderator,'rooms/MODROOM1/'+p)));
 for(const p of ['','bundle','bundle/checkpointJSON','bundle/logJSON','bundle/views/host','bundle/views/guest','settings','commands','authority'])await no(get(ref(moderator,'rooms/MODROOM1'+(p?'/'+p:''))));
 for(const p of ['personalDecks/host','personalMatches/host','playerAgreements/host'])await no(get(ref(moderator,p)));
 await no(remove(ref(moderator,'rooms/MODROOM1')));
 await no(remove(ref(moderator,'lobby/MODROOM1')));
 await no(set(ref(moderator,'rooms/MODROOM1/meta/status'),'closed'));
 await yes(close(moderator,'MODROOM1'));await yes(remove(ref(moderator,'lobby/MODROOM1')));
 await no(set(ref(moderator,'rooms/MODROOM1/meta/status'),'running'));
 await no(set(ref(moderator,'rooms/MODROOM1/bundle/checkpointJSON'),'FORGED'));
 await no(set(ref(moderator,'rooms/MODROOM1/commands/moderator/x'),{body:'{}',term:1,createdAt:1}));
 for(const [id,options]of [
  ['MODLIVE1',{presence:{host:{h1:{name:'host',at:1}}}}],
  ['MODLIVE2',{presence:{guest:{g1:{name:'guest',at:1}}}}],
  ['MODVIEW1',{spectators:{viewer:{s1:{name:'viewer',at:1,accepted:true}}}}],
  ['MODVOTE1',{votes:{host:'current'}}],
  ['MODVOTE2',{votes:{guest:'current'}}]
 ]){await seed(id,options);await no(close(moderator,id));}
 await seed('MODSTALE',{votes:{host:'old'}});await yes(close(moderator,'MODSTALE'));
 await seed('MODREVOK');
 await env.withSecurityRulesDisabled(c=>remove(ref(c.database(),'roomModerators/moderator')));
 await no(get(ref(moderator,'rooms/MODREVOK/presence')));await no(close(moderator,'MODREVOK'));
 console.log('Room moderator rules: '+checks+' checks passed (verified Google allowlist, no self-grant, live players/viewers/rematch protected, no private data or game writes, revocation)');
}finally{await env.clearDatabase();await env.cleanup();}
