/* Full-deck native-core smoke runner. node rules/table-qa.js [seeds per pairing] */
'use strict';
const {Match}=require('./match'),H=require('../host-choice'),CL=require('../card-library');
const schools=['烏野','音駒','青葉城西','稲荷崎','白鳥沢','伊達工業','梟谷','ユース','角川','条善寺'],n=+(process.argv[2]||1),kinds={};
function deck(school,seed){const cards=Object.values(CL.data.cards).filter(c=>c.playable&&c.schoolTags.includes(school)),chars=cards.filter(c=>c.kind==='C').sort((a,b)=>(b.hasSkill-a.hasSkill)||a.code.localeCompare(b.code)),events=cards.filter(c=>c.kind==='E').slice(0,4).flatMap(c=>[c.code,c.code]),out=[...events];for(let i=0;out.length<40;i++)out.push(chars[(i+seed)%chars.length].code);return out;}
let games=0,decisions=0;const errors=[];
for(const a of schools)for(const b of schools)for(let seed=0;seed<n;seed++){
 let m;try{
  m=new Match({id:'qa',seed:seed*7919+1,decks:[deck(a,seed),deck(b,seed)],mode:seed%2?'numeric':'strict',wantsAck:[true,true]});
  for(let i=0;;i++){
   const r=m.request(0)||m.request(1);if(!r)break;if(i>=4000)throw Error('STALL');kinds[r.kind]=(kinds[r.kind]||0)+1;
   m.command({kind:'answer',answer:H.aiAnswer(r)});decisions++;
  }
  const s=m.snapshot();if(s.match.phase!=='finished')throw Error('Not finished');m._kernel.assertState();if(Object.keys(s.cards).length!==80)throw Error('Identity count');for(const p of [0,1])if(Object.values(s.cards).filter(c=>c.owner===p).length!==40)throw Error('Owner count');games++;
 }catch(e){errors.push({a,b,seed,error:e.message,pc:m?.snapshot().match.pc,kind:(m?.request(0)||m?.request(1))?.kind,stack:e.stack});}
}
console.log(JSON.stringify({games,decisions,errors,kinds},null,2));if(errors.length)process.exitCode=1;
