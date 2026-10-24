/* Full-deck native-core smoke runner. node rules/table-qa.js [seeds per pairing] [--varied] */
'use strict';
const {Match}=require('./match'),H=require('../host-choice'),CL=require('../card-library');
const schools=['烏野','音駒','青葉城西','稲荷崎','白鳥沢','伊達工業','梟谷','ユース','角川','条善寺'],n=Number(process.argv.slice(2).find(a=>!a.startsWith('--'))||1),varied=process.argv.includes('--varied'),kinds={};
if(!Number.isSafeInteger(n)||n<1)throw Error('Seeds per pairing must be a positive integer');
function deck(school,seed){const offset=varied?seed*13:seed;const cards=Object.values(CL.data.cards).filter(c=>c.playable&&c.schoolTags.includes(school)),chars=cards.filter(c=>c.kind==='C').sort((a,b)=>(b.hasSkill-a.hasSkill)||a.code.localeCompare(b.code)),pool=cards.filter(c=>c.kind==='E'),events=Array.from({length:Math.min(4,pool.length)},(_,i)=>pool[(i+(varied?seed*3:0))%pool.length]).flatMap(c=>[c.code,c.code]),out=[...events];for(let i=0;out.length<40;i++)out.push(chars[(i+offset)%chars.length].code);return out;}
function rng(seed){let word=seed>>>0;return()=>{word=(word+0x6D2B79F5)>>>0;let t=word;t=Math.imul(t^t>>>15,1|t);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function diverseAnswer(m,r,random){
 const pick=xs=>xs[Math.floor(random()*xs.length)],shuffle=xs=>{const a=[...xs];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
 let value;
 if(r.input.type==='ack')value=true;
 else if(r.input.type==='cards'){const count=r.input.min+Math.floor(random()*(r.input.max-r.input.min+1));value=shuffle(r.options).slice(0,count).map(o=>o.value);}
 else if(r.input.type==='block'){
  let cards=[];const wanted=1+Math.floor(random()*r.input.max);
  for(const o of shuffle(r.options)){const next={cards:[...cards,o.value],center:cards[0]||o.value};if(H.checkValue(r,next).ok&&m._blockLegal(r.actor,next))cards=next.cards;if(cards.length===wanted)break;}
  value={cards,center:pick(cards)};
 }else value=pick(r.options).value;
 const answer=H.makeAnswer(r,value);if(!H.validate(r,answer).ok)throw Error('TEST_POLICY_INVALID: '+r.kind);return answer;
}
let games=0,decisions=0;const errors=[];
for(const a of schools)for(const b of schools)for(let seed=0;seed<n;seed++){
 let m;const random=rng(seed*7919+schools.indexOf(a)*101+schools.indexOf(b)*1009+1);try{
  m=new Match({id:'qa',seed:seed*7919+1,decks:[deck(a,seed),deck(b,seed)],mode:seed%2?'numeric':'strict',wantsAck:[true,true]});
  for(let i=0;;i++){
   const r=m.request(0)||m.request(1);if(!r)break;if(i>=4000)throw Error('STALL');kinds[r.kind]=(kinds[r.kind]||0)+1;
   m.command({kind:'answer',answer:varied?diverseAnswer(m,r,random):H.aiAnswer(r)});decisions++;
  }
  const s=m.snapshot();if(s.match.phase!=='finished')throw Error('Not finished');m._kernel.assertState();if(Object.keys(s.cards).length!==80)throw Error('Identity count');for(const p of [0,1])if(Object.values(s.cards).filter(c=>c.owner===p).length!==40)throw Error('Owner count');games++;
 }catch(e){errors.push({a,b,seed,error:e.message,pc:m?.snapshot().match.pc,kind:(m?.request(0)||m?.request(1))?.kind,stack:e.stack});}
}
console.log(JSON.stringify({games,decisions,varied,errors,kinds},null,2));if(errors.length)process.exitCode=1;
