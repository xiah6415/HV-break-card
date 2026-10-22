'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const L=require('./card-library'),E=require('./engine'),DT=require('./deck-tools'),bridge=require('./rules/legacy');
const catalog=require('./rules/data/cards.json'),assets=require('./library/assets.json'),old=require('./card-support.json').cards;
const added=Object.values(L.data.cards).filter(c=>c.playable&&c.status==='basic'&&!Object.hasOwn(old,c.code));
const digest=(data,algo='sha256')=>crypto.createHash(algo).update(data).digest('hex');
const sampleCodes=['P03-004','P03-022','P01-014','P01-001','P01-009','P01-024','P02-022','P02-032','P03-008','P03-018'];
const sample={name:'新卡測試：無技能角色',cards:Object.fromEntries(sampleCodes.map(c=>[c,4]))};
(async()=>{
 assert.deepEqual(L.data.counts,{cards:541,profiles:545,playable:510,basic:183,locked:31});
 assert.equal(added.length,165);assert.equal(Object.keys(E.DEF).length,541);assert.equal(bridge.approvals.length,320);
 assert.equal(require('./rules/runtime-data.json').catalog.cards.length,541);
 for(const [p,sha] of Object.entries(L.data.sources))assert.equal(digest(fs.readFileSync(p)),sha);
 let versions=0,aliases=0;
 for(const card of catalog.cards){
  const m=L.card(card.card_no);assert(m);assert.equal(m.versions.length,card.profiles.length);versions+=m.versions.length;
  for(const profile of card.profiles)for(const v of profile.variants){assert.equal(L.code(v.image_file),m.code);aliases++;}
  const b=fs.readFileSync(assets.images[m.code].file);assert.equal(digest(b),assets.images[m.code].sha256);assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');
  if(assets.images[m.code].origin==='pinned_source')assert.equal(digest(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b]),'sha1'),assets.images[m.code].source_blob_sha1);
  if(!m.playable){assert(Object.hasOwn(E.DEF,m.code));assert.throws(()=>DT.parseDeck({cards:{[m.code]:40}},E.DEF),/尚未開放/);assert.throws(()=>DT.parseDeck({cards:{[m.code]:40}},{...E.DEF,[m.code]:m.definition}),/尚未開放/);}
 }
 assert.equal(versions,545);assert.equal(aliases,713);
 for(const m of added){
  const source=catalog.cards.find(c=>c.card_no===m.number),p=source.profiles[0].variants[0].printed;
  assert.equal(source.profiles.length,1);assert.equal(source.profiles[0].program,null);assert.equal(m.kind,'C');assert.equal(E.DEF[m.code][10],'');
  assert.deepEqual(E.DEF[m.code].slice(2,7),['serve','block','receive','toss','attack'].map(k=>p.parameters[k]==='dash'?null:p.parameters[k]));
  assert.deepEqual(m.schoolTags,p.affiliation_tags);assert.deepEqual(m.yearTags,p.year_tags);assert.deepEqual(m.positionTags,p.position_tags);
  assert.equal(E.isHin(m.code),p.name==='日向翔陽');assert(require('./rules/runtime-data.json').catalog.cards.some(c=>c.card_no===m.number),'new card has host identity');
  assert.deepEqual(DT.parseDeck({c:[[m.versions[0].images[0],40]]},E.DEF).cards,{[m.code]:40});
 }
 for(const key of ['__proto__','constructor','toString','P03-004-FAKE.webp','HV-P04-093'])assert.throws(()=>DT.parseDeck({c:[[key,40]]},E.DEF),/尚未收錄|尚未開放/);
 assert.equal(L.code(' hv-p03-004-n.webp '),'P03-004');assert.equal(L.code('HVBP-002'),'BP-002');
 assert(E.hasSchool('P03-004','烏野'));assert(!E.hasSchool('P03-004','ユース'));assert(E.hasSchool('P03-022','ユース'));assert(E.hasSchool('P03-022','稲荷崎'));assert(!E.hasSchool('P03-015','白鳥沢'));assert(E.hasYear('PR-057',2));
 const names={};for(const m of Object.values(L.data.cards).filter(c=>c.playable)){(names[m.printedName]??=new Set).add(E.nm(m.code));}assert(Object.values(names).every(s=>s.size===1),'same printed name must never differ in whitespace');
 assert.equal(L.search('月島螢 P03-004','playable').length,1);assert.equal(L.search('','locked').length,31);assert.equal(L.search('','playable').length,510);
 for(const cards of [{...sample.cards,'P03-004':3},{'P01-001':40.5},{'P04-093':40},{'HV-P03-004-N.webp':40},{'P01-078':9,'P01-001':31}]){
  E.DECKS.invalid={name:'invalid',cards};assert.throws(()=>new E.Game({decks:['invalid','seijoh'],agents:[E.AI,E.AI]}));
 }delete E.DECKS.invalid;
 assert.deepEqual(DT.parseDeck(DT.exportDeck(sample),E.DEF),sample);E.DECKS.library=sample;
  const seen=new Set();let games=0;
 for(let seed=0;seed<200;seed++){
  const cards=seed<20?Object.fromEntries(Array.from({length:10},(_,i)=>[added[(seed*10+i)%added.length].code,4])):sample.cards;
  E.DECKS.library={name:sample.name,cards};
  const g=new E.Game({seed,decks:['library',seed%2?'seijoh':'library'],agents:[E.AI,E.AI]});await g.run();games++;
  assert(g.winner);const physical=g.cardSnapshot();assert.equal(Object.keys(physical.cards).length,80);
  for(const p of g.players){const actual=Object.values(physical.cards).filter(c=>c.owner===p.idx).map(c=>c.code).sort();const expected=Object.entries(E.DECKS[p.deckKey].cards).flatMap(([c,n])=>Array(n).fill(c)).sort();assert.deepEqual(actual,expected);actual.forEach(c=>seen.add(c));}
 }
 assert(added.every(c=>seen.has(c.code)),'every added card must occur in a completed real game');
 // Real shared target, exact affiliation and legacy printed-name recovery with new cards.
 function setup(choose){const g=new E.Game({seed:7,decks:['k1014','seijoh'],agents:[{choose,wantsAck:true},E.AI]});for(const p of g.players){for(const k of ['deck','hand','drop','sets','ev'])p[k]=[];for(const a in p.area)p.area[a]=[];}g.beginTurn(g.players[0]);return [g,g.players[0]];}
 {
  const [g,p]=setup(async(g,p,r)=>r.kind==='target'?'receive':r.options[0].value);p.area.receive=['P03-004'];p.hand=['P01-013'];p.ts.receiver='P03-004';p.ts.rcv=3;await g.resolve(p,'P01-013','rcv');assert.equal(g.parameter(p,'receive','rcv'),5);assert.deepEqual(p.drop,['P01-013']);
 }
 {
  const [g,p]=setup(async(g,p,r)=>r.options[0].value);p.area.receive=['P03-004'];p.area.attack=['P03-022'];assert(!g.uniformCourt(p));p.area.receive=['P03-022'];assert(g.uniformCourt(p));assert(p.allSchool('ユース'));
 }
 {
  const [g,p]=setup(async(g,p,r)=>r.kind==='retrieve'?'PR-005':r.options[0].value);p.hand=['PR-029'];p.drop=['PR-005'];assert(E.isHin('PR-005'));assert(g.playable(p,'drw').some(c=>c.card==='PR-029'));await g.resolve(p,'PR-029','drw');assert.deepEqual(p.hand,['PR-005']);
 }
 delete E.DECKS.library;
 console.log(JSON.stringify({passed:true,added:added.length,images:541,profiles:versions,sourceRecords:aliases,realGames:games,newCardsInGames:added.filter(c=>seen.has(c.code)).length,approvals:bridge.approvals.length}));
})().catch(e=>{console.error(e);process.exitCode=1;});
