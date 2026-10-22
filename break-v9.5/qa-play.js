// Claude 實戰巡檢（qa-play）：用嚴格可組的學校牌組讓 AI／隨機代理對打，抓例外、卡死(>4000 決策)、80 實體與 40 張守恆。
// 用法：node qa-play.js [每組局數=40] [只跑含此字的牌組]；有例外時 exit 1。
const E=require('./engine.js'),CL=require('./card-library');
const N=+process.argv[2]||40, ONLY=process.argv[3], VS=process.argv[4];
const all=Object.values(CL.data.cards).filter(c=>c.playable);
function build(school,seed){
  const mine=all.filter(c=>c.schoolTags.includes(school));
  const chars=mine.filter(c=>c.kind==='C').sort((a,b)=>(b.hasSkill-a.hasSkill)||a.code.localeCompare(b.code));
  const evs=mine.filter(c=>c.kind==='E').slice(0,4);
  const cards={};let n=0;
  for(const e of evs){cards[e.code]=2;n+=2;}
  // need each role covered: ensure some with rcv/tos/atk/srv
  for(let i=0;n<40;i++){const c=chars[(i+seed)%chars.length];cards[c.code]=(cards[c.code]||0)+1;n++;}
  return cards;
}
const SCHOOLS=['烏野','音駒','青葉城西','稲荷崎','白鳥沢','伊達工業','梟谷','ユース','角川','条善寺'];
for(const s of SCHOOLS){E.DECKS['qa_'+s]={name:'QA '+s,cards:build(s,0)};}
let rs=1;const rnd=()=>{rs=(rs*1103515245+12345)%2147483648;return rs/2147483648;};
const Rand={label:'R',async choose(g,p,req){const o=req.options;if(!o||!o.length)return req.input?.type==='ack'?true:null;
  if(req.kind==='guts'&&req.multi)return o.map(x=>({x,k:rnd()})).sort((a,b)=>a.k-b.k).slice(0,req.need).map(x=>x.x.value);
  if(req.multi)return o.filter(()=>rnd()<0.4).map(x=>x.value);return o[Math.floor(rnd()*o.length)].value;}};
function wrap(agent,stat){return Object.assign({},agent,{async choose(g,p,req){stat.asks++;if(stat.asks>4000)throw Error('STALL: >4000 decisions');stat.kinds[req.kind]=(stat.kinds[req.kind]||0)+1;const v=await agent.choose.call(this,g,p,req);stat.hist.push({who:p.idx,kind:req.kind,prompt:String(req.prompt).slice(0,80),opts:(req.options||[]).slice(0,8).map(x=>[x.label,x.value]),v});if(stat.hist.length>6)stat.hist.shift();return v;}});}
const issues=[];const kinds={};let games=0,rallies=0;
(async()=>{
 const decks=SCHOOLS.map(s=>'qa_'+s).filter(d=>!ONLY||d.includes(ONLY));
 for(const a of decks)for(const b of SCHOOLS.map(s=>'qa_'+s).filter(d=>!VS||d.includes(VS)))for(let s=0;s<N;s++){
  rs=s*7919+1;const stat={asks:0,kinds,hist:[]};const ag0=s%3===0?Rand:E.AI, ag1=s%3===1?Rand:E.AI;
  const logs=[];let g;
  try{
   g=new E.Game({seed:s*7919+1,mode:'strict',decks:[a,b],agents:[wrap(Object.assign({},ag0,{label:'P0'}),stat),wrap(Object.assign({},ag1,{label:'P1'}),stat)],onLog:(t,c)=>logs.push([t,c])});
   const t0=Date.now();await g.run();games++;rallies+=g.rallyNo;
   const snap=g.cardSnapshot();if(Object.keys(snap.cards).length!==80)throw Error('identity count '+Object.keys(snap.cards).length);
   for(const p of g.players){const tot=p.deck.length+p.hand.length+p.drop.length+p.ev.length+p.sets.length+Object.values(p.area).reduce((x,y)=>x+y.length,0);if(tot!==40)throw Error('card count '+tot);}
   const neg=logs.filter(([t])=>/(接球|舉球|攻擊|攔網|發球)\s*-\d/.test(t));if(neg.length)issues.push({a,b,seed:s,type:'negative-value',sample:neg.slice(0,2).map(x=>x[0])});
   if(Date.now()-t0>20000)issues.push({a,b,seed:s,type:'slow',ms:Date.now()-t0});
  }catch(e){issues.push({a,b,seed:s,agents:[ag0.label,ag1.label],type:'exception',msg:String(e&&e.message||e).slice(0,300),stack:String(e&&e.stack||'').split('\n').slice(1,16).join(' | '),tail:logs.slice(-6).map(x=>x[0]),hist:stat.hist.slice(-3)});}
 }
 const byMsg={};for(const i of issues){const k=i.type+':'+(i.msg||'').replace(/\d+/g,'#').slice(0,120);(byMsg[k]=byMsg[k]||[]).push(i);}
 console.log(JSON.stringify({games,avgRallies:(rallies/Math.max(games,1)).toFixed(2),issues:issues.length,groups:Object.fromEntries(Object.entries(byMsg).map(([k,v])=>[k,{count:v.length,first:v[0]}]))},null,1));
 console.log('kinds',JSON.stringify(kinds));
 if(issues.some(i=>i.type==='exception'))process.exitCode=1;
})();
