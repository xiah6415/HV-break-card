"""Small reference decisions for already-filtered IDs; no game mutations.

These do not perform pool filtering, permission checks, or card movement. Unknown
mechanisms fail explicitly. They will need a game-state adapter in the next step.
"""
from schema import ContractError, ref, validate, validate_semantics

class ChoiceError(ValueError): pass
class UnresolvedMembership(ValueError): pass

def checked_ids(values):
    if not isinstance(values, list) or any(type(x) is not str or not x for x in values):
        raise ChoiceError('IDs must be a list of nonempty strings')
    if len(set(values)) != len(values): raise ChoiceError('Duplicate physical IDs')
    return values

def choose_from(eligible, chosen):
    checked_ids(eligible); checked_ids(chosen)
    if not set(chosen) <= set(eligible): raise ChoiceError('Chosen object is not eligible')
    return chosen

def payment_choice(action, eligible, chosen):
    validate(action, ref('node')); validate_semantics(action)
    if action['kind'] not in ['move', 'pay_guts', 'cover_source_with_guts']:
        raise ChoiceError('Unsupported payment action')
    if action['count_mode'] not in ['exact', 'one_of_exact']:
        raise ChoiceError('Unsupported complete-payment quantity mode')
    checked_ids(eligible)
    if chosen is None: return dict(status='DECLINED', performed=False, count=0, ids=[])
    choose_from(eligible, chosen)
    allowed = action['allowed_counts'] if action['count_mode'] == 'one_of_exact' else [action['count']]
    if len(chosen) not in allowed: raise ChoiceError('Incomplete or invalid payment count')
    return dict(status='COMPLETE', performed=True, count=len(chosen), ids=list(chosen))

def target_ids(scope, eligible, chosen=None, reference_id=None):
    validate(scope, ref('target_scope')); validate_semantics(scope)
    checked_ids(eligible)
    if scope['membership'] == 'unresolved': raise UnresolvedMembership('Membership needs an official interpretation')
    if scope['mode'] == 'all':
        if chosen is not None or reference_id is not None: raise ChoiceError('All targets are not a player choice')
        return list(eligible)
    if scope['binding'] == 'reference':
        if chosen is not None or reference_id not in eligible: raise ChoiceError('Invalid bound target')
        return [reference_id]
    if reference_id is not None or chosen is None: raise ChoiceError('Explicit selection required')
    choose_from(eligible, chosen)
    if scope['mode'] == 'single':
        if len(chosen) != 1: raise ChoiceError('Exactly one target required')
    elif scope['count_mode'] == 'exact' and len(chosen) != scope['count']:
        raise ChoiceError('Exact target count required')
    elif scope['count_mode'] == 'upto' and len(chosen) > scope['count']:
        raise ChoiceError('Too many targets')
    return list(chosen)

def projected_steps(sequence, facts):
    """Only the comparison subset used by the payment fixture; not a game VM."""
    result = []
    for step in sequence['steps']:
        if step['kind'] == 'conditional':
            condition = step['condition']
            if condition['kind'] != 'compare' or condition['op'] not in ['eq', 'gte', 'lte']:
                raise ChoiceError('Unsupported projection condition')
            actual = facts[condition['field']]
            expected = condition['value']
            passed = {'eq': actual == expected, 'gte': actual >= expected, 'lte': actual <= expected}[condition['op']]
            if passed: result += projected_steps(step['then'], facts)
        else: result.append(step)
    return result
