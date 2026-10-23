'use strict';
const assert=require('node:assert/strict'),I=require('./node-inventory'),F=require('./frequent-node-tests');
const codes=['P03-047'],scope={mode:'single',binding:'reference',membership:'snapshot_on_resolution'},numeric=(value,guard)=>({kind:'numeric',target:'source',target_scope:scope,parameter:'toss',operation:'add',value,duration:'current_turn_cleanup_or_role_exit',...(guard?{increase_guard:guard}:{})});
function testMaximum(catalog){
 const forms=I.forms(catalog).source_skill_maximum;
 for(const{node}of forms.values())for(const [initial,expected]of [[-3,-2],[0,1],[2,3],[3,3],[5,5]]){
  const k=F.game(catalog),id=k.addCard('HV-P03-047',0,'toss'),other=k.addCard('HV-D01-009',0,'attack');k.preflight(node);
  const external={...numeric(initial),target:{kind:'selector',actor:'self',zone:'court',filters:{role:'toss'}},target_scope:{mode:'single',binding:'choose',membership:'snapshot_on_resolution'}};k.resolveProgram(external,0,other);const before=k.snapshot();k.resolveProgram(numeric(1,node),0,id);assert.equal(k.parameter(id,'toss'),expected,'Guard checks this increment without reducing an existing external value');const after=k.snapshot();k.restore(before);k.resolveProgram(numeric(1,node),0,id);assert.deepEqual(k.snapshot(),after);
  for(const bad of [{max_result:-1},{only_this_skill:false},{never_reduce_other_source_value:false}])assert.throws(()=>k.preflight({...node,...bad}),/source skill maximum parameters/);
 }
 const k=F.game(catalog),id=k.addCard('HV-P03-047',0,'toss'),guard=[...forms.values()][0].node;for(let i=0;i<5;i++)k.resolveProgram(numeric(1,guard),0,id);assert.equal(k.parameter(id,'toss'),3);k.resolveProgram(numeric(4),0,id);assert.equal(k.parameter(id,'toss'),7,'Other effects may increase beyond this skill cap');k.resolveProgram(numeric(1,guard),0,id);assert.equal(k.parameter(id,'toss'),7);k.resolveProgram(numeric(-6),0,id);assert.equal(k.parameter(id,'toss'),1);k.resolveProgram(numeric(1,guard),0,id);assert.equal(k.parameter(id,'toss'),2,'Current point cap is not a lifetime three-use quota');return forms.size;
}
function setup(catalog,card,mode='positive',count=1){
 const k=F.game(catalog),id=k.addCard(card.card_no,0,mode==='wrong_role'?'receive':'toss'),events=[];for(let i=0;i<count;i++)events.push(k.addCard('HV-P03-096',0,'hand'));for(let i=0;i<4;i++)k.addCard('HV-D01-009',0,'deck');const phase=mode==='wrong_phase'?'receive':'attack';k.state.turn.phase=phase;k.state.ball={kind:'attack',offense:8,owner:1};
 const boost=mode==='external'?5:0;if(boost)k.resolveProgram(numeric(boost),0,id);if(mode==='invalid')k.resolveProgram({kind:'invalidate_skill',actor:'self',selector:{roles:['toss']},duration:'this_turn'},0,id);return{k,id,p:card.profiles[0],events,event:events[0],phase,initialBoost:boost?[{key:'toss',param:'tos',value:boost}]:[]};
}
function invoke(f){return f.k.playEvent(f.event);}
function testCard(catalog,card){for(const mode of ['positive','wrong_role','wrong_phase','invalid','external']){
 const f=setup(catalog,card,mode,4),{k,id,events}=f,before=k.snapshot(),run=()=>{for(const [i,event]of events.entries()){k.playEvent(event);assert.equal(k.parameter(id,'toss'),mode==='positive'?[1,2,3,3][i]:mode==='external'?5:0,mode+' Event '+(i+1));}};run();assert.equal(k.zone(0,'event').length,4,'Invalid repeated-name Event skills still permit actual Event placement');const after=k.snapshot();k.restore(before);run();assert.deepEqual(k.snapshot(),after,'Skill cap replay '+mode);
 }}
module.exports={codes,setup,invoke,testMaximum,testCard};
