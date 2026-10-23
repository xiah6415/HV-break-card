/* Single-computer checkpoint Undo. The Match owns every mutable card and rule. */
'use strict';
const {Match}=require('./match');
class LocalSession {
 constructor(options={},localPlayer=0){if(![0,1].includes(localPlayer))throw Error('Unknown local player');this.match=new Match(options);this.localPlayer=localPlayer;this.entries=[];}
 command(command){const before=this.match.snapshot(),actor=command.kind==='answer'?command.answer.actor:command.actor;const result=this.match.command(command);
  if(actor===this.localPlayer)this.entries.push({before,actor,kind:command.kind==='answer'?before.match.pending.kind:command.kind});
  const now=this.match.snapshot();this.entries=this.entries.filter(e=>now.match.phase==='setup'?e.before.match.phase==='setup':now.match.phase==='rally'&&now.turn.player===this.localPlayer&&e.before.match.phase==='rally'&&e.before.turn.id===now.turn.id&&e.before.turn.player===this.localPlayer);return result;
 }
 status(){const s=this.match.snapshot();if(s.match.phase==='finished')return {enabled:false,target:-1};let target=-1;const owner=s.turn.player;
  for(let i=this.entries.length-1;i>=0;i--){const e=this.entries[i];if(e.kind==='roll')continue;if(e.actor===this.localPlayer&&((s.match.phase==='setup'&&e.before.match.phase==='setup')||(s.match.phase==='rally'&&owner===this.localPlayer&&e.before.match.phase==='rally'&&e.before.turn.player===owner&&e.before.turn.id===s.turn.id))){target=i;break;}}
  return {enabled:target>=0,target};
 }
 undo(){const {enabled,target}=this.status();if(!enabled)return false;this.match.restore(this.entries[target].before);this.entries.length=target;return true;}
 view(actor=this.localPlayer){return this.match.view(actor);}
}
module.exports={LocalSession};
