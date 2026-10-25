'use strict';
// Native Match fixtures and real DOM actions shared by the migrated browser suites.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),{Match}=require('./rules/match'),H=require('./host-choice');
const sizes=[[1280,900],[390,844],[320,568]];
function fixture({name='fixture',codes=[],mode='strict',phase='receive',pc='receiveEvent',hand=[],court={},drop=[],top=[],empty=false,ball=0,prepare}={}){
 const counts={};for(const code of [...codes,...hand,...drop,...top,...Object.values(court).flat()])counts[code]=(counts[code]||0)+1;
 const cards=Object.entries(counts).flatMap(([code,n])=>Array(n).fill(code));while(cards.length<40)cards.push('D01-009');assert.equal(cards.length,40);
 const options={id:'browser-'+name,seed:7,decks:[cards,cards],mode,wantsAck:[true,false]},m=new Match(options),k=m._kernel;
 Object.assign(m._m,{pending:null,continuation:null,phase:'rally',actor:0,turnNo:1,rally:1,server:1,pc,notices:[],roleTotals:[{},{}]});k.state.stage='rally';k.state.turn={id:1,player:0,phase,step:'free'};k.state.ball={kind:'attack',offense:ball,owner:1};
 const move=(id,p,z)=>k._atomic(()=>k._move(id,p,z,k._context(id,p)));
 for(const c of Object.values(k.state.cards))move(c.id,c.owner,'deck');
 const put=(code,z,p=0)=>{const id=k.zone(p,'deck').find(id=>k.card(id).cardNo==='HV-'+code);assert(id,'fixture lacks '+code);move(id,p,z);return id;};
 for(const p of [0,1])for(let i=0;i<2;i++){const id=k.zone(p,'deck').find(id=>k.card(id).cardNo==='HV-D01-009');move(id,p,'sets');}
 const refs={hand:hand.map(no=>put(no,'hand')),drop:drop.map(no=>put(no,'drop')),court:{}};
 for(const [z,nos]of Object.entries(court))refs.court[z]=nos.map(no=>put(no,z));
 if(empty)for(const id of [...k.zone(0,'deck')])move(id,0,'drop');else for(const no of top)put(no,'deck');
 prepare?.({m,k,put,move,refs});m._pump();k.assertState();return {options,snapshot:m.snapshot(),refs};
}
async function browser(){return chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE||undefined});}
async function load(b,size,{fixture:f,seed=7,mode='strict',pauseAI=false,style='manual',url}={}){
 const [width,height]=size,p=await b.newPage({viewport:{width,height},isMobile:width<500,hasTouch:width<500}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.testErrors=errors;
 await require('./test-decks.cjs').seed(p);await p.goto(url||process.env.E2E_BASE_URL||pathToFileURL(path.resolve('index.html')).href,{waitUntil:'domcontentloaded'});await p.selectOption('#gameMode',f?.options.mode||mode);await p.selectOption('#turnPromptStyle',style);
 await p.evaluate(({f,seed,mode,pauseAI})=>{const T=BreakMatchPilot.TableSession;BreakEngine.Game=class{constructor(){throw Error('RETIRED_GAME_USED');}};BreakMatchPilot.TableSession=class extends T{constructor(o,c){const actual={...o,...(f?.options||{seed,mode}),delay:pauseAI?60000:200};super(actual,c);window.testOptions=actual;if(f)this.match.restore(f.snapshot);window.tableTest=this;window.commandTrace=[];const command=this.local.command.bind(this.local);this.local.command=cmd=>{const result=command(cmd);commandTrace.push(JSON.parse(JSON.stringify(cmd)));return result;};}};},{f:f||null,seed,mode,pauseAI});await p.click('#startBtn');return p;
}
async function ready(p){for(let i=0;i<500;i++){if(await p.isVisible('#turnScreen')){await p.click('#turnNext');continue;}const r=await p.evaluate(()=>tableTest.waiting);if(r)return r;if(await p.evaluate(()=>tableTest.match._m.phase==='finished'))return null;await p.waitForTimeout(20);}throw Error('no local decision');}
async function option(p,value){const a=await p.locator('#dockOpts [data-hc-v]').evaluateAll(ns=>ns.map(n=>n.dataset.hcV)),i=a.indexOf(JSON.stringify(value));assert(i>=0,'missing option '+JSON.stringify(value));await p.locator('#dockOpts [data-hc-v]').nth(i).click();}
async function fan(p,id){const point=await p.evaluate(id=>{const cards=window.tableTest?tableTest.match.view(0).players[0].hand:BREAK_ONLINE.current.view.players[BREAK_ONLINE.current.actor].hand,index=cards.findIndex(c=>c.id===id),b=document.querySelector(`[data-hand="${index}"]`);if(!b)return null;const r=b.getBoundingClientRect();for(let y=Math.max(1,r.top+4);y<Math.min(innerHeight-2,r.bottom);y+=4)for(let x=Math.max(1,r.left+3);x<Math.min(innerWidth-2,r.right);x+=4)if(document.elementFromPoint(x,y)?.closest('[data-hand]')===b)return {x,y};return null;},id);assert(point,'hand card must have a visible tap target');await p.mouse.click(point.x,point.y);}
async function answer(p,value,{hand=true,pile=true}={}){const r=await ready(p);assert(r);if(value===undefined)value=H.aiAnswer(r).value;if(r.input.type==='cards'&&!Array.isArray(value))value=[value];const before=await p.evaluate(()=>tableTest.match._m.decisionIndex);
 if(r.kind==='ack'&&pile){await p.locator('#meSide .pile2.tgt, #meSide .deckbtn.tgt').click();}
 else{const type=r.input.type,handMode=await p.locator('#dock').getAttribute('data-mode');if(['single','number'].includes(type)){if(hand&&handMode==='hand'&&r.options.some(o=>o.value===value&&o.card))await fan(p,value);else await option(p,value);}else if(['cards','block'].includes(type)){for(const v of type==='block'?value.cards:value)await option(p,v);if(type==='block'&&value.center!==value.cards[0])await p.locator('[data-hc-ctr]').filter({hasText:value.center}).click();}await p.locator('#dockOpts [data-hc-act="go"]').click();}
 await p.waitForFunction(n=>tableTest.match._m.decisionIndex>n,before);return r;
}
async function undo(p){const epoch=await p.evaluate(()=>tableTest.match.epoch);await p.locator('#undoBtn').click();await p.waitForFunction(e=>tableTest.match.epoch>e,epoch);return ready(p);}
async function snapshot(p){return p.evaluate(()=>tableTest.match.snapshot());}
async function check(p){assert.deepEqual(p.testErrors,[]);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await p.evaluate(()=>Object.keys(tableTest.match.snapshot().cards).length),80);}
module.exports={assert,fs,path,H,Match,sizes,fixture,browser,load,ready,option,fan,answer,undo,snapshot,check};
