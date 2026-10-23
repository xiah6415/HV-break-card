'use strict';
const assert=require('node:assert/strict'),E=require('../engine'),B=require('./legacy'),I=require('./node-inventory'),{fixture}=require('./batch-smoke'),{matchesPrinted}=require('./batch-fixtures'),M=require('./modules');
const catalog=require('./data/cards.json'),codes=Object.keys(M.testModules(catalog).cards),roles=['serve','block','receive','toss','attack'],params={serve:'srv',block:'blk',receive:'rcv',toss:'tos',attack:'atk'},phases={serve:'srv',block:'blk',draw:'drw',receive:'rcv',toss:'tos',attack:'atk'};
let cases=0;
(async()=>{
 for(const code of codes){
  const card=catalog.cards.find(c=>I.short(c.card_no)===code),p=card.profiles[0],watches=I.nodes(p).filter(n=>n.kind==='watch'&&!I.nodes(p).some(w=>w.kind==='watch'&&n.node_id?.startsWith(w.then.node_id+'.')));
  for(const w of watches)for(const expired of [false,true])for(const historical of w.event==='source_moved'?[false,true]:[false]){
   const optionalGuard=I.nodes(p).find(n=>n.kind==='conditional'&&n.condition.field==='optional.performed'&&w.node_id.startsWith(n.then.node_id+'.'));
   const mode=I.nodes(p).find(n=>n.kind==='choose_modes'&&n.options.some(o=>w.node_id.startsWith(o.node_id+'.'))),modeIndex=mode?.options.findIndex(o=>w.node_id.startsWith(o.node_id+'.')),gate=I.nodes(p).find(n=>n.kind==='conditional'&&n.condition.field==='phase'&&w.node_id.startsWith(n.then.node_id+'.'));
   const played=p.activation.trigger?.event==='event_played',covered=p.activation.trigger?.event==='source_covered',observer=covered||p.activation.trigger?.event==='character_entry',phase=gate?.condition.value||(played?p.activation.trigger.source_role:covered?p.activation.trigger.source_role:observer?(p.activation.trigger.filters.role_any?.[0]||p.activation.trigger.filters.role):p.activation.skill_type==='passive'?p.activation.trigger.destination_any[0]:p.activation.activation_phases[0]),seeded=I.dependencies(card).includes('cover_source_with_guts')?require('./source-cover-tests').setup(catalog,card):I.dependencies(card).includes('reveal_top')?require('./reveal-top-tests').setup(catalog,card):I.dependencies(card).includes('phase_jump')?require('./phase-jump-tests').setup(catalog,card):played?require('./event-played-tests').setup(catalog,card):covered?require('./covered-tests').setup(catalog,card):observer?require('./entry-observer-tests').setup(catalog,card):fixture(card,p,phase,{rich:true,conditioned:true,expanded:true,max:true,key:'positive'},0,catalog),{k,id,entryReason='rule'}=seeded;
   const player=w.actor==='opponent'?1:0;let area,def,target,second;
   if(w.event==='character_entry'){
    const f=w.filters;area=f.role==='side_blocker'?'side:0':['block','center_blocker'].includes(f.role)?'block':f.role&&f.role!=='character'?f.role:f.names?.length?'serve':'attack';
    const other=area==='attack'?(observer&&phase==='toss'?seeded.target:k.top(player,'toss')):area==='toss'?k.top(player,'receive'):null,blockers=area==='block'||area.startsWith('side')?['block','side:0','side:1'].map(z=>k.top(player,z)).filter(Boolean):[];
    def=[...catalog.cards].sort((a,b)=>Number(!!a.profiles[0].program)-Number(!!b.profiles[0].program)).find(c=>{const pr=c.profiles[0],printed=pr.variants[0].printed;return matchesPrinted(pr,{type:'character',...Object.fromEntries(Object.entries(f).filter(([key])=>!['role','entry_origins','entry_keyword_family'].includes(key)))})&&printed.parameters[area.startsWith('side')?'block':area]!=='dash'&&(!other||k.effectiveName(other)!==printed.name)&&!blockers.some(x=>k.effectiveName(x)===printed.name)&&(!area.startsWith('side')||k.top(player,'block')||c.card_no!=='HV-D01-009');});
    assert(def,code);target=k.addCard(def.card_no,player,'hand');if(w.remaining_uses===1)second=k.addCard(def.card_no,player,'hand');if(area.startsWith('side')&&!k.top(player,'block'))k.addCard('HV-D01-009',player,'block');
   }else if(w.event==='hand_added'){def=catalog.cards.find(c=>c.card_no==='HV-D01-009');target=k.addCard(def.card_no,player,'drop');}
   else if(w.event==='block_success'){def=card;target=id;}
   else if(w.event==='source_moved'){def=card;target=id;}
   else {assert.equal(w.event,'loss');for(const move of I.nodes({program:w.then}).filter(n=>['move','retrieve'].includes(n.kind))){def=catalog.cards.find(c=>!c.profiles[0].program&&matchesPrinted(c.profiles[0],move.pool.filters));target=k.addCard(def.card_no,0,move.pool.zone);}}
   const oldChoose=k.choose;k.choose=r=>optionalGuard&&r.kind==='optional'?false:r.effectModes?modeIndex:oldChoose(r);
   const before=k.snapshot(),agent={wantsAck:true,async choose(g,p,r){if(optionalGuard&&r.kind==='skill'&&r.prompt.includes('是否執行'))return false;if(r.ctx?.effectModes)return modeIndex;if(r.kind==='skill')return true;if(r.kind==='guts'||r.kind==='gutsCourt')return r.options.slice(0,r.need).map(o=>o.value);return r.options.find(o=>o.label?.includes('其餘放到牌庫底'))?.value??r.options[0].value;}};
   const g=new E.Game({mode:'strict',seed:7,decks:['k1014','seijoh'],agents:[agent,agent]});
   for(const q of g.players){for(const [host,z]of Object.entries({hand:'hand',deck:'deck',drop:'drop',ev:'event',sets:'sets'}))q[host]=before.zones[q.idx+'.'+z].map(id=>I.short(before.cards[id].cardNo));for(const z of roles)q.area[z]=before.zones[q.idx+'.'+z].map(id=>I.short(before.cards[id].cardNo));}
   g.cardState=null;g.beginTurn(g.players[0]);for(const q of g.players)q.ts.sides=[...before.zones[q.idx+'.side:0'],...before.zones[q.idx+'.side:1']].map(id=>I.short(before.cards[id].cardNo));g.ball={type:before.ball.kind,off:before.ball.offense};g.rulePhase=phases[phase];
   if(played){k.playEvent(seeded.event);await g.resolve(g.players[0],I.short(k.card(seeded.event).cardNo),g.rulePhase);}
   else if(observer){k.enter(seeded.target,phase);await g.enterCharacter(g.players[0],phase,I.short(k.card(seeded.target).cardNo));}
   else if(p.activation.skill_type==='passive'){
    const name=I.nodes(p).find(n=>n.kind==='compare'&&n.field==='source.entry_skill_name')?.value;
    if(name){const event=catalog.cards.find(c=>c.profiles[0].variants[0].printed.name===name),eventId=k.addCard(event.card_no,0,'event');k._atomic(()=>{k._enter(id,0,phase,k._context(eventId,0),'skill');k._drain();});g.players[0].ev.push(I.short(event.card_no));g.place(g.players[0],phase,code);await B.charactersEntered(g,g.players[0],[{key:phase,origin:'hand',reason:'skill',entrySkillName:name}]);}
    else{k.enter(id,phase,{reason:entryReason});await g.enterCharacter(g.players[0],phase,code);}
   }
   else{p.activation.skill_type==='event'?k.playEvent(id):k.useSkill(id);await g.resolve(g.players[0],code,g.rulePhase);}
   if(k.state.turn.step!=='free')k.advancePhase(k.state.turn.phase);
   const owner=g.players[0];if(!['source_moved','block_success'].includes(w.event)){const zone=k.card(id).zone.split('.')[1];k._atomic(()=>k._move(id,0,'drop',k._context(id,0)));g.moveCode(zone==='event'?owner.ev:owner[zone]||owner.area[zone],owner.drop,code);}
   const cleanSides=who=>{for(const z of ['side:0','side:1'])for(const card of [...k.zone(who,z)])k._atomic(()=>k._move(card,who,'drop',k._context(card,who)));if(g.players[who].ts.sides?.length)g.cleanupSides(g.players[who]);};
   if(w.duration==='next_opponent_turn'){cleanSides(0);k.endTurn();k.beginTurn(1);g.finishTurn(owner);g.beginTurn(g.players[1]);}
   if(expired)for(let i=0;i<2;i++){const old=g.turnP;cleanSides(old.idx);k.endTurn();k.beginTurn(1-k.state.turn.player);g.finishTurn(old);g.beginTurn(g.players[k.state.turn.player]);}
   const q=g.players[player],followCode=def?I.short(def.card_no):null;
   if(w.event==='character_entry'){
    k.advancePhase(area.startsWith('side')?'block':area);g.rulePhase=phases[k.state.turn.phase];
    if(w.filters.entry_keyword_family){
     k._atomic(()=>{k._enter(target,player,area,k._context(target,player),'skill',false,false,w.filters.entry_keyword_family);k._drain();});
     g.place(q,area,followCode);await B.charactersEntered(g,q,[{key:area,origin:'hand',reason:'skill',entry_keyword_family:w.filters.entry_keyword_family}]);
     assert.equal(k.parameter(target,'attack'),k.card(target).printed.parameters.attack+(expired?0:1),'Back-attack watch independent expected bonus');
    }else{
    k.enter(target,area.startsWith('side')?'block':area,{side:area.startsWith('side')});
    if(area.startsWith('side')){g.moveCode(q.hand,q.ts.sides ||= [],followCode);await B.charactersEntered(g,q,[{key:'side:0',origin:'hand',reason:'rule'}]);}else await g.enterCharacter(q,area,followCode);
   }
   if(second&&!expired){k.enter(second,'block',{side:true});g.moveCode(q.hand,q.ts.sides,followCode);await B.charactersEntered(g,q,[{key:'side:0',origin:'hand',reason:'rule'}]);assert.equal(q.ts.sides.length,1,'One-use watch must keep the second side blocker');}
   }else if(w.event==='hand_added'){k.resolveProgram({kind:'move_self',destination:'owner.hand'},player,target);await g.sadd(q,followCode,q.drop);}
   else if(w.event==='block_success'){k.advancePhase('block');g.rulePhase='blk';k.notifyHostEvents([{type:'block_success',player,defense:k.state.ball.offense}]);await B.judgment(g,q,'block_success',{defense:g.ball.off});}
   else if(w.event==='source_moved'){const steps=[{kind:'move_self',destination:'owner.drop'},...(historical?[{kind:'move_self',destination:'owner.hand'}]:[])];k.resolveProgram({kind:'sequence',steps},0,id);await B.legacyEffect(g,async()=>{g.moveCode(owner.ev,owner.drop,code);if(historical)g.moveCode(owner.drop,owner.hand,code);});}
   else{k.loss(player);await B.judgment(g,q,'loss');}
   for(const q of g.players){
    for(const [host,z]of Object.entries({hand:'hand',deck:'deck',drop:'drop',ev:'event',sets:'sets'}))assert.deepEqual(q[host],k.zone(q.idx,z).map(id=>I.short(k.card(id).cardNo)),code+' '+w.event+' expiry='+expired+' '+host);
    for(const z of [...roles,'side:0','side:1']){const top=k.top(q.idx,z);const cards=z.startsWith('side')?[q.ts.sides?.[+z.split(':')[1]]].filter(Boolean):q.area[z];assert.equal(cards.at(-1),top?I.short(k.card(top).cardNo):undefined,code+' '+z);if(!top)continue;for(const [param,old]of Object.entries(params))assert.equal(g.parameter(q,z,old),k.parameter(top,param)==='dash'?null:k.parameter(top,param),code+' '+z+'.'+param);}
   }
   // Exported host journals survive JSON round-tripping, including a consumed one-use watch.
   g.sharedRulesState=JSON.parse(JSON.stringify(g.sharedRulesState));B.assertReady(g);cases++;
  }
 }
 assert.equal(cases,82);
 const g=new E.Game({seed:7,decks:['k1014','seijoh'],agents:[E.AI,E.AI]}),p=g.players[0];g.beginTurn(p);
 const state=g.cardSnapshot(),id=state.zones['0.deck'].at(-1);g.moveCard(p.deck,p.ev,p.deck.length-1);
 const base={kind:'watch',actor:0,source:{id,incarnation:0},duration:{kind:'this_turn',turn:g.turnNo}};
 g.sharedRulesState={version:1,fingerprint:require('./runtime-data.json').fingerprint,effects:[{...base,event:'source_moved'}],next:1,receipts:[]};
 g.moveCard(p.ev,p.drop,p.ev.length-1);assert.equal(g.sharedRulesEvents.length,1);assert.equal(g.sharedRulesEvents[0].from_zone,'event');assert.equal(g.sharedRulesEvents[0].to_zone,'drop');
 // Probe generic draw notifications directly; an incomplete mock watch is
 // not a valid committed journal for the public draw command.
 g.sharedRulesEvents=[];g.sharedRulesState.effects=[];g.draw(p);const drawn=g.cardReference(p,'hand').id;
 g.sharedRulesState.effects=[{...base,event:'hand_added',filters:{}}];B.drawn(g,p,drawn,g.cardState.revision);assert.equal(g.sharedRulesEvents.length,1);assert.equal(g.sharedRulesEvents[0].operation,'draw');
 const skipDraw=require('./runtime-data.json').catalog.cards.flatMap(c=>c.profiles.flatMap(p=>I.nodes(p))).find(n=>n.kind==='watch'&&n.event==='hand_added'&&n.filters?.exclude_operations?.includes('draw'));assert(skipDraw);
 g.sharedRulesEvents=[];g.sharedRulesState.effects=[{...structuredClone(skipDraw),...base,event:'hand_added',duration:{kind:skipDraw.duration,createdTurn:g.turnNo-1,player:0,activeTurn:g.turnNo}}];B.assertReady(g);g.draw(p);assert.equal(g.sharedRulesEvents.length,0);
 console.log('watch live: '+cases+' generated-event/expiry cases; all zones and parameters match core');
})().catch(e=>{console.error(e);process.exitCode=1;});
