/* Presentation only: consumes private player views; never answers a rules request. */
(function(root){
 'use strict';
 function drawChanges(previous,view){
  if(!previous||previous.match.id!==view.match.id||view.publicLog.length<=previous.publicLog.length)return [];
  const logs=view.publicLog.slice(previous.publicLog.length),out=[];
  for(const player of [0,1]){const count=logs.filter(e=>e.type==='draw'&&e.player===player).reduce((n,e)=>n+e.count,0);if(!count)continue;
   // Only the local seat has an array of card identities. Opponent draws only report a count.
   const hand=view.players[player].hand,old=previous.players[player].hand;
   const before=new Set(Array.isArray(old)?old.map(c=>c.id):[]);
   const exact=view.request?.kind==='drawResult'&&player===0?view.request.options.filter(o=>o.card).map(o=>o.card):null;
   const cards=player===0&&Array.isArray(hand)?exact||hand.filter(c=>!before.has(c.id)).slice(0,count):[];
   out.push({player,count,cards});
  }return out;
 }
 function create({root:el,img,deckRect}){
  let previous=null,coinKey=null,queue=[],active=null,tickTimer=null,timers=new Set(),noticeHoldUntil=0;
  const later=(fn,ms)=>{const id=setTimeout(()=>{timers.delete(id);fn();},ms);timers.add(id);return id;};
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  const visible=e=>e&&!e.hidden&&e.getClientRects().length;
  const intersects=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  function sync(){
   const net=document.querySelector('.net-zone'),r=net?.getBoundingClientRect();
   el.style.setProperty('--notice-y',(r?r.top+r.height/2:innerHeight/2)+'px');
   const box=active?.box;if(!box)return false;
   const rect=box.getBoundingClientRect();
   const blocked=Date.now()<noticeHoldUntil||['#dock','#sheet','#turnScreen','#courtParamPicker'].some(q=>{const other=document.querySelector(q);return visible(other)&&intersects(rect,other.getBoundingClientRect());});
   box.style.visibility=blocked?'hidden':'visible';return blocked;
  }
  function reset(){for(const id of timers)clearTimeout(id);timers.clear();tickTimer=null;queue=[];active=null;el.replaceChildren();previous=null;coinKey=null;noticeHoldUntil=0;}
  function animateDraw(d){
   // The result panel already shows the drawn faces. Never leave a second card strip over it.
   const dock=document.getElementById('dock');if(visible(dock)&&dock.dataset.mode==='modal')return;
   const box=document.createElement('div');box.className='fx-draw';box.dataset.player='0';box.style.setProperty('--cards',Math.min(d.count,6));box.setAttribute('aria-hidden','true');
   const rect=deckRect(0),x=rect?rect.x+rect.width/2-innerWidth/2:0,y=rect?rect.y+rect.height/2-innerHeight*.62:0;
   const count=Math.min(d.count,6);
   for(let i=0;i<count;i++){const card=document.createElement('div');card.className='fx-card';card.style.setProperty('--i',i);card.style.setProperty('--from-x',x+'px');card.style.setProperty('--from-y',y+'px');
    card.innerHTML='<div class="fx-card-inner"><div class="fx-back">BREAK</div><div class="fx-front"></div></div>';
    if(d.cards[i])card.querySelector('.fx-front').innerHTML=img(d.cards[i].cardNo.replace(/^HV-?/,''));else card.classList.add('back-only');
    if(i===count-1)card.addEventListener('animationend',e=>{if(e.target===card)box.remove();},{once:false});box.append(card);
   }
   el.append(box);later(()=>box.remove(),reduced()?300:1450);
  }
  function tick(){
   tickTimer=null;
   if(!active&&queue.length){const job=queue.shift(),box=document.createElement('div');box.className='fx-notice '+job.kind;box.setAttribute('role','status');box.textContent=job.text;el.append(box);active={...job,box,left:job.duration,last:Date.now(),started:false};}
   if(active){const blocked=sync(),now=Date.now();if(!blocked){if(!active.started){active.started=true;active.start?.();}else active.left-=now-active.last;}active.last=now;if(active.left<=0){active.box.remove();active=null;}}
   if(active||queue.length)tickTimer=later(tick,100);
  }
  function notice(text,kind='fx-info',duration=1600,start){queue.push({text,kind,duration,start});if(!tickTimer)tick();}
  function holdNotices(ms){noticeHoldUntil=Math.max(noticeHoldUntil,Date.now()+ms);sync();}
  function clearNotices(kind){queue=queue.filter(j=>j.kind!==kind);if(active?.kind===kind){active.box.remove();active=null;}if((active||queue.length)&&!tickTimer)tick();}
  function negative(items){
   const job=active?.kind==='fx-negative'?active:queue.find(j=>j.kind==='fx-negative'),merged=new Map(job?.items||[]);for(const i of items)merged.set(i.id,i.text);
   const text='負面效果 · '+[...merged.values()].join('；');if(job){job.items=[...merged];job.text=text;if(job.box){job.box.textContent=text;job.left=2200;sync();}}else{notice(text,'fx-negative',2200);const added=active?.kind==='fx-negative'?active:queue.findLast(j=>j.kind==='fx-negative');if(added)added.items=[...merged];}
  }
  function showDraw(d){notice((d.player===0?'你':'對手')+'抽了 '+d.count+' 張牌',d.player===0?'fx-own-draw':'fx-opponent-draw',1600,d.player===0?()=>animateDraw(d):null);}
  function observe(view){
   if(previous&&(previous.match.id!==view.match.id||view.publicLog.length<previous.publicLog.length||view.match.decisionIndex<previous.match.decisionIndex))reset();
   const draws=drawChanges(previous,view);previous=view;for(const d of draws)showDraw(d);sync();
  }
  function request(req){
   if(req.kind==='mulligan'||req.kind==='coinGuess'){el.querySelectorAll('.fx-coin-wrap,.fx-draw').forEach(n=>n.remove());if(req.kind==='coinGuess')coinKey=null;sync();return;}
   if(req.kind==='drawResult')el.querySelectorAll('.fx-draw').forEach(n=>n.remove());
   const c=req.context?.coin;if(!c){sync();return;}const key=req.matchId+':'+JSON.stringify(c);if(key===coinKey)return;coinKey=key;
   el.querySelector('.fx-coin-wrap')?.remove();const box=document.createElement('div');box.className='fx-coin-wrap';box.setAttribute('role','status');box.dataset.result=c.result;
   box.style.setProperty('--coin-end',c.result==='tails'?'180deg':'0deg');
   box.innerHTML='<div class="fx-coin"><div class="fx-face"><img src="img/ui/coin-heads-7fa122568f33.png" alt="正面：BREAK 標誌" width="140" height="140"></div><div class="fx-face fx-tail"><img src="img/ui/coin-tails-4006bad17af0.png" alt="反面：排球" width="140" height="140"></div></div><strong class="fx-coin-caption"></strong>';
   box.querySelector('strong').textContent='硬幣結果：'+(c.result==='heads'?'正面':'反面');el.append(box);later(()=>box.remove(),reduced()?500:1800);
  }
  return {observe,request,reset,negative,notice,holdNotices,clearNotices,sync};
 }
 const api={drawChanges,create};if(typeof module==='object'&&module.exports)module.exports=api;else root.BreakPresentation=api;
})(typeof window==='object'?window:globalThis);
