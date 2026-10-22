'use strict';
const assert=require('node:assert/strict'),E=require('../engine'),T=require('./self-cover-tests'),C=require('./covered-tests'),I=require('./node-inventory'),catalog=require('./data/cards.json');
const params={serve:'srv',block:'blk',receive:'rcv',toss:'tos',attack:'atk'};
function compare(g,k,label){for(const p of g.players){for(const[h,z]of Object.entries({hand:'hand',deck:'deck',drop:'drop',ev:'event',sets:'sets',...Object.fromEntries(Object.keys(params).map(z=>[z,z]))}))assert.deepEqual(p.area[h]||p[h],k.zone(p.idx,z).map(id=>I.short(k.card(id).cardNo)),label+' '+h);assert.deepEqual(p.ts.sides||[],['side:0','side:1'].flatMap(z=>k.zone(p.idx,z).map(id=>I.short(k.card(id).cardNo))));for(const z of [...Object.keys(params),...(p.ts.sides||[]).map((_,i)=>'side:'+i)]){const top=k.top(p.idx,z);if(top)for(const[param,old]of Object.entries(params))assert.equal(g.parameter(p,z,old),k.parameter(top,param)==='dash'?null:k.parameter(top,param),label+' '+z+'.'+param);}}}
(async()=>{let n=0;
 for(const code of ['PR-001','PR-002'])for(const mode of ['positive','mismatch','empty','rename','rename_away','from_drop','centre','side']){
  const card=catalog.cards.find(c=>c.card_no==='HV-'+code),{k,id,old,dest}=T.setup(catalog,card,['mismatch','rename','side'].includes(mode)?'mismatch':mode==='empty'?'empty':'positive',['centre','side'].includes(mode)?'block':'receive');
  const name=mode==='rename'?card.profiles[0].activation.trigger.filters.covered_names[0]:mode==='rename_away'?'別の名前':null;if(name)k.effect('rename',{target:k.reference(old),name},k._context(old,0));if(mode==='from_drop')k._move(id,0,'drop',k._context(id,0));
  const centre=mode==='side'?k.addCard('HV-D01-009',0,'hand'):id;
  k.choose=r=>r.kind==='parameter'?'attack':require('./frequent-node-tests').choose(r);
  const agent={wantsAck:true,async choose(g,p,r){if(r.kind==='parameter')return 'atk';return r.options[0].value;}},g=new E.Game({seed:7,mode:'strict',decks:['k1014','seijoh'],agents:[agent,agent]});C.install(g,k);if(name)g.effect(g.players[0],dest).name=name;
  if(['centre','side'].includes(mode)){
   const list=mode==='side'?[centre,id]:[id],codes=list.map(id=>I.short(k.card(id).cardNo));k.enterBlock(list,centre);const stop=new Error('AFTER_BLOCK_ENTRY');g.eventLoop=async()=>{throw stop;};await assert.rejects(g.blockTurn(g.players[0],[g.evalBlock(g.players[0],codes,1)]),e=>e===stop);
  }else{k.enter(id,dest,{reason:mode==='from_drop'?'skill':'rule'});await g.enterCharacter(g.players[0],dest,code,mode==='from_drop');}
  compare(g,k,code+' '+mode);n++;
 }
 console.log('self-entry-cover live: '+n+' complete core/host comparisons, effective-name snapshots, effect entry and actual blockTurn centre/side passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
