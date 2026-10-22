'use strict';
const assert=require('node:assert/strict'),F=require('./frequent-node-tests'),I=require('./node-inventory'),E=require('../engine'),B=require('./legacy'),catalog=require('./data/cards.json');
const game=()=>F.game(catalog),card=c=>catalog.cards.find(x=>I.short(x.card_no)===c),node=c=>I.nodes(card(c).profiles[0]).find(n=>n.kind==='choose_modes');
const number=(k,id,p,v)=>k.effect('numeric',{target:k.reference(id),parameter:p,operation:'set',value:v},k._context(id,k.card(id).owner));
function pick(school,param){return catalog.cards.find(c=>c.type==='character'&&!c.profiles[0].program&&c.profiles[0].variants[0].printed.affiliation_tags.includes(school)&&Number.isInteger(c.profiles[0].variants[0].printed.parameters[param]));}
function chooseMode(k,i){k.choose=r=>r.effectModes?i:F.choose(r);}
function offer(k,id,n){let req;const choose=k.choose;k.choose=r=>{if(r.effectModes)req=r;return r.effectModes?r.options[0]:choose(r);};const before=k.snapshot();k.resolveProgram(n,0,id);k.restore(before);k.choose=choose;return req;}
// QA current values: a prior reduction followed by +1 changes mode eligibility.
for(const [code,school,end]of [['P01-082','音駒',7],['P04-098','和久谷南',6]]){
 const k=game(),id=k.addCard(pick(school,'receive').card_no,0,'receive');k.state.turn.phase='receive';number(k,id,'receive',4);
 if(code==='P01-082')assert.deepEqual(offer(k,id,node(code)).options,[0]);
 chooseMode(k,0);k.resolveProgram(node(code),0,id);assert.equal(k.parameter(id,'receive'),5);
 const req=offer(k,id,node(code));assert.deepEqual(req.options,[0,1]);assert(req.modeLabels[1].includes('設為'+end));chooseMode(k,1);k.resolveProgram(node(code),0,id);assert.equal(k.parameter(id,'receive'),end);
}
// Date Tech's block=3 condition uses the modified value, not the print.
{
 const k=game(),id=k.addCard(pick('伊達工業','block').card_no,0,'block');number(k,id,'block',2);assert.deepEqual(offer(k,id,node('P02-090')).options,[1]);number(k,id,'block',3);assert.deepEqual(offer(k,id,node('P02-090')).options,[0,1]);
}
// Stage gates and empty target modes disappear, while later watchers remain
// valid even when their eventual target is not on the table yet.
{
 const k=game(),id=k.addCard(pick('伊達工業','block').card_no,0,'block');k.state.turn.phase='block';assert.deepEqual(offer(k,id,node('P03-098')).options,[0]);k.state.turn.phase='serve';assert.deepEqual(offer(k,id,node('P03-098')).options,[0,1]);
 const empty=game(),s=empty.addCard('HV-D01-009',0,'hand');assert.equal(offer(empty,s,node('D02-011')),undefined);
 for(const phase of ['serve','draw']){k.state.turn.phase=phase;k.addCard('HV-D01-009',0,'deck');const oikawa=catalog.cards.find(c=>c.profiles[0].variants[0].printed.name==='及川徹');k.addCard(oikawa.card_no,0,'drop');assert.deepEqual(offer(k,id,node('P04-087')).options,[phase==='serve'?0:1]);}
}
// D03-003's next-turn watch reduces 1 to -1; no zero clamp.
{
 const k=game(),id=k.addCard('HV-D03-003',0,'serve');chooseMode(k,1);k.resolveProgram(node('D03-003'),0,id);k.endTurn();k.beginTurn(1,'toss');const target=catalog.cards.find(c=>!c.profiles[0].program&&c.profiles[0].variants[0].printed.parameters.toss===1),t=k.addCard(target.card_no,1,'hand');k.enter(t,'toss');assert.equal(k.parameter(t,'toss'),-1);
}
// Core serving replacement and draw prohibition, both rule and skill draws.
{
 const k=game(),old=k.addCard('HV-D01-009',0,'serve'),ev=k.addCard('HV-P04-087',0,'hand'),oikawa=k.addCard('HV-P01-033',0,'drop');k.state.turn.phase='serve';chooseMode(k,0);k.playEvent(ev);assert.equal(k.top(0,'serve'),oikawa);assert.deepEqual(k.zone(0,'serve'),[old,oikawa]);assert.equal(k.parameter(oikawa,'serve'),5);k.endTurn();k.beginTurn(1,'draw');k.addCard('HV-D01-009',1,'deck');assert.deepEqual(k.drawRule(1),[]);k.resolveProgram({kind:'draw',actor:'self',count:1,count_mode:'exact',bind:'drawn'},1);assert.equal(k.zone(1,'hand').length,0);
}
(async()=>{
 // Same-name Turn1 survives the legacy Open Attack entry into the shared core.
 const c=card('P03-001'),p0=c.profiles[0],f=require('./batch-smoke').fixture(c,p0,'attack',{rich:true,conditioned:true,expanded:true,max:true,key:'positive'},0,catalog),s=f.k.snapshot();
 const agent={async choose(g,p,r){if(r.kind==='skill')return true;if(r.kind==='guts')return r.options.slice(0,r.need).map(o=>o.value);return r.options[0]?.value;}};
 const g=new E.Game({mode:'strict',seed:7,decks:['k1014','seijoh'],agents:[agent,agent]});for(const q of g.players){for(const[h,z]of Object.entries({hand:'hand',deck:'deck',drop:'drop',ev:'event',sets:'sets'}))q[h]=s.zones[q.idx+'.'+z].map(id=>I.short(s.cards[id].cardNo));for(const z of Object.keys(q.area))q.area[z]=s.zones[q.idx+'.'+z].map(id=>I.short(s.cards[id].cardNo));}g.cardState=null;g.beginTurn(g.players[0]);g.setRulePhase('atk');g.ball={type:'attack',off:5};const p=g.players[0];await g.resolve(p,'P03-001','atk');assert.equal(p.ts.used['P01-002'],1);p.hand.push('P01-078');p.drop=['P01-002'];p.deck=['D01-009','D01-009'];p.area.toss=['D01-009'];p.area.attack=['D01-009','D01-009','D01-009'];g.cardState=null;await g.resolve(p,'P01-078','atk');assert.equal(p.area.attack.at(-1),'P01-002');assert.equal(g.parameter(p,'attack','atk'),E.st('P01-002','atk')+1,'Only Open Attack +1, not the locked intrinsic skill');
 // Real serveTurn must use the replacement's serve value after its event.
 let modeSeen=false;const a={wantsAck:true,async choose(g,p,r){if(r.ctx?.effectModes){modeSeen=true;assert(r.prompt.includes('選擇1項效果'));assert(r.options[0].label.includes('及川徹'));assert(!r.options.some(o=>o.label.includes('牌庫底')));return 0;}if(r.kind==='event')return p.hand.includes('P04-087')?'P04-087':null;return r.options[0]?.value;}};
 const h=new E.Game({mode:'strict',seed:7,decks:['k1014','seijoh'],agents:[a,a]}),q=h.players[0];q.hand=['D01-009','P04-087'];q.drop=['P01-033'];q.deck=[];q.ev=[];for(const z of Object.keys(q.area))q.area[z]=[];h.cardState=null;const ball=await h.serveTurn(q);assert(modeSeen);assert.deepEqual(q.area.serve,['D01-009','P01-033']);assert.equal(ball.off,5);
 console.log('mode live: Claude 7 required cases; printed P04-098 sets 6; phase/target filters, both draw origins, same-name Open Attack and actual serving replacement passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
