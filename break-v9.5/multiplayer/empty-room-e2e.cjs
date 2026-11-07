'use strict';
const fs=require('node:fs'),A=require('node:assert/strict'),T=require('../browser-test-helpers.cjs');
(async()=>{const b=await T.browser(),pages=[],errors=[];
async function open(name){const p=await b.newPage({viewport:{width:390,height:844}});pages.push(p);p.on('pageerror',e=>errors.push(e.message));await require('../test-decks.cjs').seed(p);await p.goto('http://127.0.0.1:8123/?online=1&emulator=1');await p.waitForFunction(()=>!document.getElementById('olAnon').disabled);await p.fill('#olName',name);await p.click('#olAnon');await p.waitForFunction(()=>BREAK_ONLINE.client?.online&&BREAK_ONLINE.client.user);return p;}
const meta=(p,id)=>p.evaluate(async id=>(await BREAK_ONLINE.client.D.get(BREAK_ONLINE.client.ref('rooms/'+id+'/meta'))).val(),id);
const leave=p=>p.evaluate(()=>BREAK_ONLINE.client.leave());
async function pair(a,c){for(const p of [a,c])await p.locator('#modeOnline').evaluate(e=>e.click());await a.click('#olCreate');await a.waitForFunction(()=>BREAK_ONLINE.client.room);const id=await a.evaluate(()=>BREAK_ONLINE.client.room);await c.fill('#olCode',id);await c.click('#olJoin');await Promise.all([a,c].map(p=>p.waitForFunction(()=>BREAK_ONLINE.current&&BREAK_ONLINE.client.meta?.status==='running')));return id;}
async function finish(a,c){await a.evaluate(()=>BREAK_ONLINE.session.surrender());await Promise.all([a,c].map(p=>p.waitForFunction(()=>BREAK_ONLINE.client.meta?.status==='finished')));await a.waitForFunction(()=>BREAK_ONLINE.client.publishedReplay===BREAK_ONLINE.client.core.config.archiveId);return a.evaluate(()=>({matchId:BREAK_ONLINE.current.view.match.id,replay:BREAK_ONLINE.client.publishedReplay}));}
try{
 const a=await open('離房房主'),c=await open('離房對手');
 let id=await pair(a,c);
 // Disconnect is not an explicit leave: neither seat loses the room.
 await Promise.all([a,c].map(p=>p.evaluate(()=>BREAK_ONLINE.client.D.goOffline(BREAK_ONLINE.client.db))));
 await Promise.all([a,c].map(p=>p.waitForFunction(()=>!BREAK_ONLINE.client.online)));
 await Promise.all([a,c].map(p=>p.evaluate(()=>BREAK_ONLINE.client.D.goOnline(BREAK_ONLINE.client.db))));
 await Promise.all([a,c].map(p=>p.waitForFunction(()=>BREAK_ONLINE.client.online&&BREAK_ONLINE.client.meta?.status==='running')));
 await leave(a);A.equal((await meta(c,id)).status,'running');A(await c.evaluate(()=>!!BREAK_ONLINE.client.room));
 await c.locator('#menuBtn').evaluate(e=>e.click());await c.click('#mHome');A.match(await c.textContent('#sheetBox'),/雙方離開.*自動關閉/);await c.click('#confirmGameAction');await c.waitForFunction(()=>!BREAK_ONLINE.client.room);
 await a.waitForFunction(async id=>(await BREAK_ONLINE.client.D.get(BREAK_ONLINE.client.ref('rooms/'+id+'/meta/status'))).val()==='closed',id);
 for(let i=0;i<100&&(await meta(a,id)).status!=='closed';i++)await a.waitForTimeout(50);
 A.equal((await meta(a,id)).status,'closed');await a.waitForFunction(async id=>!(await BREAK_ONLINE.client.D.get(BREAK_ONLINE.client.ref('lobby/'+id))).exists(),id);
 A(await c.evaluate(async id=>{try{await BREAK_ONLINE.client.join(id,[]);return false;}catch(e){return /已關閉/.test(e.message);}},id));
 id=await pair(a,c);const ended=await finish(a,c);
 const replay=await a.evaluate(async id=>(await BREAK_ONLINE.client.D.get(BREAK_ONLINE.client.ref('publicReplays/'+id))).val(),ended.replay);
 fs.writeFileSync('/tmp/break-replay.json',replay);
 await leave(c);A.equal((await meta(a,id)).status,'finished');await leave(a);A.equal((await meta(a,id)).status,'closed');
 A(await c.evaluate(async rid=>(await BREAK_ONLINE.client.D.get(BREAK_ONLINE.client.ref('publicReplays/'+rid))).exists(),ended.replay));
 id=await pair(a,c);const voted=await finish(a,c);await a.evaluate(matchId=>BREAK_ONLINE.client.send({kind:'rematch',matchId}),voted.matchId);
 await leave(a);await leave(c);A.equal((await meta(a,id)).status,'finished');
 // A retained vote can still lead to a normal two-consent rematch.
 for(const p of [a,c])await p.evaluate(async id=>{const d=Object.values(BreakEngine.DECKS)[0];await BREAK_ONLINE.client.join(id,Object.entries(d.cards).flatMap(([k,n])=>Array(n).fill(k)));},id);
 await c.waitForFunction(()=>BREAK_ONLINE.current?.view.match.phase==='finished');
 await c.evaluate(matchId=>BREAK_ONLINE.client.send({kind:'rematch',matchId}),voted.matchId);
 await a.waitForFunction(old=>BREAK_ONLINE.client.meta?.status==='running'&&BREAK_ONLINE.current?.view.match.id!==old,voted.matchId);
 await Promise.all([leave(a),leave(c)]);A.equal((await meta(a,id)).status,'closed','stale votes must not preserve next match');
 A.deepEqual(errors,[]);console.log('Empty room UI: disconnect/reconnect retained, first departure retained, last guest/host closed, lobby removed, closed join rejected, replay kept, current vote retained, two-consent rematch and stale-vote cleanup passed');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
