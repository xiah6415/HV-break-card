/* Physical identity beside the legacy card-code arrays. All production moves
   must pass through this module; mismatched arrays are rejected, never guessed. */
(function(root) {
'use strict';
const copy=x=>JSON.parse(JSON.stringify(x));
const areas=['serve','block','receive','toss','attack'];
const zones=['deck','hand','drop','ev','sets',...areas,'sides'];
const empty=Object.freeze([]);
function list(g,key,create=false) {
  const [owner,zone]=key.split('.'),p=g.players[owner];
  if(areas.includes(zone))return p.area[zone];
  if(zone==='sides')return p.ts.sides||(create?(p.ts.sides=[]):empty);
  return p[zone];
}
function keys(g) {return g.players.flatMap(p=>zones.map(z=>p.idx+'.'+z));}
function visible(state) {
  return new Set(Object.entries(state.zones).flatMap(([key,ids])=>areas.includes(key.split('.')[1])?ids.slice(-1):key.endsWith('.sides')?ids:[]));
}
function validate(g,state) {
  if(state.version!==1||!Number.isInteger(state.next)||state.next<1||!Number.isInteger(state.revision)||state.revision<0)throw new Error('Unsupported physical identity version');
  if(JSON.stringify(Object.keys(state.zones).sort())!==JSON.stringify(keys(g).sort()))throw new Error('Physical identity zones do not match');
  const seen=new Set();
  for(const key of keys(g)) {
    const ids=state.zones[key],codes=list(g,key);
    if(!ids||ids.length!==codes.length)throw new Error('Untracked card mutation in '+key);
    ids.forEach((id,i)=>{
      const c=state.cards[id];
      if(seen.has(id)||!c||c.id!==id||!Number.isInteger(c.incarnation)||c.incarnation<0||c.zone!==key||c.owner!==+key.split('.')[0]||c.code!==codes[i])throw new Error('Physical identity mismatch in '+key);
      seen.add(id);
    });
  }
  if(seen.size!==Object.keys(state.cards).length)throw new Error('Physical card conservation failed');
}
function ensure(g) {
  if(!g.cardState) {
    const state={version:1,next:1,revision:0,cards:{},zones:{}};
    for(const key of keys(g))state.zones[key]=list(g,key).map(code=>{
      const id='card-'+state.next++;state.cards[id]={id,code,owner:+key.split('.')[0],zone:key,incarnation:0};return id;
    });
    g.cardState=state;
  }
  validate(g,g.cardState);return g.cardState;
}
function keyOf(g,array) {const key=keys(g).find(key=>list(g,key)===array);if(!key)throw new Error('Movement requires a registered card zone');return key;}
function move(g,from,to,index,at) {
  const state=ensure(g),src=typeof from==='string'?from:keyOf(g,from),dst=typeof to==='string'?to:keyOf(g,to);
  const a=list(g,src),b=list(g,dst,true);
  if(!Number.isInteger(index)||index<0||index>=a.length)throw new Error('Invalid physical-card index');
  if(src.split('.')[0]!==dst.split('.')[0])throw new Error('Ownership transfer is not supported');
  const position=at===undefined?b.length-(a===b?1:0):at;
  if(!Number.isInteger(position)||position<0||position>b.length-(a===b?1:0))throw new Error('Invalid destination index');
  const before=visible(state),id=state.zones[src][index],code=a[index];
  a.splice(index,1);state.zones[src].splice(index,1);
  b.splice(position,0,code);state.zones[dst].splice(position,0,id);state.cards[id].zone=dst;
  const after=visible(state);
  for(const changed of new Set([...before,...after]))if(before.has(changed)!==after.has(changed))state.cards[changed].incarnation++;
  state.revision++;validate(g,state);return {id,code};
}
function shuffle(g,array,random) {
  const state=ensure(g),key=keyOf(g,array),ids=state.zones[key];
  for(let i=array.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[array[i],array[j]]=[array[j],array[i]];[ids[i],ids[j]]=[ids[j],ids[i]];}
  state.revision++;validate(g,state);
}
function snapshot(g) {return copy(ensure(g));}
function restore(g,state) {
  const next=copy(state),old=g.cardState;
  // Validate ownership, codes and conservation before touching host arrays.
  const shadow={players:g.players.map(p=>({idx:p.idx,area:{},ts:{}}))};
  for(const key of keys(g)) {
    const [owner,zone]=key.split('.'),p=shadow.players[owner],codes=next.zones[key]?.map(id=>next.cards[id]?.code);
    if(!codes)throw new Error('Missing snapshot zone');
    if(areas.includes(zone))p.area[zone]=codes;else if(zone==='sides')p.ts.sides=codes;else p[zone]=codes;
  }
  validate(shadow,next);
  if(old) {
    const ids=Object.keys(old.cards).sort();
    if(JSON.stringify(ids)!==JSON.stringify(Object.keys(next.cards).sort())||ids.some(id=>old.cards[id].code!==next.cards[id].code||old.cards[id].owner!==next.cards[id].owner))throw new Error('Physical identity snapshot belongs to another game');
  }
  for(const key of keys(g)) {
    const target=list(g,key,true);target.splice(0,target.length,...list(shadow,key));
  }
  g.cardState=next;validate(g,next);
}
const api={ensure,move,shuffle,snapshot,restore,validate,list,areas};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BreakCardIdentity=api;
})(typeof globalThis!=='undefined'?globalThis:this);
