/* Serializable, source-independent next-opponent-turn restrictions. */
(function(root) {
'use strict';
function state(g) {return g.turnEffects ||= {version:1,next:1,effects:[]};}
function schedule(g,player,key,value,{stack=false,source=null}={}) {
  if(g.turnP?.idx===player)throw new Error('Next opponent effect must target the other player');
  const s=state(g),effect={id:'turn-effect-'+s.next++,player,key,value,stack,source:source?{...source}:null,createdTurn:g.turnNo,activeTurn:null};
  s.effects.push(effect);
  const pending=g.players[player].pending;
  pending[key]=stack?(pending[key]||0)+value:value;return effect;
}
function begin(g,player) {
  const s=state(g),active={};
  s.effects=s.effects.filter(e=>e.activeTurn===null);
  for(const e of s.effects)if(e.player===player){e.activeTurn=g.turnNo;active[e.key]=e.stack?(active[e.key]||0)+e.value:e.value;}
  return active;
}
function finish(g,turn) {if(g.turnEffects)g.turnEffects.effects=g.turnEffects.effects.filter(e=>e.activeTurn!==turn);}
function loss(g) {if(g.turnEffects)g.turnEffects.effects=[];}
const api={schedule,begin,finish,loss};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BreakTurnEffects=api;
})(typeof globalThis!=='undefined'?globalThis:this);
