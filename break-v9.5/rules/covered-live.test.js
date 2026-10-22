'use strict';
const assert=require('node:assert/strict'),E=require('../engine'),T=require('./covered-tests'),I=require('./node-inventory'),B=require('./legacy'),catalog=require('./data/cards.json');
const params={serve:'srv',block:'blk',receive:'rcv',toss:'tos',attack:'atk'};
function compare(g,k,label){for(const p of g.players){for(const[h,z]of Object.entries({hand:'hand',deck:'deck',drop:'drop',ev:'event',sets:'sets',...Object.fromEntries(Object.keys(params).map(z=>[z,z]))})){const actual=p.area[h]||p[h];assert.deepEqual(actual,k.zone(p.idx,z).map(id=>I.short(k.card(id).cardNo)),label+' '+p.idx+'.'+h);}for(const z of Object.keys(params)){const top=k.top(p.idx,z);if(top)for(const [param,old]of Object.entries(params))assert.equal(g.parameter(p,z,old),k.parameter(top,param)==='dash'?null:k.parameter(top,param),label+' '+z+'.'+param);}}}
(async()=>{
 let count=0;
 const fixtures=catalog.cards.filter(c=>c.profiles[0].activation?.trigger?.event==='source_covered').flatMap(card=>['positive','mismatch','decline','short'].map(mode=>({f:T.setup(catalog,card,mode),mode,label:card.card_no+' '+mode}))).concat([['P01-028','P01-025'],['P01-023','P02-061'],['P04-048','P04-046']].flatMap(([code,entrant])=>[true,false].map(ownFirst=>({f:T.chain(catalog,code,entrant,ownFirst),mode:'positive',label:code+' '+ownFirst}))));
 for(const {f,mode,label}of fixtures){const{k,id,target,dest}=f,code=I.short(k.card(target).cardNo),name=f.entrant?catalog.cards.find(c=>c.card_no==='HV-'+(f.ownFirst?f.entrant:I.short(k.card(id).cardNo))).display_name:null,requests=[];
  const agent={wantsAck:true,async choose(g,p,r){requests.push(r);if(r.kind==='skill')return mode!=='decline';if(r.kind==='guts')return r.options.slice(0,r.need).map(o=>o.value);if(name&&r.prompt?.includes('同時觸發'))return r.options.find(o=>o.label.includes(name)).value;return r.options[0].value;}};
  const g=new E.Game({mode:'strict',seed:7,decks:['k1014','seijoh'],agents:[agent,agent]});T.install(g,k);
  k.enter(target,dest);await g.enterCharacter(g.players[0],dest,code);compare(g,k,label);
  const before=JSON.stringify(g.cardSnapshot());await B.charactersEntered(g,g.players[0],[{key:dest}]);assert.equal(JSON.stringify(g.cardSnapshot()),before,'Repeated receipt cannot resolve twice');
  if(f.entrant)assert(requests.some(r=>r.prompt?.includes('同時觸發')),'Real host offers trigger ordering');count++;
 }
 // Receiver prediction accounts for the covered Yaku without touching the real table.
 {const card=catalog.cards.find(c=>c.card_no==='HV-P01-023'),f=T.setup(catalog,card),agent=E.AI,g=new E.Game({seed:7,mode:'strict',decks:['k1014','seijoh'],agents:[agent,agent]});T.install(g,f.k);const before=JSON.stringify(g.cardSnapshot()),code=I.short(f.k.card(f.target).cardNo),base=f.k.card(f.target).printed.parameters.receive;assert.equal(B.entryPreview(g,g.players[0],code,'receive','rcv').value,base+2);assert.equal(JSON.stringify(g.cardSnapshot()),before);g.moveCode(g.players[0].area.receive,g.players[0].drop,'P01-023');const empty=JSON.stringify(g.cardSnapshot());assert.equal(B.entryPreview(g,g.players[0],code,'receive','rcv').value,base,'Empty receiver zone previews the printed value');assert.equal(JSON.stringify(g.cardSnapshot()),empty);}
 console.log('covered live: '+count+' core/host cases, both real skill orders, no duplicate receipt and pure receiver prediction passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
