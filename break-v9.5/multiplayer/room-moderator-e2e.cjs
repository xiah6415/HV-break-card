'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),T=require('../browser-test-helpers.cjs');
const {initializeTestEnvironment}=require('@firebase/rules-unit-testing'),{ref,set,get,remove}=require('firebase/database');
(async()=>{const env=await initializeTestEnvironment({projectId:'demo-break-multi',database:{host:'127.0.0.1',port:9000,rules:fs.readFileSync(require('node:path').join(__dirname,'../database.rules.json'),'utf8')}}),b=await T.browser(),errors=[];
async function seed(id,options={}){
 await env.withSecurityRulesDisabled(async c=>{const db=c.database();
  const room={meta:{id,title:'管理測試 '+id,p0:'host',p1:'guest',status:'finished',mode:'strict',createdAt:Date.now(),...(options.votes?{rematch:options.votes}:{})},authority:{uid:'host',connection:'h1',term:1},bundle:{matchId:'current',checkpointJSON:'PRIVATE'},...(options.presence?{presence:options.presence}:{}),...(options.spectators?{spectators:options.spectators}:{})};
  await set(ref(db,'rooms/'+id),room);await set(ref(db,'lobby/'+id),{room:id,title:room.meta.title,owner:'host',p0:'host',p1:'guest',status:'finished',mode:'strict',createdAt:room.meta.createdAt});
 });
}
try{
 const p=await b.newPage({viewport:{width:390,height:844}});p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:8123/?emulator=1&online=1');await p.waitForFunction(()=>!document.getElementById('olGoogle').disabled);
 const next=p.waitForEvent('popup');await p.click('#olGoogle');const w=await next;await w.waitForLoadState('domcontentloaded');await w.getByRole('button',{name:/Add new account/}).click();await w.locator('#autogen-button').click();await w.fill('#email-input','room-mod-'+Date.now()+'@example.test');await w.fill('#display-name-input','Room Moderator');await w.click('#sign-in');await require('../test-decks.cjs').acceptAgreement(p);await p.waitForFunction(()=>BREAK_ONLINE.client?.user?.providerData?.some(x=>x.providerId==='google.com'));
 const uid=await p.evaluate(()=>BREAK_ONLINE.client.user.uid);A.equal(await p.evaluate(()=>BREAK_ONLINE.client.canManageEmptyRooms),false);
 await env.withSecurityRulesDisabled(c=>set(ref(c.database(),'roomModerators/'+uid),true));await p.waitForFunction(()=>BREAK_ONLINE.client.canManageEmptyRooms);
 await seed('MODEMPTY');await p.locator('[data-ol-close-empty="MODEMPTY"]').waitFor();
 for(const [width,height]of [[1440,1000],[390,844],[320,568]]){await p.setViewportSize({width,height});A(await p.isVisible('#olManagerHint'));A(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await p.click('[data-ol-close-empty="MODEMPTY"]');A(await p.isVisible('#confirmEmptyRoomClose'));await env.withSecurityRulesDisabled(async c=>A.equal((await get(ref(c.database(),'rooms/MODEMPTY/meta/status'))).val(),'finished'));
 await p.click('#confirmEmptyRoomClose');await p.locator('[data-ol-close-empty="MODEMPTY"]').waitFor({state:'detached'});
 await env.withSecurityRulesDisabled(async c=>{A.equal((await get(ref(c.database(),'rooms/MODEMPTY/meta/status'))).val(),'closed');A.equal((await get(ref(c.database(),'rooms/MODEMPTY/bundle/checkpointJSON'))).val(),'PRIVATE');A.equal((await get(ref(c.database(),'lobby/MODEMPTY'))).exists(),false);});
 for(const [id,options,message] of [
  ['MODBUSY1',{presence:{host:{h1:{name:'host',at:1}}}},/還有玩家或觀眾/],
  ['MODWATCH',{spectators:{watch:{s1:{name:'watch',at:1,accepted:true}}}},/還有玩家或觀眾/],
  ['MODVOTES',{votes:{guest:'current'}},/確認再來一局/]
 ]){await seed(id,options);await p.click('[data-ol-close-empty="'+id+'"]');await p.click('#confirmEmptyRoomClose');await p.waitForFunction(()=>!!document.getElementById('emptyRoomCloseError')?.textContent);A.match(await p.textContent('#emptyRoomCloseError'),message);await p.locator('#sheet [data-close]').last().evaluate(e=>e.click());}
 const denied=await p.evaluate(async()=>{const c=BREAK_ONLINE.client;try{await c.D.get(c.ref('rooms/MODEMPTY/bundle/checkpointJSON'));return false;}catch{return true;}});A(denied);
 await env.withSecurityRulesDisabled(c=>remove(ref(c.database(),'roomModerators/'+uid)));await p.waitForFunction(()=>!BREAK_ONLINE.client.canManageEmptyRooms);A.equal(await p.locator('[data-ol-close-empty]').count(),0);
 await p.click('#olLogout');await p.waitForFunction(()=>!BREAK_ONLINE.client.user);A.equal(await p.locator('[data-ol-close-empty]').count(),0);A.deepEqual(errors,[]);
 console.log('Room moderator UI: verified Google allowlist live grant/revoke, no deck required, three widths, confirmation, empty close, players/viewers/rematch rejected, private checkpoint denied, logout clears');
}finally{await b.close();await env.clearDatabase();await env.cleanup();}})().catch(e=>{console.error(e);process.exitCode=1;});
