'use strict';
const {reviewedEngine}=require('./finite-fixtures');
const {E,bridge,scope}=reviewedEngine(),copy=x=>JSON.parse(JSON.stringify(x));
function fixture(code,player=0,{setup=()=>{},answer,parameter='rcv',target='receive',game}={}){
 const requests=[],logs=[],choose=async(g,p,r)=>{requests.push({actor:p.idx,...copy(r)});if(answer)return answer(g,p,r);if(r.kind==='target')return (r.options.find(o=>o.value===target)||r.options[0]).value;if(r.kind==='parameter')return (r.options.find(o=>o.value===parameter)||r.options[0]).value;if(r.kind==='skill')return true;if(r.kind==='event')return null;return r.options[0].value;};
 const g=game||new E.Game({mode:'numeric',seed:7,decks:['k1014','seijoh'],agents:[{wantsAck:true,choose},{wantsAck:true,choose}],onLog:s=>logs.push(s)});
 for(const q of g.players){for(const z of ['hand','deck','drop','ev','sets'])q[z]=[];for(const a in q.area)q.area[a]=[];}
 const p=g.players[player],o=p.opp;o.area.receive=['P04-026'];g.beginTurn(p);g.ball={type:'attack',off:6};p.hand=[code,code,'D01-009'];p.deck=Array(8).fill('D01-009');p.area.receive=['D01-009'];p.area.toss=['P01-006'];p.area.attack=['P01-004'];setup({g,p,o});
 p.ts.receiver=p.top('receive');p.ts.rcv=g.parameter(p,'receive','rcv');p.ts.setter=p.top('toss');p.ts.toss=g.parameter(p,'toss','tos');p.ts.attacker=p.top('attack');p.ts.atk=g.parameter(p,'attack','atk');return {g,p,o,requests,logs};
}
const phases={serve:'srv',draw:'drw',block:'blk',receive:'rcv',toss:'tos',attack:'atk'};
const definitions={
 'D01-011':{draw:t=>1,delta:{rcv:2}},
 'D03-013':{setup:({p})=>p.area.toss=['P01-063'],target:'toss',draw:t=>1,delta:{tos:1}},
 'D04-012':{setup:({p})=>p.area.receive=['D04-003'],draw:t=>t==='atk'?1:0,delta:{rcv:1}},
 'P01-075':{draw:t=>t==='rcv'?1:0,delta:{rcv:1}},
 'P01-077':{setup:({p})=>p.area.receive=['D01-005'],draw:t=>1,delta:{rcv:2}},
 'P01-080':{setup:({o})=>o.ev=Array(5).fill('D04-012'),draw:t=>1,delta:{rcv:3}},
 'P02-084':{setup:({p})=>{p.area.receive=['P02-022'];p.ev=Array(2).fill('D03-013');},draw:t=>1,delta:{rcv:2}},
 'P02-100':{setup:({p})=>p.area.receive=['P01-026'],draw:t=>1,delta:{rcv:1}},
 'P03-081':{setup:({p})=>{p.area.receive=['P03-004'];p.area.toss=[];p.area.attack=[];p.ev=Array(7).fill('D01-009');},draw:t=>2,delta:{rcv:1}},
 'P03-084':{setup:({p})=>{p.area.receive=['P03-024'];p.area.toss=[];p.area.attack=[];p.ev=['D01-009'];},draw:t=>1,delta:{rcv:2}},
 'P04-091':{setup:({p})=>{p.area.receive=['P04-035'];p.area.attack=['P03-017'];},draw:t=>1,delta:{rcv:2}},
 'P04-092':{setup:({p})=>p.area.receive=['P03-017'],draw:t=>1,delta:{rcv:1}},
 'P04-101':{setup:({p})=>{p.area.receive=['P04-081'];p.area.toss=[];p.area.attack=[];p.ev=Array(3).fill('P04-101');},draw:t=>1,delta:{rcv:1,atk:1}},
 'PR-030':{setup:({p})=>p.area.receive=['P01-031'],draw:t=>1,delta:{rcv:2}},
};

module.exports={E,bridge,scope,fixture,definitions,phases};
