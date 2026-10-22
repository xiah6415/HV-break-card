"""Authoring helpers: data construction only; no card-specific game logic."""
import copy

def seq(*steps):
    return dict(kind='sequence',steps=list(steps))
def C(field, op, value):
    return dict(kind='compare',field=field,op=op,value=value,checkpoint='when_condition_reached')
def ALL(*conditions): return dict(kind='all',conditions=list(conditions))
def ANY(*conditions): return dict(kind='any',conditions=list(conditions))
def IF(condition,*steps): return dict(kind='conditional',condition=condition,then=seq(*steps),evaluate_once=True)
def SEL(zone='court',actor='self',**filters):
    return dict(kind='selector',actor=actor,zone=zone,filters=filters)
def SINGLE(target):
    return dict(mode='single',binding='choose' if isinstance(target,dict) else 'reference',membership='snapshot_on_resolution')
def MULTIPLE(count,mode='upto'):
    return dict(mode='multiple',binding='choose',count=count,count_mode=mode,membership='snapshot_on_resolution')
def ALL_TARGETS(membership):
    return dict(mode='all',binding='all_matches',membership=membership)
def role(name,**filters): return SEL(role=name,**filters)
def named(name,**filters): return SEL(names=[name],role='character',**filters)
def RN(area,name): return C(f'self.{area}.effective_name','eq',name)
def HAND(n,op='lte',actor='self'): return C(f'{actor}.hand.count',op,n)
def UNIFORM(*tags): return dict(kind='uniform_affiliation',pool=SEL(role='character'),options=list(tags),require_nonempty=True,quantifier='one_tag_shared_by_all')
def COUNT(pool,n,op='gte',distinct_by=None): return dict(kind='count_compare',pool=pool,op=op,value=n,distinct_by=distinct_by)
def EV(n,actor='self',op='gte',**filters): return COUNT(SEL('event',actor,**filters),n,op)
def DN(tag,n): return COUNT(SEL('drop',type='character',tags=[tag]),n,distinct_by='effective_name_in_current_zone')
def PAID(**filters): return dict(kind='all_result_cards_match',result='paid',filters=filters,require_nonempty=True)
def RESULTS(result='milled',**filters): return dict(kind='all_result_cards_match',result=result,filters=filters,require_nonempty=True)
def NUM(param,value,target='source',op='add',**extra):
    return dict(kind='numeric',operation=op,parameter=param,value=value,target=target,bind='target',**extra)
def MORE(param,value): return NUM(param,value,'$target')
def DRAW(n=1,actor='self',mode='exact'): return dict(kind='draw',actor=actor,count=n,count_mode=mode,bind='drawn')
def FILL(n,actor='self'): return dict(kind='draw_to_hand_size',actor=actor,hand_size=n,bind='drawn')
def DISC(n=1,zone='hand',actor='self',mode='exact',**filters): return dict(kind='move',pool=SEL(zone,actor,**filters),destination='owner.drop',count=n,count_mode=mode,bind='moved')
def DISC_CHOICE(counts,zone='hand',actor='self',**filters):
    return dict(kind='move',pool=SEL(zone,actor,**filters),destination='owner.drop',allowed_counts=counts,count_mode='one_of_exact',bind='moved')
def SELF_MOVE(destination,reason='effect'): return dict(kind='move_self',destination=destination,reason=reason,bind='moved')
def G(n,areas='source_area',mode='exact'): return dict(kind='pay_guts',areas=areas,count=n,count_mode=mode,bind='paid')
def GEACH(n,areas): return dict(kind='pay_guts',areas=areas,count_each=n,count_mode='exact_each',bind='paid')
def GCHOICE(counts,areas='source_area'): return dict(kind='pay_guts',areas=areas,allowed_counts=counts,count_mode='one_of_exact',bind='paid')
def PAY(payment,*steps):
    payments=payment if isinstance(payment,list) else [payment]
    return dict(kind='payment_branch',payment=seq(*payments),then=seq(*steps),optional=True,require_complete=True,bind_payment_result='paid')
def RET(pool,n=1,mode='upto',**extra): return dict(kind='retrieve',pool=pool,destination='self.hand',count=n,count_mode=mode,bind='retrieved',**extra)
def GROUP_RET(slots): return dict(kind='retrieve_slots',slots=slots,destination='self.hand',bind='retrieved',distinct_instances=True)
def ENTRY(pool,area,n=1,mode='upto',side=False): return dict(kind='enter',pool=pool,destination=area,count=n,count_mode=mode,as_side_blocker=side,bind='entered')
def SELF_ENTRY(area,side=False): return dict(kind='enter_self',destination=area,as_side_blocker=side,bind='entered')
def SEARCH(n,pool_filter,visibility='look',rest='deck_bottom',count=1,mode='upto',secondary=None):
    return dict(kind='deck_selection',actor='self',top_count=n,visibility=visibility,
                selection=dict(filters=pool_filter,count=count,count_mode=mode,reveal_selected=True,bind='retrieved'),
                secondary_selection=secondary,remainder=dict(destination=rest,order='chooser',choice_applies_to='whole_remainder'),bind='revealed')
def MILL(n,mode='exact',actor='self'): return dict(kind='mill',actor=actor,count=n,count_mode=mode,bind='milled')
def REVEAL(n=1,mode='exact'): return dict(kind='reveal_top',actor='self',count=n,count_mode=mode,bind='revealed')
def BOTTOM_RESULT(result='revealed'): return dict(kind='move_result',result=result,destination='owner.deck_bottom',order='chooser')
def PLACE(n=1,actor='self',**filters): return dict(kind='move',pool=SEL('hand',actor,**filters),destination=f'{actor}.event',count=n,count_mode='exact',reason='effect_placement_not_play',bind='moved')
def HAND_DECK(n=1,where='deck_bottom',actor='self'): return dict(kind='move',pool=SEL('hand',actor),destination=f'{actor}.{where}',count=n,count_mode='exact',bind='moved')
def KW(name,n,**params): return dict(kind='keyword',keyword=name,N=n,parameters=params)
def ON(event,duration,*steps,actor='self',filters=None,limit=None):
    return dict(kind='watch',event=event,actor=actor,filters=filters or {},duration=duration,per_object=True,remaining_uses=limit,then=seq(*steps))
def BAN(action,duration='next_opponent_turn',actor='opponent',**scope): return dict(kind='ban_action',action=action,actor=actor,duration=duration,scope=scope)
def INVALID(duration='next_opponent_turn',actor='opponent',**selector): return dict(kind='invalidate_skill',actor=actor,duration=duration,selector=selector)
def PROTECT(target='source',duration='this_turn',parameter='all',scope=None):
    if isinstance(target,dict) and scope is None:
        raise ValueError('Protection selectors require an explicit target scope')
    return dict(kind='protect_numeric_decrease',target=target,duration=duration,parameter=parameter,target_scope=scope or SINGLE(target))
def EXCHANGE(a,b,count=1): return dict(kind='exchange',sides=[a,b],count_each=count,count_mode='upto',requires_both=True,atomic_movement=True)
def JUMP(phase='draw'): return dict(kind='phase_jump',actor='self',destination=phase,position='start',skip_current=True)
def WATCH_NUM(area,param,value,duration='next_opponent_turn',actor='opponent',filters=None,op='add'):
    f=dict(role=area,**(filters or {}))
    return ON('character_entry',duration,NUM(param,value,'$event.character',op=op),actor=actor,filters=f)
def COIN(): return dict(kind='external_action',action='coin',bind='random',alternative_requires_both_consent=True)
def EXTERNAL(action): return dict(kind='external_action',action=action,bind='external')
def OPT(*steps,actor=None): return dict(kind='optional',then=seq(*steps),bind='optional',**({'actor':actor} if actor else {}))
def CHOOSE(*options): return dict(kind='choose_modes',count=1,options=[seq(*o) if isinstance(o,list) else seq(o) for o in options],required=True)
def RETURN_HAND_DRAW(n,actor='opponent'):
    return seq(dict(kind='move',pool=SEL('hand',actor),destination=f'{actor}.deck',count_mode='all',reason='effect',bind='moved'),dict(kind='shuffle',actor=actor),DRAW(n,actor))
def T(event,source_role=None,actor='self',**filters): return dict(event=event,actor=actor,source_role=source_role,source_role_checkpoint='before_coverage' if event=='source_covered' else 'at_trigger',filters=filters)
def WHICH(a,b): return dict(kind='equal_fields',fields=[a,b])
def ADDED(n=1,op='gte'): return C('retrieved.count',op,n)
def TAKE_GUTS(pool,area,n=1,mode='upto'): return dict(kind='move',pool=pool,destination=f'self.{area}.guts',count=n,count_mode=mode,requires_character_at_destination=True,bind='moved')
PROGRAMS={}
TRIGGERS={}
NOTES={}
def P(key,*steps,trigger=None,note=None):
    key=key if key.startswith('HV') else 'HV-'+key
    assert key not in PROGRAMS,key
    PROGRAMS[key]=seq(*steps)
    if trigger: TRIGGERS[key]=trigger
    if note: NOTES[key]=note
def COPY(key,other):
    key=key if key.startswith('HV') else 'HV-'+key
    other=other if other.startswith('HV') else 'HV-'+other
    assert key not in PROGRAMS
    PROGRAMS[key]=copy.deepcopy(PROGRAMS[other])
    if other in TRIGGERS: TRIGGERS[key]=copy.deepcopy(TRIGGERS[other])
