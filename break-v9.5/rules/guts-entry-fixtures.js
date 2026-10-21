'use strict';
const {reviewedEngine,profile}=require('./admission-fixtures');
const definitions={'D01-001':{area:'attack',cost:2,param:'atk',bonus:2,draw:0},'D01-002':{area:'toss',cost:2,param:'tos',bonus:2,draw:0},'D03-008':{area:'attack',cost:5,param:'atk',bonus:2,draw:0},'D03-011':{area:'receive',cost:2,param:'rcv',bonus:2,draw:0},'D04-008':{area:'receive',cost:4,param:'rcv',bonus:2,draw:1},'P03-035':{area:'receive',cost:3,param:'rcv',bonus:2,draw:1},'PR-004':{area:'toss',cost:2,param:'tos',bonus:0,draw:1},'BP-003':{area:'toss',cost:2,param:'tos',bonus:0,draw:1},'BP-004':{area:'toss',cost:2,param:'tos',bonus:0,draw:1},'P01-015':{area:'toss',cost:2,param:'tos',bonus:1,draw:1},'D02-009':{area:'receive',cost:2,param:'rcv',bonus:0,draw:1}};
const codes=Object.keys(definitions),{E,bridge,scope}=reviewedEngine(codes),copy=x=>JSON.parse(JSON.stringify(x));
function fixture(code,player=0,{game,setup=()=>{},answer,pool=definitions[code].cost+1}={}){
 const requests=[],logs=[],choose=async(g,p,r)=>{requests.push({actor:p.idx,...copy(r)});return answer?answer(g,p,r):r.kind==='skill'?true:r.kind==='guts'?r.options.slice(-r.need).map(o=>o.value):r.kind==='event'?null:r.kind==='target'?(r.options.find(o=>o.value==='receive')||r.options[0]).value:r.options[0].value;};
 const g=game||new E.Game({mode:'numeric',seed:7,decks:['k1014','seijoh'],agents:[{wantsAck:true,choose},{wantsAck:true,choose}],onLog:s=>logs.push(s)});
 for(const q of g.players){for(const z of ['hand','deck','drop','ev','sets'])q[z]=[];for(const a in q.area)q.area[a]=[];}
 const p=g.players[player],o=p.opp,d=definitions[code];g.beginTurn(p);g.ball={type:'attack',off:0};p.hand=[code,code,'P01-014','D01-009','P01-011','P01-004'];p.deck=Array(4).fill('D01-009');p.area[d.area]=Array(pool).fill('D01-009');o.area.receive=['P04-026'];setup({g,p,o,requests,logs});return {g,p,o,requests,logs,d,code};
}
const enter=(f,fromDrop=false)=>f.d.area==='attack'?f.g.enterAttack(f.p,f.code,fromDrop):f.g.enterCharacter(f.p,f.d.area,f.code,fromDrop);
module.exports={codes,definitions,E,bridge,scope,fixture,enter,profile};
