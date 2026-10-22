/* Claude 長尾節點：每個參數形態一個獨立預期測試（含本機 Undo）。2026-10-22 */
'use strict';
const assert=require('node:assert/strict'),I=require('./node-inventory'),F=require('./frequent-node-tests');
const forms=(catalog,kind,fn)=>{const rows=I.forms(catalog)[kind];assert(rows,'No forms for '+kind);for(const {node}of rows.values())fn(structuredClone(node));return rows.size;};
const P=['serve','block','receive','toss','attack'];
function plain(k,p=0,z='attack'){const id=k.addCard('HV-D01-009',p,z);k.card(id).printed.parameters=Object.fromEntries(P.map(x=>[x,2]));return id;}
const scope={mode:'single',binding:'reference',membership:'snapshot_on_resolution'};
const cmp=(field,op,value)=>({kind:'compare',field,op,value,checkpoint:'when_condition_reached'});
// 重跑同一段：還原後結果必須逐位元相同
function replay(k,run){const before=k.snapshot(),r=run(),after=k.snapshot();k.restore(before);assert.deepEqual(run(),r);assert.deepEqual(k.snapshot(),after,'Undo/replay');return r;}

// any：任一子條件成立即成立；全部不成立才不成立
function testAny(catalog){return forms(catalog,'any',()=>{
 for(const [a,b] of [[true,true],[true,false],[false,true],[false,false]]){
  const k=F.game(catalog),src=plain(k,0,'attack'),ctx=k._context(src,0);
  for(let i=0;i<2;i++)k.addCard('HV-D01-009',0,'hand');
  const node={kind:'any',conditions:[cmp('self.hand.count','gte',a?2:3),cmp('self.hand.count','lte',b?2:1)]};
  assert.equal(replay(k,()=>k._predicate(node,ctx)),a||b,`any ${a}/${b}`);
 }
});}

// equal_fields：target.entry_turn == current_turn_id（本回合登場才成立）
function testEqualFields(catalog){return forms(catalog,'equal_fields',node=>{
 assert.deepEqual(node.fields,['target.entry_turn','current_turn_id']);
 for(const thisTurn of [true,false]){
  const k=F.game(catalog),src=plain(k,0,'hand'),ctx=k._context(src,0);
  const id=k.addCard('HV-D01-009',0,'hand');
  if(!thisTurn){k._enter(id,0,'attack',ctx,'rule');k.state.turn.id+=1;}else k._enter(id,0,'attack',ctx,'skill');
  ctx.bind.target=k.reference(id);
  assert.equal(replay(k,()=>k._predicate(node,ctx)),thisTurn,'equal_fields '+thisTurn);
 }
});}

// 以數值節點驗證計算式：result_count／sum_result_parameter
function numericWith(k,src,ctx,value,parameter){return k._atomic(()=>k._run({kind:'numeric',operation:'add',parameter,value,target:'source',bind:'target',target_scope:scope,duration:'current_turn_cleanup_or_role_exit'},ctx));}
function testResultCount(catalog){return forms(catalog,'result_count',node=>{
 for(const n of [0,2,3]){
  const k=F.game(catalog),src=plain(k,0,'attack'),ctx=k._context(src,0);
  ctx.bind[node.result]=Array.from({length:n},()=>k.addCard('HV-D01-009',0,'drop'));
  const before=k.parameter(src,'attack');replay(k,()=>numericWith(k,src,ctx,node,'attack'));
  assert.equal(k.parameter(src,'attack'),before+n,'result_count '+n);
 }
});}
function testSumResult(catalog){return forms(catalog,'sum_result_parameter',node=>{
 // 一般數值相加；「－」視為 0（例：西谷 block「－」當 Guts 付出時不加也不壞）
 for(const values of [[1,2,3],[0,0,0],[2,'dash',3],[]]){
  const k=F.game(catalog),src=plain(k,0,'receive'),ctx=k._context(src,0);
  ctx.bind[node.result]=values.map(v=>{const id=k.addCard('HV-D01-009',0,'drop');k.card(id).printed.parameters[node.parameter]=v;return id;});
  const before=k.parameter(src,'receive');replay(k,()=>numericWith(k,src,ctx,node,'receive'));
  const expected=values.reduce((s,v)=>s+(Number.isInteger(v)?v:0),0);
  assert.equal(k.parameter(src,'receive'),before+expected,'sum '+JSON.stringify(values));
 }
});}

// draw_to_hand_size：補到 N 張；已達或超過不抽；牌庫不足抽到見底；禁止加牌時不抽
function testDrawToHandSize(catalog){return forms(catalog,'draw_to_hand_size',node=>{
 for(const [hand,deck,banned] of [[0,20,false],[node.hand_size-1,20,false],[node.hand_size,20,false],[node.hand_size+2,20,false],[0,1,false],[0,20,true]]){
  const k=F.game(catalog),src=plain(k,0,'attack'),ctx=k._context(src,0),player=node.actor==='opponent'?1:0;
  for(let i=0;i<hand;i++)k.addCard('HV-D01-009',player,'hand');
  const deckIds=Array.from({length:deck},()=>k.addCard('HV-D01-009',player,'deck'));
  if(banned)k.resolveProgram({kind:'ban_action',action:'add_hand',actor:player===0?'self':'opponent',scope:{},duration:'this_turn'},0);
  const r=replay(k,()=>k._atomic(()=>k._run(node,ctx)));
  const want=banned?0:Math.min(deck,Math.max(0,node.hand_size-hand));
  assert.equal(ctx.bind[node.bind||'drawn'].length,want,`draw_to ${node.hand_size} from ${hand}/${deck} ban=${banned}`);
  assert.equal(r,want>0);assert.equal(k.zone(player,'hand').length,hand+want);
  assert.deepEqual(k.zone(player,'deck'),deckIds.slice(0,deck-want));
  assert(!k.state.events.some(e=>e.type==='hand_added'&&e.operation!=='draw'),'Draw-to-size is a draw');
 }
});}

// exchange：兩側各最多 1 張、兩側都要選才交換；一側空／禁止加牌（含手牌側）→ 不交換；選 0 → 不交換；移動後位置與 hand_added
function testExchange(catalog){
 // 形態把 sides 視為子節點，這裡另外逐一測全庫實際出現的兩側組合（接球Guts↔攻擊Guts、手牌↔攻擊Guts）
 const variants=new Map();for(const c of catalog.cards)for(const p of c.profiles)for(const n of I.nodes(p))if(n.kind==='exchange')variants.set(JSON.stringify(n.sides.map(x=>[x.zone,x.filters])),structuredClone(n));
 for(const node of variants.values())exchangeOnce(catalog,node);
 return forms(catalog,'exchange',node=>exchangeOnce(catalog,node));
}
function exchangeOnce(catalog,node){
 for(const variant of ['swap','decline','emptyA','emptyB','banned']){
  const k=F.game(catalog),src=plain(k,0,'toss'),ctx=k._context(src,0);
  // 每個 guts 區先放一位頂層角色，guts 才合法
  const tops={};for(const sel of node.sides)if(sel.zone.endsWith('.guts')){const area=sel.zone.split('.')[0];if(!tops[area]){k.addCard('HV-D01-009',0,area);tops[area]=k.top(0,area);}}
  const make=(sel,skip)=>{if(skip)return null;const f=sel.filters||{},d=catalog.cards.find(c=>{const v=c.profiles[0].variants[0].printed;return (!f.type||v.type===f.type)&&(f.tags||[]).every(t=>v.affiliation_tags.includes(t));});assert(d,'fixture '+JSON.stringify(f));
   const area=sel.zone.endsWith('.guts')?sel.zone.split('.')[0]:sel.zone;const id=k.addCard(d.card_no,0,area);
   if(sel.zone.endsWith('.guts')){const z=k.zone(0,area);z.splice(z.indexOf(id),1);z.splice(z.length-1,0,id);}return id;};
  const x=make(node.sides[0],variant==='emptyA'),y=make(node.sides[1],variant==='emptyB');
  if(variant==='banned')k.resolveProgram({kind:'ban_action',action:'add_hand',actor:'self',scope:{},duration:'this_turn'},0);
  k.choose=r=>r.kind==='move_count'?(variant==='decline'?0:1):r.options.slice(0,r.count);
  const before=k.snapshot(),r=k._atomic(()=>k._run(node,ctx));
  const swapped=variant==='swap'||variant==='banned'&&!node.sides.some(s=>s.zone==='hand');
  assert.equal(r,swapped,'exchange '+variant);
  const where=id=>k.card(id).zone;
  if(swapped){
   const za=node.sides[0].zone,zb=node.sides[1].zone,loc=z=>'0.'+(z.endsWith('.guts')?z.split('.')[0]:z);
   assert.equal(where(x),loc(zb));assert.equal(where(y),loc(za));
   for(const id of [x,y]){const z=where(id).split('.')[1];if(z!=='hand')assert.notEqual(k.top(0,z),id,'Exchanged card stays Guts, not top character');}
   const added=k.state.events.slice(before.events.length).filter(e=>e.type==='hand_added');assert.equal(added.length,node.sides.filter(s=>s.zone==='hand').length);
   const after=k.snapshot();k.restore(before);k._atomic(()=>k._run(node,k._context(src,0)));assert.deepEqual(k.snapshot(),after,'exchange Undo');
  }else{
   for(const id of [x,y].filter(Boolean))assert.equal(where(id),before.cards[id].zone);
  }
 }
}

// each_player_optional_draw：雙方各自決定（決策者＝各玩家）、只能 0 或 count；牌庫不足抽到見底；被禁止加牌者不抽
function testEachPlayerDraw(catalog){return forms(catalog,'each_player_optional_draw',node=>{
 for(const [a0,a1,deck1,ban0] of [[true,true,10,false],[true,false,10,false],[false,true,10,false],[false,false,10,false],[true,true,1,false],[true,true,10,true]]){
  const k=F.game(catalog),src=plain(k,0,'hand'),ctx=k._context(src,0);
  for(let p=0;p<2;p++)for(let i=0;i<(p?deck1:10);i++)k.addCard('HV-D01-009',p,'deck');
  if(ban0)k.resolveProgram({kind:'ban_action',action:'add_hand',actor:'self',scope:{},duration:'this_turn'},0);
  const asked=[];k.choose=r=>{assert.equal(r.kind,'draw_count');assert.deepEqual(r.options,[0,node.count]);asked.push(r.player);return (r.player===0?a0:a1)?node.count:0;};
  const h0=k.zone(0,'hand').length,h1=k.zone(1,'hand').length;
  const r=k._atomic(()=>k._run(node,ctx));
  assert.deepEqual(asked,[0,1],'Each player decides for themself');
  const want0=a0&&!ban0?node.count:0,want1=a1?Math.min(node.count,deck1):0;
  assert.equal(k.zone(0,'hand').length-h0,want0);assert.equal(k.zone(1,'hand').length-h1,want1);assert.equal(r,want0+want1>0);
 }
});}

module.exports={testExchange,testEachPlayerDraw,testAny,testEqualFields,testResultCount,testSumResult,testDrawToHandSize};
if(require.main===module){const c=require('./data/cards.json');for(const [n,f] of Object.entries(module.exports))console.log(n+': '+f(c)+' forms passed');}
