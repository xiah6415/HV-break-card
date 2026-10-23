'use strict';
const assert=require('node:assert/strict'),I=require('./node-inventory'),F=require('./frequent-node-tests');
const codes=['D04-013'];
function def(catalog,type,match){return catalog.cards.find(c=>c.profiles[0].variants[0].printed.type===type&&c.profiles[0].variants[0].printed.affiliation_tags.includes('青葉城西')===match&&(type==='event'||!c.profiles[0].program));}
function testRevealRetrieve(catalog){
 const forms=I.forms(catalog).reveal_and_retrieve;
 for(const{node}of forms.values())for(const mode of ['match','miss','decline','empty','no_add']){
  const k=F.game(catalog),source=k.addCard('HV-D01-009',0,'event'),shown=mode==='empty'?null:k.addCard(def(catalog,'character',mode!=='miss').card_no,0,'deck');if(mode==='no_add')k.resolveProgram({kind:'ban_action',actor:'self',action:'add_hand',scope:{origins:['skill']},duration:'this_turn'},0,source);const before=k.snapshot(),requests=[];
  k.choose=r=>{requests.push(r);if(r.kind==='optional'){assert.deepEqual(r.options,[false,true]);assert(r.effectDescription.includes('翻開'));return mode!=='decline';}assert.equal(r.kind,'revealResult','No redundant flip, single-card retrieval or bottom ordering prompt');assert.deepEqual(r.options,[shown]);assert.equal(k.card(shown).zone,'0.deck','Card remains hidden until the visible confirmation');return [];};
  const run=()=>{const ctx=k._context(source,0);k.preflight(node);const result=k._atomic(()=>k._run(node,ctx));return{result,ctx};};const{result,ctx}=run();assert.equal(result,!['decline','empty'].includes(mode));assert.deepEqual(ctx.bind.revealed,['decline','empty'].includes(mode)?[]:[shown]);assert.deepEqual(ctx.bind.retrieved,mode==='match'?[shown]:[]);assert.equal(requests.length,mode==='empty'?0:mode==='decline'?1:2);assert.deepEqual(k.state.rng,before.rng);const after=k.snapshot();k.restore(before);requests.length=0;run();assert.deepEqual(k.snapshot(),after);
  for(const bad of [{top_count:2},{count_mode:'exact'},{remainder:'deck_top'}])assert.throws(()=>k.preflight({...node,...bad}),/reveal retrieval parameters/);
 }
 return forms.size;
}
function setup(catalog,card,mode='positive'){
 const k=F.game(catalog),id=k.addCard(card.card_no,0,'hand'),target=k.addCard(def(catalog,'character',mode!=='no_target').card_no,0,'receive'),event=['own_event','other_event','one','decline','no_add'].includes(mode),match=!['other_char','other_event','one'].includes(mode),shown=mode==='empty'?null:k.addCard(def(catalog,event?'event':'character',match).card_no,0,'deck');
 const lower=shown&&mode!=='one'?k.addCard('HV-D01-009',0,'deck'):null;if(lower){const deck=k.zone(0,'deck');deck.unshift(deck.pop());}
 k.state.turn.phase='receive';k.state.ball={kind:'attack',offense:8,owner:1};if(mode==='no_add')k.resolveProgram({kind:'ban_action',actor:'self',action:'add_hand',scope:{origins:['skill']},duration:'this_turn'},0,id);
 if(mode==='invalid')k.resolveProgram({kind:'invalidate_skill',actor:'self',selector:{type:'event',play_icons_any:['receive']},duration:'this_turn'},0,id);
 k.choose=r=>r.kind==='optional'?mode!=='decline':F.choose(r);return{k,id,p:card.profiles[0],phase:'receive',target,shown,lower,event,match};
}
function invoke(f){return f.k.playEvent(f.id);}
function testCard(catalog,card){for(const mode of ['positive','own_event','other_char','other_event','decline','empty','one','no_add','invalid','no_target']){
 const f=setup(catalog,card,mode),{k,id,target,shown,lower,event,match}=f,before=k.snapshot();invoke(f);const flipped=!!shown&&!['decline','invalid'].includes(mode),retrieved=flipped&&match&&mode!=='no_add',drawn=flipped&&event&&mode!=='no_add';
 assert.equal(k.parameter(target,'receive'),k.card(target).printed.parameters.receive+(!['no_target','invalid'].includes(mode)?1:0),mode+' first +1');assert.equal(k.zone(0,'hand').length,(retrieved?1:0)+(drawn?1:0));assert.equal(k.state.events.slice(before.events.length).filter(e=>e.type==='hand_added'&&e.operation==='add_hand').length,retrieved?1:0,'Revealed non-Aoba Event never enters via retrieval');assert.equal(k.state.events.slice(before.events.length).filter(e=>e.type==='hand_added'&&e.operation==='draw').length,drawn?1:0);
 if(shown&&flipped&&!retrieved&&!drawn)assert.equal(k.zone(0,'deck')[0],shown);if(mode==='other_event'){assert.equal(k.zone(0,'deck')[0],shown);assert.deepEqual(k.zone(0,'hand'),[lower]);}if(mode==='one')assert.deepEqual(k.zone(0,'hand'),[shown],'Single non-Aoba Event returns first, then can be drawn by the later effect');if(mode==='decline')assert(k.state.publicLog.some(e=>e.type==='reveal_condition'&&e.declined));assert.equal(k.state.decisions.filter(d=>d.request.kind==='revealResult').length,flipped?1:0);assert.equal(k.state.decisions.filter(d=>d.request.kind==='reveal').length,0);
 const after=k.snapshot();k.restore(before);invoke(f);assert.deepEqual(k.snapshot(),after,'Reveal/retrieve replay '+mode);
 }}
module.exports={codes,setup,invoke,testRevealRetrieve,testCard};
