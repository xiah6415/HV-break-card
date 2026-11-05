'use strict';
const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE||undefined});try{
 const pages=[],errors=[];
 async function open(name){const p=await b.newPage({viewport:{width:390,height:844}});pages.push(p);p.on('pageerror',e=>errors.push(e.message));await require('../test-decks.cjs').seed(p);await p.goto('http://127.0.0.1:8123/?online=1&emulator=1');await p.waitForFunction(()=>!document.getElementById('olAnon').disabled);await p.fill('#olName',name);await p.click('#olAnon');await p.waitForFunction(()=>BREAK_ONLINE.client?.online&&BREAK_ONLINE.client?.user);return p;}
 const host=await open('Delete Host'),guest=await open('Delete Guest');
 await host.click('#olCreate');await host.waitForFunction(()=>BREAK_ONLINE.client.room);const id=await host.evaluate(()=>BREAK_ONLINE.client.room);
 await guest.fill('#olCode',id);await guest.click('#olJoin');await host.waitForFunction(()=>BREAK_ONLINE.current&&BREAK_ONLINE.client.meta?.status==='running');await guest.waitForFunction(()=>BREAK_ONLINE.current);
 assert(await host.evaluate(async id=>{try{await BREAK_ONLINE.client.deleteRoom(id);return false;}catch(e){return /已結束/.test(e.message);}},id));
 await host.evaluate(()=>BREAK_ONLINE.session.surrender());await host.waitForFunction(()=>BREAK_ONLINE.client.meta?.status==='finished'&&BREAK_ONLINE.client.publishedReplay);
 const replay=await host.evaluate(()=>BREAK_ONLINE.client.publishedReplay);
 while(await host.isVisible('#turnScreen'))await host.click('#turnNext');
 await host.locator('[data-act="home"]').click();await host.waitForFunction(()=>!BREAK_ONLINE.client.room);
 const button=host.locator('[data-ol-delete="'+id+'"]');await button.waitFor();await button.click();assert(await host.isVisible('#confirmRoomDelete'));assert(await host.locator('[data-ol-delete="'+id+'"]').count(),'opening confirmation does not delete');
 await host.click('#confirmRoomDelete');await button.waitFor({state:'detached'}).catch(async e=>{throw Error(e.message+' STATUS '+await host.locator('#runtimeStatus').textContent());});await guest.waitForFunction(()=>!BREAK_ONLINE.client.room);
 const kept=await host.evaluate(async({id,replay})=>{const c=BREAK_ONLINE.client;return {room:(await c.D.get(c.ref('rooms/'+id+'/meta'))).exists(),replay:(await c.D.get(c.ref('publicReplays/'+replay))).exists(),index:(await c.D.get(c.ref('publicReplayIndex/'+replay))).exists(),history:JSON.parse(localStorage.getItem('bk_match_records')).rows.length};},{id,replay});
 assert.deepEqual(kept,{room:false,replay:true,index:true,history:1});assert.deepEqual(errors,[]);
 console.log('Room deletion: running denied, finished confirmation, room/lobby removed, guest returns, replay/index/history retained');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
