'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const {Kernel,NeedsReview,IllegalAction}=require('./core');
const catalog=require('./data/cards.json');const rules=require('./data/shared-rules.json');const manifest=require('./data/manifest.json');
const fingerprint=manifest.output_hashes['cards.json'];
const cases=[];const copy=x=>JSON.parse(JSON.stringify(x));
function test(name,fn,qa=[]){fn();cases.push({name,qa,passed:true});}
function decisions(req){
 if(['activate_payment','optional'].includes(req.kind))return true;
 if(req.kind==='parameter')return req.options.includes('receive')?'receive':req.options[0];
 if(['move_count','entry_count','draw_count','mill_count','target_count','payment_count'].includes(req.kind))return req.options.at(-1);
 if(req.kind==='mode')return 0;
 if(req.kind==='trigger_order')return req.options.at(-1);
 if(['target','move_cards','payment_cards','entry','guts'].includes(req.kind))return req.options.slice(0,req.count);
 throw new Error('Unexpected choice '+req.kind);
}
function game(phase='attack',player=0,choose=decisions,mode='sandbox'){
 const g=new Kernel({catalog,ruleIds:rules.rules.map(r=>r.id),fingerprint,mode,choose});
 g.state.turn.phase=phase;g.state.turn.player=player;return g;
}
const add=(g,no,p=0,z='hand')=>g.addCard('HV-'+no,p,z);
const seq=(...steps)=>({kind:'sequence',steps});
const single={mode:'single',binding:'reference',membership:'snapshot_on_resolution'};
const num=(parameter,value,target='source',operation='add')=>({kind:'numeric',parameter,value,target,operation,target_scope:single,duration:'current_turn_cleanup_or_role_exit'});
const draw=(actor='self',count=1)=>({kind:'draw',actor,count,count_mode:'exact',bind:'drawn'});
const watch=(event,actor,then,duration='this_turn',filters={})=>({kind:'watch',event,actor,then,duration,filters,remaining_uses:null,per_object:true});
const ban=(action,actor,scope,duration='this_turn')=>({kind:'ban_action',action,actor,scope,duration});
function unchangedAfter(g,fn,ErrorClass){const old=g.snapshot();assert.throws(fn,ErrorClass);assert.deepEqual(g.snapshot(),old);}
function raw(g,program,controller=0,source=null,event={}){return g.resolveProgram(program,controller,source,event);}

// Frozen package authenticity and actual source data, not hand-transcribed card branches.
test('Frozen data hashes match the manifest',()=>{
 for(const [file,hash] of Object.entries(manifest.output_hashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'data',file))).digest('hex'),hash);
 assert.equal(catalog.cards.length,541);
});
test('No card-ID branches occur in the kernel',()=>assert.equal(fs.readFileSync(path.join(__dirname,'core.js'),'utf8').includes('HV-'),false));
test('Unapproved card skill cannot execute live; placement rolls back',()=>{
 const g=game('attack',0,decisions,'live'),id=add(g,'P03-096');unchangedAfter(g,()=>g.playEvent(id),NeedsReview);
});
test('Unknown mechanism fails before drawing or mutating state',()=>{
 const g=game();add(g,'P03-048',0,'deck');unchangedAfter(g,()=>raw(g,seq(draw(),{kind:'invented_operation'})),NeedsReview);
});
test('Unimplemented continuous protection cannot execute',()=>{
 const g=game('receive');const id=add(g,'P04-070');unchangedAfter(g,()=>g.enter(id,'receive'),NeedsReview);
});
test('An unresolved printed version cannot execute',()=>{
 const g=game('receive');const id=add(g,'P04-072');unchangedAfter(g,()=>g.playEvent(id),NeedsReview);
});

// Official restriction layers and exact origin/phase matching.
test('P01-035 denies skill additions but allows rule receive draw',()=>{
 const g=game();const source=add(g,'P01-035');add(g,'D04-003');add(g,'P03-048',1,'deck');add(g,'D01-009',1,'deck');
 g.enter(source,'attack');assert.equal(g.parameter(source,'attack'),4);
 g.endTurn();g.beginTurn(1,'draw');assert.equal(g.drawRule(1).length,1);
 assert.equal(raw(g,seq(draw()),1),false);assert.equal(g.zone(1,'deck').length,1);
 g.endTurn();g.beginTurn(0);assert.equal(raw(g,seq(draw('opponent'))),true);
},['1158']);
test('P04-087 bans both rule and skill hand additions only in draw phase',()=>{
 const g=game('serve');const id=add(g,'P04-087');add(g,'D04-003',0,'drop');add(g,'P03-048',1,'deck');
 g.playEvent(id);g.endTurn();g.beginTurn(1,'draw');assert.equal(g.drawRule(1).length,0);assert.equal(raw(g,seq(draw()),1),false);
 g.advancePhase('receive');assert.equal(raw(g,seq(draw()),1),true);
},['1933']);
test('Skill invalidation permits event placement but resolves no skill',()=>{
 const g=game();add(g,'D01-009',0,'attack');add(g,'P03-048',0,'deck');
 raw(g,seq({kind:'invalidate_skill',actor:'opponent',duration:'this_turn',selector:{type:'event'}}),1);
 const event=add(g,'P03-096');const before=g.zone(0,'deck').length;
 assert.deepEqual(g.playEvent(event),{played:true,performed:false,invalid:true});
 assert.equal(g.zone(0,'event').includes(event),true);assert.equal(g.zone(0,'deck').length,before);
},['14','1814']);
test('A play-event ban blocks placement and leaves hand intact',()=>{
 const g=game();raw(g,seq(ban('play_event','opponent',{})),1);const id=add(g,'P03-096');unchangedAfter(g,()=>g.playEvent(id),IllegalAction);
},['14']);
test('Effect placement is distinct from normal event play',()=>{
 const g=game();raw(g,seq(ban('play_event','opponent',{})),1);const id=add(g,'P03-096');
 raw(g,seq({kind:'move',pool:{kind:'selector',actor:'self',zone:'hand',filters:{type:'event'}},destination:'self.event',count:1,count_mode:'exact',reason:'effect_placement_not_play'}));
 assert.equal(g.zone(0,'event').includes(id),true);assert.equal(g.state.locks.length,0);
},['1372']);
test('No-change event boundary remains explicitly unresolved with rollback',()=>{
 const g=game('receive');const id=add(g,'P03-087');unchangedAfter(g,()=>g.playEvent(id),NeedsReview);
});

// Real complete card programs: formal cost, persistent watchers, cross-area Guts and counters.
test('P03-057 pays its hand cost, persists after source leaves and protects entered character',()=>{
 const g=game('draw');const skill=add(g,'P03-057');g.useSkill(skill);assert.equal(g.zone(0,'drop').includes(skill),true);
 g.advancePhase('receive');const target=add(g,'D01-009');g.enter(target,'receive');assert.equal(g.parameter(target,'receive'),4);
 raw(g,seq(num('receive',-3)),1,target);assert.equal(g.parameter(target,'receive'),4);
 g.advancePhase('toss');const firstYear=add(g,'P03-048');g.enter(firstYear,'toss');assert.equal(g.parameter(firstYear,'receive'),0);
},['32']);
test('P03-087 chooses any court target and pays six Guts across areas',()=>{
 const g=game();for(let i=0;i<3;i++)add(g,'D01-009',0,'receive');add(g,'P01-004',0,'receive');
 for(let i=0;i<3;i++)add(g,'D01-009',0,'toss');const target=add(g,'P03-048',0,'toss');
 const event=add(g,'P03-087');add(g,'D01-009',0,'deck');
 g.choose=req=>req.kind==='target'?[target]:decisions(req);
 g.playEvent(event);assert.equal(g.parameter(target,'attack'),3);assert.equal(g.parameter(target,'receive'),2);
 assert.equal(g.zone(0,'drop').length,6);assert.equal(g.zone(0,'receive').length,1);assert.equal(g.zone(0,'toss').length,1);
},['1836']);
test('P03-087 can decline optional six-Guts branch without losing its first effects',()=>{
 const g=game();const target=add(g,'P03-048',0,'toss'),event=add(g,'P03-087');add(g,'D01-009',0,'deck');
 g.choose=req=>req.kind==='activate_payment'?false:decisions(req);g.playEvent(event);assert.equal(g.parameter(target,'attack'),3);assert.equal(g.parameter(target,'receive'),0);
},['30']);
for(const chosen of [0,1])test('P01-088 optional draw '+chosen+' evaluates the later hand condition after the choice',()=>{
 const g=game('receive'),target=add(g,'P04-026',0,'receive'),event=add(g,'P01-088');
 add(g,'P03-048');add(g,'D01-009');add(g,'P04-027');add(g,'P03-048',0,'deck');
 g.choose=req=>req.kind==='draw_count'?chosen:decisions(req);g.playEvent(event);
 assert.equal(g.parameter(target,'receive'),chosen===0?7:6);assert.equal(g.zone(0,'hand').length,3+chosen);
});
test('Up-to draw on an empty deck cannot select a nonexistent card',()=>{
 const g=game();let options;g.choose=req=>{options=req.options;return 0;};
 raw(g,seq({kind:'draw',actor:'self',count:1,count_mode:'upto',bind:'drawn'}));assert.deepEqual(options,[0]);assert.equal(g.zone(0,'hand').length,0);
},['37']);
test('Insufficient optional payment is not partially consumed',()=>{
 const g=game();for(let i=0;i<2;i++)add(g,'D01-009',0,'toss');const target=add(g,'P03-048',0,'toss'),event=add(g,'P03-087');
 g.playEvent(event);assert.equal(g.zone(0,'toss').length,3);assert.equal(g.zone(0,'drop').length,0);assert.equal(g.parameter(target,'attack'),3);
});
test('Same-name Turn1 lock applies to another card number of Hinata',()=>{
 const g=game();add(g,'P03-010',0,'toss');for(let i=0;i<3;i++)add(g,'P03-004',0,'attack');
 const skill=add(g,'P03-001'),other=add(g,'P01-002');add(g,'P03-008',0,'deck');g.useSkill(skill);
 assert.equal(g.state.locks.some(l=>l.player===0&&l.name==='日向翔陽'),true);assert.equal(g.zone(0,'event').includes(skill),true);
 g.enter(other,'attack');assert.equal(g.parameter(other,'attack'),1);assert.equal(g.zone(0,'attack').length,4);assert.equal(g.zone(0,'drop').length,0);
},['1746']);
test('P04-088 Turn1 lock does not restrict already generated receive watcher',()=>{
 const g=game();const attack=add(g,'D04-004',0,'attack');raw(g,seq(num('attack',4)),0,attack);
 const e1=add(g,'P04-088'),e2=add(g,'P04-088');g.playEvent(e1);assert.equal(g.parameter(attack,'attack'),8);
 const result=g.playEvent(e2);assert.equal(result.invalid,true);assert.equal(g.state.effects.filter(e=>e.kind==='watch').length,1);
 g.endTurn();g.beginTurn(1,'receive');const r1=add(g,'P04-027',1);g.enter(r1,'receive');assert.equal(g.parameter(r1,'receive'),5);
 const r2=add(g,'P04-026',1);g.enter(r2,'receive');assert.equal(g.parameter(r2,'receive'),4);assert.equal(g.parameter(r1,'receive'),6);
},['1934']);
for(const [kind,offense,expected] of [['serve',2,5],['serve',6,7],['serve',9,7],['serve',5,5],['attack',6,5],['block',6,5]])
 test('Akagi actual receive: '+kind+'/'+offense,()=>{const g=game('receive');g.state.ball={owner:1,kind,offense};const c=add(g,'P03-046');add(g,'P03-048',0,'deck');g.enter(c,'receive');assert.equal(g.parameter(c,'receive'),expected);assert.equal(g.zone(0,'hand').length,kind==='serve'&&offense<=2?1:0);});

// Ordered triggers, phase skips and current-skill continuation.
test('Turn player resolves all own simultaneous triggers and chooses their order',()=>{
 const g=game('receive');add(g,'D01-009',0,'deck');add(g,'P03-048',0,'deck');add(g,'P03-048',1,'deck');
 const a=g.registerWatch(watch('character_entry','self',seq(draw())),0);
 const b=g.registerWatch(watch('character_entry','self',seq(draw())),0);
 g.registerWatch(watch('character_entry','opponent',seq(draw())),1);
 const c=add(g,'P04-027');g.enter(c,'receive');
 const jobs=g.state.events.filter(e=>e.type==='resolve_trigger');assert.deepEqual(jobs.map(j=>j.controller),[0,0,1]);
 assert.equal(g.state.decisions.find(d=>d.request.kind==='trigger_order').answer,jobs[0].id);
 assert.equal(g.zone(0,'hand').length,2);assert.equal(g.zone(1,'hand').length,1);assert.notEqual(a.id,b.id);
},['33']);
test('P04-037 one-touch keeps protected offense, cancels skipped pending effects and still applies its tail ban',()=>{
 const g=game('attack',1);g.state.ball={owner:1,kind:'attack',offense:8};const protect=add(g,'PR-051',1);g.playEvent(protect);g.endTurn();g.beginTurn(0,'block');
 g.registerWatch(watch('character_entry','opponent',seq(num('block',-2,'$event.character'))),1);
 const source=add(g,'P04-037');add(g,'P04-032');add(g,'P01-060',0,'drop');
 g.enter(source,'block');assert.equal(g.state.ball.offense,8);assert.equal(g.state.turn.phase,'draw');assert.equal(g.state.turn.step,'start');
 assert.equal(g.state.queue.length,0);assert.equal(g.state.events.filter(e=>e.type==='resolve_trigger'&&e.controller===1).length,0);
 assert.equal(g.permission({action:'enter_character',player:0,origin:'rule',role:'receive',name:'百沢雄大',printed:{position_tags:[],parameters:{receive:5}}}).allowed,false);
 assert.equal(g.zone(0,'hand').some(id=>g.card(id).cardNo==='HV-P01-060'),true);
},['1437','1195']);
test('A once-only effect instance does not resolve twice',()=>{
 const g=game('receive');add(g,'P03-048',0,'deck');add(g,'D01-009',0,'deck');
 const w=watch('character_entry','self',seq(draw()));w.remaining_uses=1;g.registerWatch(w,0);
 g.enter(add(g,'P04-027'),'receive');g.enter(add(g,'P04-026'),'receive');assert.equal(g.zone(0,'hand').length,1);
},['1359']);
test('Pending passive is canceled if the turn player invalidates it before it resolves',()=>{
 const g=game('block');add(g,'P03-096',0,'event');add(g,'P04-088',0,'event');const food=add(g,'P03-096',1);
 g.registerWatch(watch('character_entry','opponent',seq({kind:'invalidate_skill',actor:'opponent',duration:'this_turn',selector:{roles:['block']}})),0);
 const source=add(g,'P02-003',1);raw(g,seq({kind:'enter_self',destination:'block',as_side_blocker:false}),1,source);
 assert.equal(g.parameter(source,'block'),2);assert.equal(g.zone(1,'hand').includes(food),true);assert.equal(g.state.events.filter(e=>e.type==='resolve_trigger'&&e.controller===1).length,0);
},['33']);
test('Pending passive is canceled if its source is moved to a hidden zone',()=>{
 const g=game('block');add(g,'P03-096',0,'event');add(g,'P04-088',0,'event');const food=add(g,'P03-096',1);
 g.registerWatch(watch('character_entry','opponent',seq({kind:'move',pool:{kind:'selector',actor:'opponent',zone:'block',filters:{role:'character'}},destination:'owner.hand',count:1,count_mode:'exact'})),0);
 const source=add(g,'P02-003',1);raw(g,seq({kind:'enter_self',destination:'block',as_side_blocker:false}),1,source);
 assert.equal(g.zone(1,'hand').includes(source),true);assert.equal(g.zone(1,'hand').includes(food),true);assert.equal(g.state.events.filter(e=>e.type==='resolve_trigger'&&e.controller===1).length,0);
});

// Instance identity, set ordering and physical-card conservation.
test('Same card number entering again does not inherit the prior instance modifier',()=>{
 const g=game('receive');const one=add(g,'P04-027');g.enter(one,'receive');raw(g,seq(num('receive',2)),0,one);assert.equal(g.parameter(one,'receive'),8);
 const two=add(g,'P04-027');g.enter(two,'receive');assert.equal(g.parameter(two,'receive'),6);assert.equal(g.parameter(one,'receive'),6);
 const seen=g.state.events.filter(e=>e.type==='character_entry').length;
 raw(g,seq({kind:'move_self',destination:'owner.hand',reason:'effect'}),0,two);
 assert.equal(g.top(0,'receive'),one);assert.equal(g.parameter(one,'receive'),6);assert.equal(g.state.events.filter(e=>e.type==='character_entry').length,seen);
},['1124','1925']);
test('Nonpermanent add/set numeric operations follow resolution order',()=>{
 const g=game();const id=add(g,'D04-004',0,'attack');raw(g,seq(num('attack',2),num('attack',4,'source','set'),num('attack',-1)),0,id);assert.equal(g.parameter(id,'attack'),3);
});
test('Zero parameter is usable and dash is not silently converted to zero',()=>{
 const g=game('receive');const c=add(g,'P03-048');g.enter(c,'receive');assert.equal(g.parameter(c,'receive'),0);
 const dash=add(g,'P04-027');g.advancePhase('serve');unchangedAfter(g,()=>g.enter(dash,'serve'),IllegalAction);
},['7','8']);
test('General effect shortfall draws available cards while an exact payment is atomic',()=>{
 const g=game();add(g,'P03-048',0,'deck');raw(g,seq(draw('self',2)));assert.equal(g.zone(0,'hand').length,1);
 const before=g.snapshot();raw(g,seq({kind:'payment_branch',optional:true,require_complete:true,payment:seq({kind:'move',pool:{kind:'selector',actor:'self',zone:'hand',filters:{}},destination:'owner.drop',count:2,count_mode:'exact'}),then:seq(draw()),bind_payment_result:'paid'}));
 assert.deepEqual(g.state.zones,before.zones);assert.equal(g.state.queue.length,0);
},['30','1950']);
test('A second payment cannot reuse Guts already paid by a previous branch',()=>{
 const g=game();add(g,'D01-009',0,'attack');const c=add(g,'P03-048',0,'attack');
 const payment={kind:'payment_branch',optional:true,require_complete:true,payment:seq({kind:'pay_guts',areas:'source_area',count:1,count_mode:'exact',bind:'paid'}),then:seq(num('attack',1))};
 raw(g,seq(payment,payment),0,c);assert.equal(g.parameter(c,'attack'),3);assert.equal(g.zone(0,'drop').length,1);assert.equal(g.zone(0,'attack').length,1);
},['30','31']);
test('Restriction inputs missing a required role are not treated as allowed',()=>{
 const g=game();raw(g,seq(ban('enter_character','opponent',{role:'receive',printed_receive_gte:6})),0);
 assert.throws(()=>g.permission({action:'enter_character',player:1,origin:'rule'}),NeedsReview);
});
test('Draw-phase-only restrictions expire at the phase boundary',()=>{
 const g=game('draw');add(g,'D01-009',0,'deck');raw(g,seq(ban('add_hand','self',{origins:['rule','skill'],phases:['draw']},'this_draw_phase')));
 assert.equal(g.drawRule(0).length,0);g.advancePhase('receive');assert.equal(g.drawRule(0).length,1);
});
test('Non-draw hand-add watchers count a self return but do not count draws',()=>{
 const g=game();const source=add(g,'P03-096',0,'event');add(g,'D01-009',0,'deck');add(g,'P03-048',1,'deck');
 g.registerWatch(watch('hand_added','opponent',seq(draw()),'this_turn',{exclude_operations:['draw']}),1);
 g.drawRule(0);assert.equal(g.zone(1,'hand').length,0);
 raw(g,seq({kind:'move_self',destination:'owner.hand',reason:'effect'}),0,source);assert.equal(g.zone(1,'hand').length,1);
},['1158']);
test('A self return cannot bypass a hand-add restriction',()=>{
 const g=game();const source=add(g,'P03-096',0,'event');raw(g,seq(ban('add_hand','opponent',{origins:['skill']})),1);
 assert.equal(raw(g,seq({kind:'move_self',destination:'owner.hand',reason:'effect'}),0,source),false);assert.equal(g.zone(0,'event').includes(source),true);
});
test('Supported repeated settlement actions conserve cards and restore deterministically',()=>{
 let actions=0;
 for(let seed=1;seed<=20;seed++){
  const g=game('receive');for(let i=0;i<12;i++)add(g,'D01-009',0,'deck');const source=add(g,'P04-027');g.enter(source,'receive');
  const total=Object.keys(g.state.cards).length;let r=seed;
  for(let i=0;i<30;i++){
   r=(Math.imul(r,1664525)+1013904223)>>>0;
   const before=g.snapshot(),program=(r%2)?seq(num('receive',(r%5)-2)):seq(draw());
   raw(g,program,0,source);const after=g.snapshot();g.restore(before);raw(g,program,0,source);assert.deepEqual(g.snapshot(),after);
   g.assertState();assert.equal(Object.keys(g.state.cards).length,total);actions++;
  }
 }
 assert.equal(actions,600);
});

// Loss is not a normal turn-end; declared effects persist until loss cleanup.
test('P04-082 Loss effects run before interval even after their event source leaves',()=>{
 const g=game();add(g,'P03-048',0,'toss');add(g,'P01-004',0,'attack');const kg=add(g,'P03-048',0,'drop'),hi=add(g,'P01-004',0,'drop');
 const event=add(g,'P04-082');g.playEvent(event);raw(g,seq({kind:'move_self',destination:'owner.hand',reason:'effect'}),0,event);
 g.endTurn();g.beginTurn(1,'receive');add(g,'D01-009',1,'deck');g.registerWatch(watch('turn_end','self',seq(draw())),1);
 const before=g.zone(1,'deck').length;g.loss(1);assert.equal(g.state.stage,'loss_triggers');assert.equal(g.state.ball,null);
 assert.equal(g.zone(0,'toss').includes(kg),true);assert.equal(g.top(0,'toss')===kg,false);assert.equal(g.zone(0,'hand').includes(hi),true);
 assert.equal(g.zone(1,'deck').length,before);assert.equal(g.state.effects.some(e=>e.kind==='watch'&&g.active(e)),true);
 g.finishLoss();assert.equal(g.state.stage,'interval');assert.equal(g.state.effects.length,0);assert.equal(g.state.queue.length,0);
},['22','23','24','1921']);
test('Voluntary Loss is refused outside an idle free step without mutation',()=>{
 const g=game();g.advancePhase('receive','judge');unchangedAfter(g,()=>g.loss(0),IllegalAction);g.loss(0,{voluntary:false});assert.equal(g.state.stage,'loss_triggers');
});
test('Draw-phase-only bans no longer apply inside the separate Loss-set step',()=>{
 const g=game('draw');add(g,'D01-009',0,'deck');raw(g,seq(ban('add_hand','self',{origins:['rule','skill'],phases:['draw']},'this_draw_phase')));
 g.registerWatch(watch('loss','self',seq(draw())),0);g.loss(0);assert.equal(g.state.turn.phase,'loss_set');assert.equal(g.zone(0,'hand').length,1);
 g.finishLoss();assert.equal(g.state.turn.phase,'interval');
},['23','24']);
test('Loss is refused while a prior trigger remains pending',()=>{
 const g=game();g.state.queue.push({id:'pending',controller:0,program:seq(),generated:true,event:{},source:null});unchangedAfter(g,()=>g.loss(0),IllegalAction);
});

// Snapshots include all kernel state; neither opponent view contains hidden IDs nor raw queues.
test('Snapshot restore repeats the same state, choices, IDs and trigger outcomes',()=>{
 const g=game('receive');add(g,'P03-048',0,'deck');g.registerWatch(watch('character_entry','self',seq(draw())),0);const id=add(g,'P04-027');const before=g.snapshot();
 g.enter(id,'receive');const after=g.snapshot();g.restore(before);g.enter(id,'receive');assert.deepEqual(g.snapshot(),after);
});
test('State cannot be restored against a different data version',()=>{
 const g=game();const bad=g.snapshot();bad.fingerprint='other';unchangedAfter(g,()=>g.restore(bad),NeedsReview);
});
test('Sandbox state cannot be restored into a live kernel',()=>{
 const sandbox=game(),live=game('attack',0,decisions,'live');unchangedAfter(live,()=>live.restore(sandbox.snapshot()),NeedsReview);
});
test('Invalid snapshot conservation is rejected and the previous state is retained',()=>{
 const g=game();const id=add(g,'D01-009');const bad=g.snapshot();bad.zones['0.deck'].push(id);unchangedAfter(g,()=>g.restore(bad),NeedsReview);
});
test('Explicit practice override extends draw events before receive without changing their icons',()=>{
 const g=new Kernel({catalog,ruleIds:rules.rules.map(r=>r.id),fingerprint,mode:'sandbox',choose:decisions,practiceDrawBeforeReceive:true});g.state.turn.phase='receive';
 const event=add(g,'P03-090'),retrieved=add(g,'P03-096',0,'event');g.playEvent(event);
 assert.equal(g.zone(0,'hand').includes(retrieved),true);assert.deepEqual(g.profile(event).activation.activation_phases,['draw']);
 const skill=add(g,'P03-057');unchangedAfter(g,()=>g.useSkill(skill),IllegalAction);
});
test('Official default does not silently enable the practice window',()=>{
 const g=game('receive'),event=add(g,'P03-090');add(g,'P03-096',0,'event');unchangedAfter(g,()=>g.playEvent(event),IllegalAction);
});
test('Invalid physical selection rolls back all earlier draw and effect changes',()=>{
 const g=game();const target=add(g,'P03-048',0,'toss'),event=add(g,'P03-087');add(g,'D01-009',0,'deck');
 g.choose=req=>req.kind==='target'?['forged']:decisions(req);unchangedAfter(g,()=>g.playEvent(event),IllegalAction);assert.equal(g.parameter(target,'attack'),2);
});
test('Opponent public view exposes counts but not hidden cards or decisions',()=>{
 const g=game();const hidden=add(g,'P03-048',0,'hand'),deck=add(g,'D01-009',0,'deck');const view=g.view(1);
 assert.deepEqual(view.players[0].hand,{count:1});assert.deepEqual(view.players[0].deck,{count:1});
 assert.equal(JSON.stringify(view).includes(hidden),false);assert.equal(JSON.stringify(view).includes(deck),false);assert.equal('decisions' in view,false);assert.equal('queue' in view,false);
});

const summary={status:'SCOPED_SETTLEMENT_SCENARIOS_NOT_FULL_GAME_INTEGRATION',passed:cases.length,failed:0,cases};
console.log(JSON.stringify({passed:cases.length,failed:0}));
if(process.env.BREAK_RULES_REPORT)fs.writeFileSync(process.env.BREAK_RULES_REPORT,JSON.stringify(summary,null,2)+'\n');
