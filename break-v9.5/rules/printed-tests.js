'use strict';
const assert=require('node:assert/strict'),I=require('./node-inventory'),F=require('./frequent-node-tests');
const codes=['P02-081'],scope={mode:'single',binding:'reference',membership:'snapshot_on_resolution'};
const numeric=(parameter,value,operation='add')=>({kind:'numeric',target:'source',target_scope:scope,parameter,value,operation,duration:'this_turn'});
function testPrinted(catalog){
 const forms=I.forms(catalog).printed_parameter;
 for(const{node}of forms.values())for(const delta of [-3,0,4]){
  const k=F.game(catalog),id=k.addCard('HV-D01-009',0,'receive'),base=k.card(id).printed.parameters[node.parameter];k.resolveProgram(numeric(node.parameter,delta),0,id);const before=k.snapshot(),program=numeric(node.parameter,node,'set');k.preflight(node);k.resolveProgram(program,0,id);assert.equal(k.parameter(id,node.parameter),base,'Print lookup does not use current modified value');const after=k.snapshot();k.restore(before);k.resolveProgram(program,0,id);assert.deepEqual(k.snapshot(),after);
  for(const bad of [{of:'source'},{parameter:'offense'}])assert.throws(()=>k.preflight({...node,...bad}),/printed parameter expression/);
 }
 return forms.size;
}
function setup(catalog,card,mode='positive'){
 const k=F.game(catalog),id=k.addCard(card.card_no,0,'hand'),receiver=k.addCard(mode==='wrong_tag'?'HV-P01-030':'HV-D01-009',0,mode==='no_receiver'?'attack':'receive'),other=mode==='other_target'?k.addCard('HV-P01-004',0,'attack'):null,p=card.profiles[0];k.state.turn.phase='receive';k.state.ball={kind:'attack',offense:8,owner:1};if(mode!=='empty_deck')k.addCard('HV-D04-003',0,'deck');
 const delta=mode==='decreased'?-3:mode==='unchanged'||mode==='wrong_tag'||mode==='no_receiver'?0:3;
 if(delta)k.resolveProgram(numeric('receive',delta),0,receiver);
 if(mode==='protected')k.resolveProgram({kind:'protect_numeric_decrease',target:'source',target_scope:scope,parameter:'all',duration:'this_turn'},0,receiver);
 if(mode==='invalid')k.resolveProgram({kind:'invalidate_skill',actor:'self',selector:{type:'event',play_icons_any:['receive']},duration:'this_turn'},0,id);
 k.choose=r=>r.kind==='optional'?mode!=='decline':r.kind==='target'&&other?[r.options.includes(other)?other:r.options[0]]:F.choose(r);
 return{k,id,p,receiver,other,phase:'receive',initialBoost:delta?[{key:mode==='no_receiver'?'attack':'receive',param:'rcv',value:delta}]:[]};
}
function invoke(f){return f.k.playEvent(f.id);}
function testCard(catalog,card){for(const mode of ['positive','decreased','decline','unchanged','other_target','wrong_tag','no_receiver','empty_deck','invalid','protected']){
 const f=setup(catalog,card,mode),{k,id,receiver,other}=f,before=k.snapshot(),base=k.card(receiver).printed.parameters.receive;invoke(f);const expected=mode==='wrong_tag'?base:mode==='invalid'?base+3:mode==='decline'||mode==='protected'?base+4:mode==='other_target'?base:base+1;
 assert.equal(k.parameter(receiver,'receive'),expected,mode);if(other)assert.equal(k.parameter(other,'receive'),k.card(other).printed.parameters.receive+1);assert.equal(k.zone(0,'hand').length,['empty_deck','invalid'].includes(mode)?0:1);assert.equal(k.state.decisions.filter(d=>d.request.kind==='optional').length,['unchanged','wrong_tag','no_receiver','invalid','protected'].includes(mode)?0:1,mode+' optional availability');
 const after=k.snapshot();k.restore(before);invoke(f);assert.deepEqual(k.snapshot(),after,'Print restore card replay '+mode);
 }}
module.exports={codes,setup,invoke,testPrinted,testCard};
