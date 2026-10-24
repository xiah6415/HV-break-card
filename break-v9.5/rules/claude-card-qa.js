/* Claude 逐卡實戰巡檢（單一狀態 Match）。2026-10-24
   每張技能卡 4 張放進同校牌組（不足 40 張以他校角色補滿），AI／隨機策略互打；
   檢查例外、卡死、未終局、80 實體／各 40 張守恆，以及「技能實際被用到」；
   每局在隨機決策點做一次 snapshot→answer→restore→answer 重播，比對結果須逐位元相同（Undo 決定性）。
   用法：node rules/claude-card-qa.js [每張局數=3] [只跑卡號,逗號分隔] */
'use strict';
const {Match}=require('./match'),H=require('../host-choice'),CL=require('../card-library');
const N=Number(process.argv[2]||3),ONLY=process.argv[3]?new Set(process.argv[3].split(',')):null;
const all=Object.values(CL.data.cards).filter(c=>c.playable),PARTNERS=JSON.parse(process.env.PARTNERS||'{}');
const targets=all.filter(c=>c.hasSkill&&(!ONLY||ONLY.has(c.code)));
function rng(seed){let w=seed>>>0;return()=>{w=(w+0x6D2B79F5)>>>0;let t=w;t=Math.imul(t^t>>>15,1|t);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function deck(card,seed){
 const school=card.schoolTags[0],same=all.filter(c=>c.code!==card.code&&c.schoolTags.includes(school));
 const out=Array(4).fill(card.code),count=c=>out.filter(x=>x===c).length;
 let events=card.kind==='E'?4:0;
 // 搭檔卡（環境變數 PARTNERS={"卡號":[搭檔...]}）：各 4 張，讓組合條件型技能有機會觸發
 for(const c of (PARTNERS[card.code]||[])){const e=CL.data.cards[c].kind==='E';for(let i=0;i<4&&(!e||events<8);i++){out.push(c);if(e)events++;}}
 for(const e of same.filter(c=>c.kind==='E'))for(let i=0;i<2&&events<8;i++){out.push(e.code);events++;}
 const chars=[...same.filter(c=>c.kind==='C'),...all.filter(c=>c.kind==='C'&&!c.schoolTags.includes(school))];
 for(let i=seed;out.length<40;i++){const c=chars[i%chars.length].code;if(count(c)<4)out.push(c);}
 return out;
}
function opponent(seed){const s=['烏野','音駒','青葉城西','稲荷崎','白鳥沢','伊達工業','梟谷','ユース','角川','条善寺'][seed%10],cs=all.filter(c=>c.schoolTags.includes(s)),ch=cs.filter(c=>c.kind==='C'),ev=cs.filter(c=>c.kind==='E').slice(0,2),out=ev.flatMap(e=>[e.code,e.code]);for(let i=0;out.length<40;i++)out.push(ch[i%ch.length].code);return out;}
function randomAnswer(m,r,random){
 const pick=xs=>xs[Math.floor(random()*xs.length)],shuffle=xs=>{const a=[...xs];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
 let value;
 if(r.input.type==='ack')value=true;
 else if(r.input.type==='cards'){const n=r.input.min+Math.floor(random()*(r.input.max-r.input.min+1));value=shuffle(r.options).slice(0,n).map(o=>o.value);}
 else if(r.input.type==='block'){let cards=[];const want=1+Math.floor(random()*r.input.max);for(const o of shuffle(r.options)){const next={cards:[...cards,o.value],center:cards[0]||o.value};if(H.checkValue(r,next).ok&&m._blockLegal(r.actor,next))cards=next.cards;if(cards.length===want)break;}value={cards,center:pick(cards)};}
 else value=pick(r.options).value;
 return H.makeAnswer(r,value);
}
// 與 epoch／requestId 無關的狀態比較
const norm=s=>{const c=JSON.parse(JSON.stringify(s));if(c.match?.pending){delete c.match.pending.epoch;delete c.match.pending.requestId;}return JSON.stringify(c);};
const report={cards:0,games:0,errors:[],unused:[],undoChecks:0};
for(const card of targets){
 const full=card.number;let used=false,cardErrors=0;report.cards++;
 for(let s=0;s<N;s++)for(const policy of ['ai','rand0','rand1']){
  const seed=s*7919+card.code.split('').reduce((n,ch)=>n*31+ch.charCodeAt(0)>>>0,7),random=rng(seed),mode=s%2?'numeric':'strict';let m,step=0;
  try{
   m=new Match({id:'cqa',seed,decks:[deck(card,s),opponent(s)],mode});
   const k=m._kernel,orig=k._resolveSkill.bind(k);k._resolveSkill=(p,ctx)=>{const r=orig(p,ctx);if(ctx.controller===0&&k.card(ctx.source.id)?.cardNo===full)used=true;return r;};
   const undoAt=5+Math.floor(random()*60);
   for(;;step++){
    const r=m.request(0)||m.request(1);if(!r)break;if(step>=4000)throw Error('STALL');
    if(r.source?.cardNo===full&&r.actor===0)used=true;
    const rand=policy==='rand0'&&r.actor===0||policy==='rand1'&&r.actor===1;
    let answer=rand?randomAnswer(m,r,random):H.aiAnswer(r);
    if(!H.validate(r,answer).ok)answer=H.aiAnswer(r);
    if(step===undoAt){
     const before=m.snapshot();m.command({kind:'answer',answer});const after=norm(m.snapshot());
     m.restore(before);const r2=m.request(r.actor);m.command({kind:'answer',answer:H.makeAnswer(r2,answer.value)});
     if(norm(m.snapshot())!==after)throw Error('UNDO_REPLAY_DIVERGED at step '+step+' kind '+r.kind);report.undoChecks++;continue;
    }
    m.command({kind:'answer',answer});
   }
   const snap=m.snapshot();
   if(snap.match.phase!=='finished')throw Error('NOT_FINISHED '+snap.match.pc);
   m._kernel.assertState();
   if(Object.keys(snap.cards).length!==80)throw Error('IDENTITY_COUNT');
   for(const p of [0,1])if(Object.values(snap.cards).filter(c=>c.owner===p).length!==40)throw Error('OWNER_COUNT');
   if(snap.publicLog.some(e=>e.cardNo===full&&e.player===0)||snap.events.some(e=>e.type==='event_played'&&snap.cards[e.card]?.cardNo===full))used=true;
   report.games++;
  }catch(e){cardErrors++;if(report.errors.filter(x=>x.card===card.code).length<2)report.errors.push({card:card.code,seed,mode,policy,step,error:String(e.message).slice(0,200),pc:m?.snapshot().match.pc,kind:(m?.request(0)||m?.request(1))?.kind,stack:String(e.stack).split('\n').slice(1,5).join(' | ')});}
 }
 if(!used)report.unused.push(card.code);
 if(process.env.PROGRESS)process.stderr.write(card.code+(cardErrors?' ERR'+cardErrors:'')+(used?'':' unused')+'\n');
}
console.log(JSON.stringify({...report,errorCount:report.errors.length,unusedCount:report.unused.length},null,1));
if(report.errors.length)process.exitCode=1;
