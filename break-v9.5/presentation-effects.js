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
  let previous=null,coinKey=null,timers=[];
  const later=(fn,ms)=>{const id=setTimeout(()=>{timers=timers.filter(t=>t!==id);fn();},ms);timers.push(id);};
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  function reset(){for(const id of timers)clearTimeout(id);timers=[];el.replaceChildren();previous=null;coinKey=null;}
  function notice(text,kind,duration=1600){
   const box=document.createElement('div');box.className='fx-notice '+kind;box.setAttribute('role','status');box.textContent=text;el.append(box);later(()=>box.remove(),duration);return box;
  }
  function negative(items){
   const old=el.querySelector('.fx-negative'),lines=new Map(old?old._items:[]);
   for(const item of items)lines.set(item.id,item.text);old?.remove();const box=notice('負面效果 · '+[...lines.values()].join('；'),'fx-negative',2200);box._items=[...lines];
  }
  function showDraw(d){
   if(d.player===1){el.querySelector('.fx-opponent-draw')?.remove();const box=notice('對手抽了 '+d.count+' 張牌','fx-opponent-draw');box.dataset.player='1';return;}
   const box=document.createElement('div');box.className='fx-draw';box.dataset.player=d.player;box.style.setProperty('--cards',Math.min(d.count,6));box.setAttribute('role','status');
   const text=document.createElement('strong');text.textContent=(d.player===0?'你':'對手')+'抽了 '+d.count+' 張牌';box.append(text);
   const rect=deckRect(d.player),x=rect?rect.x+rect.width/2-innerWidth/2:0,y=rect?rect.y+rect.height/2-innerHeight*.62:0;
   for(let i=0;i<Math.min(d.count,6);i++){const card=document.createElement('div');card.className='fx-card';card.style.setProperty('--i',i);card.style.setProperty('--from-x',x+'px');card.style.setProperty('--from-y',y+'px');
    card.innerHTML='<div class="fx-card-inner"><div class="fx-back">BREAK</div><div class="fx-front"></div></div>';
    // Faces come exclusively from cards already visible in the local player's hand.
    if(d.player===0&&d.cards[i])card.querySelector('.fx-front').innerHTML=img(d.cards[i].cardNo.replace(/^HV-?/,''));
    else card.classList.add('back-only');box.append(card);
   }
   el.append(box);later(()=>box.remove(),reduced()?300:1500);
  }
  function observe(view){
   if(previous&&(previous.match.id!==view.match.id||view.publicLog.length<previous.publicLog.length||view.match.decisionIndex<previous.match.decisionIndex))reset();
   const draws=drawChanges(previous,view);previous=view;for(const d of draws)showDraw(d);
  }
  function request(req){
   if(req.kind==='coinGuess'){coinKey=null;return;}
   const c=req.context?.coin;if(!c)return;const key=req.matchId+':'+JSON.stringify(c);if(key===coinKey)return;coinKey=key;
   el.querySelector('.fx-coin-wrap')?.remove();const box=document.createElement('div');box.className='fx-coin-wrap';box.setAttribute('role','status');box.dataset.result=c.result;
   box.style.setProperty('--coin-end',c.result==='tails'?'180deg':'0deg');
   box.innerHTML='<div class="fx-coin"><div class="fx-face">正</div><div class="fx-face fx-tail">反</div></div><strong class="fx-coin-caption"></strong>';
   box.querySelector('strong').textContent='硬幣結果：'+(c.result==='heads'?'正面':'反面');el.append(box);later(()=>box.remove(),reduced()?500:1800);
  }
  return {observe,request,reset,negative};
 }
 const api={drawChanges,create};if(typeof module==='object'&&module.exports)module.exports=api;else root.BreakPresentation=api;
})(typeof window==='object'?window:globalThis);
