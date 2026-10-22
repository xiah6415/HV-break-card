'use strict';
const assert=require('node:assert/strict'),E=require('../engine'),I=require('./node-inventory'),{fixture}=require('./batch-smoke'),{testModules}=require('./modules');
const catalog=require('./data/cards.json'),released=testModules(catalog).cards,roles=['serve','block','receive','toss','attack'],params={serve:'srv',block:'blk',receive:'rcv',toss:'tos',attack:'atk'};
(async()=>{
 for(const code of Object.keys(released)){
  const card=catalog.cards.find(c=>I.short(c.card_no)===code),p=card.profiles[0],observer=p.activation.trigger?.event==='character_entry',deckMove=!p.formal_cost&&I.dependencies(card).includes('move_self')&&I.dependencies(card).includes('deck_selection');
  let phase=p.activation.skill_type==='permanent_entry_name'?'attack':observer?(p.activation.trigger.filters.role_any?.[0]||p.activation.trigger.filters.role):p.activation.skill_type==='passive'?p.activation.trigger.destination_any[0]:p.activation.activation_phases[0];if(phase==='block')phase='block';
  const seed=I.dependencies(card).includes('enter')?require('./enter-node-tests').seedCard(catalog,card):observer?require('./entry-observer-tests').setup(catalog,card):deckMove?require('./node-module-tests').deckFixture(catalog,I.nodes(p).find(n=>n.kind==='deck_selection')):fixture(card,p,phase,{rich:true,conditioned:true,expanded:true,max:true,key:'positive'},0,catalog);
  if(deckMove){seed.id=seed.k.addCard(card.card_no,0,'hand');seed.k.state.turn.phase=phase;seed.k.state.ball={kind:'attack',offense:8,owner:1};}
  const {k,id,target,side=false,entryReason='rule'}=seed,before=k.snapshot();
  const multiple=I.nodes(p).filter(n=>n.kind==='move'&&n.count>1&&n.pool.zone.endsWith('.guts')).map(n=>({node:n,ids:k.pool(n.pool,k._context(id,0))})),picked=[];
  const agent={wantsAck:true,async choose(g,p,r){if(r.kind==='skill')return true;if(r.kind==='guts'||r.kind==='gutsCourt')return r.options.slice(0,r.need).map(o=>o.value);const value=r.options.find(o=>o.label?.includes('其餘放到牌庫底'))?.value??r.options[0].value;if(r.prompt?.includes('確認全部後才搬牌'))picked.push(value);return value;}};
  const oldChoose=k.choose;k.choose=r=>r.kind==='name'||r.effectModes?r.options[0]:oldChoose(r);
  const g=new E.Game({mode:'strict',seed:7,decks:['k1014','seijoh'],agents:[agent,agent]});
  for(const q of g.players){for(const [host,z]of Object.entries({hand:'hand',deck:'deck',drop:'drop',ev:'event',sets:'sets'}))q[host]=before.zones[q.idx+'.'+z].map(id=>I.short(before.cards[id].cardNo));for(const z of roles)q.area[z]=before.zones[q.idx+'.'+z].map(id=>I.short(before.cards[id].cardNo));}
  g.cardState=null;g.beginTurn(g.players[0]);for(const q of g.players)q.ts.sides=[...before.zones[q.idx+'.side:0'],...before.zones[q.idx+'.side:1']].map(id=>I.short(before.cards[id].cardNo));g.ball={type:before.ball.kind,off:before.ball.offense};g.rulePhase={serve:'srv',block:'blk',draw:'drw',receive:'rcv',toss:'tos',attack:'atk'}[phase];
  if(seed.entryBoost?.length){const place=g.place;g.place=function(q,area,c){const result=place.call(this,q,area,c);if(q.idx===0&&c===code)for(const b of seed.entryBoost)this.boostParameter(q,area,params[b.parameter],b.value);return result;};}
  if(observer){k.enter(target,phase);await g.enterCharacter(g.players[0],phase,I.short(k.card(target).cardNo));}
  else if(['passive','permanent_entry_name'].includes(p.activation.skill_type)){
   const name=I.nodes(p).find(n=>n.kind==='compare'&&n.field==='source.entry_skill_name')?.value;
   if(name){
    const event=catalog.cards.find(c=>c.profiles[0].variants[0].printed.name===name),eventId=k.addCard(event.card_no,0,'event');
    k._atomic(()=>{k._enter(id,0,phase,k._context(eventId,0),'skill');k._drain();});
    g.players[0].ev.push(I.short(event.card_no));g.place(g.players[0],phase,code);
    await require('./legacy').charactersEntered(g,g.players[0],[{key:phase,origin:'hand',reason:'skill',entrySkillName:name}]);
   }else{k.enter(id,phase,{reason:entryReason,side});if(side){g.players[0].hand.splice(g.players[0].hand.indexOf(code),1);g.players[0].ts.sides.push(code);await require('./legacy').charactersEntered(g,g.players[0],[{key:'side:0',origin:'hand',reason:'rule'}]);}else await g.enterCharacter(g.players[0],phase,code);}
  }
  else {{const ID=require('./identity'),state=ID.ensure(g);for(const q of g.players)for(const z of roles){const src=before.zones[q.idx+'.'+z],dst=state.zones[q.idx+'.'+z];src.forEach((x,i)=>{const c=before.cards[x];if(c.entryTurn!==undefined&&dst[i]){const h=state.cards[dst[i]];h.entryOrigin=c.entryOrigin;h.entryReason=c.entryReason;h.entryTurn=c.entryTurn-before.turn.id+Math.max(1,g.turnNo);}});}}/* 主機實體帶入核心登場來源／回合（PR-084） */p.activation.skill_type==='event'?k.playEvent(id):k.useSkill(id);await g.resolve(g.players[0],code,g.rulePhase);}
  for(const {node,ids}of multiple){const count=Math.min(node.count,ids.length);assert.equal(ids.filter(x=>k.card(x).zone.endsWith('.drop')).length,count,code+' must move the full selected quantity');assert.equal(picked.length,count,code+' host must collect every card choice');assert.equal(new Set(picked).size,count,code+' cannot select the same physical card twice');}
  if(side)assert.equal(require('./legacy').blockEntered(g,g.players[0]),2,code+' counts original side entry and skill replacement');
  for(const q of g.players){
   for(const [host,z]of Object.entries({hand:'hand',deck:'deck',drop:'drop',ev:'event',sets:'sets'}))assert.deepEqual(q[host],k.zone(q.idx,z).map(id=>I.short(k.card(id).cardNo)),code+' '+host);
   assert.deepEqual(q.ts.sides,['side:0','side:1'].map(a=>k.top(q.idx,a)).filter(Boolean).map(id=>I.short(k.card(id).cardNo)),code+' side identities');
   for(const area of [...roles,...q.ts.sides.map((_,i)=>'side:'+i)]){const top=k.top(q.idx,area);if(!top)continue;assert.equal(g.cardName(q,area).normalize('NFKC').replace(/\s/g,''),k.effectiveName(top),code+' '+area+' name');for(const [parameter,old]of Object.entries(params))assert.equal(g.parameter(q,area,old),k.parameter(top,parameter)==='dash'?null:k.parameter(top,parameter),code+' '+area+'.'+parameter);}
  }
 }
 console.log('live frequent batch: '+Object.keys(released).length+' cards; persistent-core vs public-game zones and all parameters passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
