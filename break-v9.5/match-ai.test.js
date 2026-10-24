'use strict';
/* 策略 AI 契約測試（Claude 2026-10-24）：
   1. 每個回答都通過 host-choice 驗證，對局一定終局；2. AI 思考不改變對局（snapshot 前後相同、epoch 不變）；
   3. 對基礎合法 AI 明顯佔優；4. 會實際攔網與使用 Event。 */
const assert=require('node:assert/strict'),{Match}=require('./rules/match'),H=require('./host-choice'),AI=require('./match-ai'),CL=require('./card-library');
const schools=['烏野','音駒','青葉城西','稲荷崎','白鳥沢','伊達工業','梟谷','ユース','角川','条善寺'],all=Object.values(CL.data.cards).filter(c=>c.playable);
function deck(s,o){const cs=all.filter(c=>c.schoolTags.includes(s)),ev=cs.filter(c=>c.kind==='E').slice(0,4).flatMap(c=>[c.code,c.code]),ch=cs.filter(c=>c.kind==='C').sort((a,b)=>(b.hasSkill-a.hasSkill)||a.code.localeCompare(b.code)),d=[...ev];for(let i=o;d.length<40;i++)d.push(ch[i%ch.length].code);return d;}
let wins=0,blocks=0,events=0,checked=0;const G=10;
for(let g=0;g<G;g++){
 const aiSide=g%2,m=new Match({id:'t',seed:g*104729+7,decks:[deck(schools[g%10],g),deck(schools[(g+4)%10],g)],mode:g%3===2?'numeric':'strict'});
 for(let i=0;;i++){
  const r=m.request(0)||m.request(1);if(!r)break;assert(i<4000,'stall');
  let ans;
  if(r.actor===aiSide){
   const before=JSON.stringify(m.snapshot()),epoch=m.epoch;ans=AI.answer(m,r);
   if(i%7===0){assert.equal(JSON.stringify(m.snapshot()),before,'AI must not mutate the match');assert.equal(m.epoch,epoch);checked++;}
   assert(H.validate(r,ans).ok,'AI answer must validate: '+r.kind);
   if(r.kind==='defend'&&ans.value==='block')blocks++;if(r.kind==='event'&&ans.value!==null)events++;
  }else ans=H.aiAnswer(r);
  m.command({kind:'answer',answer:ans});
 }
 assert.equal(m._m.phase,'finished');if(m._m.winner===aiSide)wins++;
}
assert(wins>=8,'strategy AI should clearly beat the baseline: '+wins+'/'+G);
assert(blocks>0,'AI must block sometimes');assert(events>0,'AI must play Events');assert(checked>20);
console.log(`match AI: ${wins}/${G} wins vs baseline, ${blocks} blocks, ${events} Events, ${checked} non-mutation checks; every answer validated`);
