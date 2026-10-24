/* 策略 AI 對戰評測：node match-ai-bench.js [局數/校=2] [對手=base|ai]
   10 校牌組輪流對戰，雙方換邊；回報勝率、例外、每步耗時。 */
'use strict';
const {Match}=require('./rules/match'),H=require('./host-choice'),AI=require('./match-ai'),CL=require('./card-library');
const N=Number(process.argv[2]||2),OPP=process.argv[3]||'base';
const schools=['烏野','音駒','青葉城西','稲荷崎','白鳥沢','伊達工業','梟谷','ユース','角川','条善寺'],all=Object.values(CL.data.cards).filter(c=>c.playable);
function deck(s,o){const cs=all.filter(c=>c.schoolTags.includes(s)),ev=cs.filter(c=>c.kind==='E').slice(0,4).flatMap(c=>[c.code,c.code]),ch=cs.filter(c=>c.kind==='C').sort((a,b)=>(b.hasSkill-a.hasSkill)||a.code.localeCompare(b.code)),d=[...ev];for(let i=o;d.length<40;i++)d.push(ch[i%ch.length].code);return d;}
let wins=0,games=0,errors=[],aiMs=0,aiN=0,aiMax=0;const kinds={},acts={block:0,receive:0,event:0,eventPass:0,payYes:0,payNo:0};
for(let g=0;g<N*10;g++){
 const a=schools[g%10],b=schools[(g*3+1)%10],aiSide=g%2;
 try{
  const m=new Match({id:'b',seed:g*7919+13,decks:aiSide===0?[deck(a,g),deck(b,g)]:[deck(b,g),deck(a,g)]});
  for(let i=0;;i++){
   const r=m.request(0)||m.request(1);if(!r)break;if(i>4000)throw Error('STALL');
   let ans;
   if(r.actor===aiSide){const t=Date.now();ans=AI.answer(m,r);const dt=Date.now()-t;aiMs+=dt;aiN++;aiMax=Math.max(aiMax,dt);(kinds[r.kind]??={n:0,ms:0}).n++;const v=ans.value;if(r.kind==='defend')acts[v]++;if(r.kind==='event')v===null?acts.eventPass++:acts.event++;if(['activate_payment','optional'].includes(r.kind))v?acts.payYes++:acts.payNo++;kinds[r.kind].ms+=dt;}
   else ans=OPP==='ai'?AI.answer(m,r):H.aiAnswer(r);
   m.command({kind:'answer',answer:ans});
  }
  if(m._m.phase!=='finished')throw Error('NOT_FINISHED');
  games++;if(m._m.winner===aiSide)wins++;
 }catch(e){errors.push({g,error:e.message,stack:String(e.stack).split('\n').slice(1,4).join(' | ')});}
}
const slow=Object.entries(kinds).map(([k,v])=>[k,v.n,Math.round(v.ms/v.n)]).sort((x,y)=>y[2]-x[2]).slice(0,8);
console.log(JSON.stringify({games,wins,winRate:+(wins/Math.max(games,1)).toFixed(3),errors:errors.slice(0,3),errorCount:errors.length,aiAvgMs:Math.round(aiMs/Math.max(aiN,1)),aiMaxMs:aiMax,acts,slowKinds:slow}));
