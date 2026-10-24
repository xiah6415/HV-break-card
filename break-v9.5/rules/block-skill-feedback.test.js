'use strict';
const assert=require('node:assert/strict'),{LocalSession}=require('./local-session'),H=require('../host-choice');
function setup({fee=true,events=2,invalid=false}={}){
 const deck=['P02-003','D01-009',...Array(3).fill('D01-012'),...Array(35).fill('D01-009')],s=new LocalSession({seed:7,decks:[deck,deck],mode:'numeric'}),m=s.match,k=m._kernel,find=(code,p=0)=>Object.values(k.state.cards).find(c=>c.owner===p&&c.cardNo==='HV-'+code&&c.zone===p+'.deck').id,move=(id,p,z)=>k._atomic(()=>k._move(id,p,z,k._context(id,p)));
 const id=find('P02-003'),side=find('D01-009');move(id,0,'hand');move(side,0,'hand');if(fee)move(find('D01-012'),0,'hand');for(let i=0;i<events;i++)move(find('D01-012',1),1,'event');
 k.state.stage='rally';k.state.turn={id:1,player:0,phase:'block',step:'free'};k.state.ball={kind:'attack',offense:7,owner:1};Object.assign(m._m,{pending:null,continuation:null,phase:'rally',actor:0,turnNo:1,rally:1,pc:'block'});
 if(invalid)k.effect('invalid',{actor:0,selector:{roles:['block']}},k._context(side,0),'this_turn');m._pump();return {s,m,k,id,side};
}
function test(){
 for(const opts of [{},{fee:false},{events:1},{invalid:true}]){
  const f=setup(opts),before=f.m.snapshot(),expected=!Object.keys(opts).length;
  assert.deepEqual(f.m.previewBlockSkills({cards:[],center:null}),[]);assert.deepEqual(f.m.previewBlockSkills({cards:[f.id,f.id],center:f.id}),[]);
  for(const center of [f.id,f.side])assert.deepEqual(f.m.previewBlockSkills({cards:[f.id,f.side],center}),expected?[f.id]:[]);
  assert.deepEqual(f.m.snapshot(),before,'preview must preserve full state, RNG and pending');
  if(expected){f.s.command({kind:'answer',answer:H.makeAnswer(f.m.request(0),{cards:[f.id,f.side],center:f.id})});assert.equal(f.m.request(0).kind,'activate_payment');f.s.command({kind:'answer',answer:H.makeAnswer(f.m.request(0),false)});assert(!f.k.view(0).publicLog.some(e=>e.type==='skill_resolved'));assert(f.s.undo());f.s.command({kind:'answer',answer:H.makeAnswer(f.m.request(0),true)});while(f.m.request(0)?.origin==='kernel')f.s.command({kind:'answer',answer:H.aiAnswer(f.m.request(0))});assert(f.k.view(0).publicLog.some(e=>e.type==='skill_resolved'&&e.source===f.id));}
 }
 console.log('Block timing: center/side, fee shortfall, condition, invalid skill, illegal group, no state/RNG change, decline/Undo/resolve passed');
}
if(require.main===module)test();module.exports={setup,test};
