/* Read-only, public-safe summaries of existing rules effects. */
'use strict';
const words={serve:'發球',receive:'接球',toss:'舉球',attack:'攻擊',block:'攔網',center_blocker:'中攔',side_blocker:'側攔',draw:'抽牌',hand:'手牌',court:'球場',event:'Event',drop:'棄牌區',MB:'MB',S:'S'};
const zh=x=>words[x]||x,list=a=>(a||[]).map(zh).join('／');
function scopeText(s={}){const out=[];
 if(s.phases)out.push(list(s.phases)+'階段');if(s.role)out.push(zh(s.role)+'區');if(s.roles)out.push(list(s.roles)+'區');
 if(s.entry_origins)out.push('從'+list(s.entry_origins)+'登場');if(s.positions)out.push(list(s.positions)+'角色');if(s.names)out.push(s.names.join('／'));
 if(s.printed_receive_gte!=null)out.push('印刷接球值 ≥ '+s.printed_receive_gte);if(s.play_icons_any)out.push(list(s.play_icons_any)+'圖示');
 if(s.type)out.push(s.type==='character'?'角色':'Event');if(s.source_zones)out.push('位於'+list(s.source_zones));if(s.phase_tags)out.push(list(s.phase_tags)+'技能');if(s.keyword_families)out.push('關鍵字：'+s.keyword_families.join('／'));
 if(s.origins)out.push(s.origins.includes('rule')?'包含規則與技能效果':'僅技能效果（含技能抽牌，規則抽牌仍依規則）');
 return out.join('；');}
function description(e){const s=e.scope||{};
 if(e.kind==='ban'){
  const labels={add_hand:s.origins?.length===1&&s.origins[0]==='skill'?'禁止技能加手牌':'限制加入手牌',play_event:'限制使用 Event',enter_character:s.max_count!=null?zh(s.role)+'登場上限 '+s.max_count+' 人':'限制角色登場',use_skill:'限制技能發動'};
  return {label:labels[e.action]||'行動受限',detail:scopeText(s)};
 }
 if(e.kind==='invalid'){const scopes=[e.selector,...(e.selector?.union_with?[e.selector.union_with]:[])].map(scopeText).filter(Boolean);return {label:'技能失效',detail:scopes.join('；或 ')};}
 if(e.kind==='keyword'&&e.keyword==='feint_block_ban')return {label:'禁止攔網',detail:'此來球不能以角色登場攔網'};
 if(e.kind==='absent')return {label:zh(e.parameter)+'值視為無',detail:zh(e.role)+'區符合效果條件的角色，'+zh(e.parameter)+'數值不存在；以來源卡文為準'};
 if(e.kind==='judgment_failure')return {label:zh(e.judge)+'判定限制',detail:'符合來源卡指定條件時，'+zh(e.judge)+'判定失敗'};
 if(e.kind==='numeric'&&e.operation==='add'&&e.value<0)return {label:zh(e.parameter)+' '+e.value,detail:'指定角色的'+zh(e.parameter)+'數值降低 '+Math.abs(e.value)};
 return null;
}
function statuses(k,viewer){return k.state.effects.flatMap(e=>{
 const text=description(e);if(!text)return [];const waiting=e.duration.kind==='next_opponent_turn'&&e.duration.activeTurn===null,active=k.active(e);if(!active&&!waiting)return [];
 const target=e.target?.id&&k.state.cards[e.target.id];if(e.target&&!k.current(e.target))return [];
 const player=e.actor??target?.owner;if(![0,1].includes(player))return [];
 const card=k.state.cards[e.source?.id],publicSource=card&&(card.owner===viewer||!['hand','deck','sets'].includes(card.zone.split('.').at(-1))||k.state.publicLog.some(l=>(l.source===card.id||l.type==='skill_declared'&&l.cardNo===card.cardNo)));
 const source=publicSource?{cardNo:card.cardNo,name:card.printed.display_name||card.printed.name}:null;
 const duration=e.duration.kind,expires=duration==='next_opponent_turn'?(waiting?'受影響玩家的下個回合生效，該回合結束時解除':'本回合結束時解除'):duration==='this_draw_phase'?'本次抽牌階段結束時解除':duration.includes('role_exit')?'本回合結束或對象離開該區時解除':'本回合結束時解除';
 return [{id:e.id,player,active,scheduled:waiting,...text,detail:text.detail||'依來源卡指定範圍適用',expires,source}];
 });}
module.exports={statuses,description,scopeText};
