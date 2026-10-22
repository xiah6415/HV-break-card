"""Closed card-program schema and dependency-free validation of its JSON subset.

This validates data, not card legality or game execution. The exported schema is
JSON Schema 2020-12; the local validator implements only the keywords used here.
"""
import json
import re
import unicodedata

S = {'type': 'string', 'minLength': 1}
B = {'type': 'boolean'}
I = {'type': 'integer', 'minimum': 0}
INTEGER = {'type': 'integer'}
NULL = {'type': 'null'}

def enum(*values): return {'enum': list(values)}
def ref(name): return {'$ref': '#/$defs/' + name}
def union(*values): return {'anyOf': list(values)}
def array(item, minimum=0, unique=False):
    return {'type': 'array', 'items': item, 'minItems': minimum, **({'uniqueItems': True} if unique else {})}
def obj(properties, required=()):
    return {'type': 'object', 'properties': properties, 'required': list(required), 'additionalProperties': False}
STRINGS = array(S, 1, True)
PHASE = enum('serve', 'block', 'draw', 'receive', 'toss', 'attack', 'end', 'interval')
ROLE = enum('serve', 'block', 'receive', 'toss', 'attack', 'center_blocker', 'side_blocker', 'character')
ZONE = enum('hand', 'deck', 'drop', 'event', 'serve', 'block', 'receive', 'toss', 'attack',
            'court', 'court.guts', 'receive.guts', 'attack.guts', 'block.guts', 'toss.guts',
            'serve.guts', 'event_or_drop', '$milled', 'entering_card')
ACTOR = enum('self', 'opponent', 'owner', 'controller', 'affected_player')
PARAM = enum('serve', 'block', 'receive', 'toss', 'attack', 'offense', 'attack_offense', 'defense', 'all', 'chosen')
DURATION = enum('this_turn', 'next_opponent_turn', 'this_draw_phase',
                'current_turn_cleanup_or_role_exit', 'this_turn_or_role_exit', 'unspecified_in_this_print')
FILTER_FIELDS = {k: STRINGS for k in [
    'names', 'exclude_names', 'covered_names', 'tags', 'tags_any', 'positions',
    'positions_any', 'position_has_any_other_than', 'exclude_operations', 'entry_origins']}
FILTER_FIELDS.update({k: array(PHASE, 1, True) for k in ['play_icons_any', 'play_icons_exact']})
FILTER_FIELDS.update({k: array({'type': 'integer', 'minimum': 1, 'maximum': 3}, 1, True)
                      for k in ['years', 'years_any']})
FILTER_FIELDS.update({k: INTEGER for k in [
    'printed_attack', 'printed_attack_eq', 'printed_block_gte', 'printed_receive_gte',
    'current_receive_gte', 'current_block_eq']})
FILTER_FIELDS.update(role=ROLE, role_any=array(ROLE, 1, True), type=enum('character', 'event'),
                     skillless=B, phase=PHASE, entry_keyword_family=S, from_zone=ZONE, to_zone=ZONE)
META = dict(node_id=S, shared_rule_ids=array(S, unique=True),
            category_tags=array(enum('數值', '資源與移動', '角色與身分', '行動權限', '技能權限', '流程與觸發'), 1, True),
            classification_role=enum('payment', 'effect'), polarity=union(enum('beneficial', 'adverse', 'neutral', 'contextual'), NULL))
DEFS = {
    'filters': obj(FILTER_FIELDS),
    'target_scope': {'oneOf': [
        obj(dict(mode={'const': 'single'}, binding=enum('reference', 'choose'), membership={'const': 'snapshot_on_resolution'}), ['mode', 'binding', 'membership']),
        obj(dict(mode={'const': 'multiple'}, binding={'const': 'choose'}, membership={'const': 'snapshot_on_resolution'},
                 count={'type': 'integer', 'minimum': 2}, count_mode=enum('exact', 'upto')), ['mode', 'binding', 'membership', 'count', 'count_mode']),
        obj(dict(mode={'const': 'all'}, binding={'const': 'all_matches'}, membership=enum('snapshot_on_resolution', 'continuous_matching', 'unresolved')), ['mode', 'binding', 'membership']),
    ]},
}
NODES = {}
def node(kind, properties, required):
    definition = obj(dict(kind={'const': kind}, **META, **properties), ['kind', *required])
    DEFS[kind] = definition
    NODES[kind] = definition

COUNT = dict(count=union(I, {'const': 'all'}), count_mode=enum('exact', 'upto', 'all', 'one_of_exact', 'exact_each', 'exact_or_zero'),
             allowed_counts=array({'type': 'integer', 'minimum': 1}, 1, True), count_each=I)
TARGET = union(enum('source', '$target', '$entered', '$event.character', 'self_ball', 'opponent_ball', 'opponent.center_blocker'), ref('selector'))
VALUE = union(INTEGER, ref('printed_parameter'), ref('sum_result_parameter'), ref('result_count'))
PARAMETER = union(PARAM, obj({'choose_from': array(PARAM, 1, True)}, ['choose_from']))
node('sequence', dict(steps=array(ref('node'))), ['steps'])
node('conditional', dict(condition=ref('predicate'), then=ref('sequence'), evaluate_once={'const': True}), ['condition', 'then', 'evaluate_once'])
for k in ['all', 'any']: node(k, dict(conditions=array(ref('predicate'), 1)), ['conditions'])
node('compare', dict(field=S, op=enum('eq', 'gte', 'lte', 'in', 'contains', 'odd', 'lt_field'),
                     value=union(S, INTEGER, B, array(S)), checkpoint={'const': 'when_condition_reached'}), ['field', 'op', 'value', 'checkpoint'])
node('equal_fields', dict(fields=array(S, 2, True)), ['fields'])
node('selector', dict(actor=ACTOR, zone=ZONE, filters=ref('filters')), ['actor', 'zone', 'filters'])
node('count_compare', dict(pool=ref('selector'), op=enum('eq', 'gte', 'lte'), value=I,
                           distinct_by=union(S, NULL)), ['pool', 'op', 'value', 'distinct_by'])
node('uniform_affiliation', dict(pool=ref('selector'), pools=array(ref('selector'), 1), options=STRINGS,
                                require_nonempty={'const': True}, quantifier={'const': 'one_tag_shared_by_all'},
                                nonempty_policy={'const': 'union_not_each_pool'}), ['options', 'require_nonempty'])
node('all_result_cards_match', dict(result=S, filters=ref('filters'), require_nonempty={'const': True}), ['result', 'filters', 'require_nonempty'])
node('numeric', dict(operation=enum('add', 'set'), parameter=PARAMETER, value=VALUE, target=TARGET,
                     target_scope=ref('target_scope'), bind=S, duration=DURATION,
                     evaluation_order=array(S, 1), depends_on_result=S, if_result_has_no_target={'const': 'skip_this_step_only'},
                     increase_guard=ref('source_skill_maximum'), proposed_shared_rule_id=S),
     ['operation', 'parameter', 'value', 'target', 'target_scope', 'bind', 'duration'])
node('payment_branch', dict(payment=ref('sequence'), then=ref('sequence'), optional={'const': True},
                            require_complete={'const': True}, bind_payment_result=S), ['payment', 'then', 'optional', 'require_complete', 'bind_payment_result'])
node('pay_guts', dict(**COUNT, areas=union(enum('source_area', 'court'), array(enum('serve', 'block', 'receive', 'toss', 'attack'), 1, True)), bind=S), ['areas', 'count_mode', 'bind'])
for kind, bind in [('draw', 'drawn'), ('mill', 'milled'), ('reveal_top', 'revealed')]:
    node(kind, dict(count=I, count_mode=enum('exact', 'upto'), actor=ACTOR, bind={'const': bind}), ['count', 'count_mode', 'actor', 'bind'])
node('draw_to_hand_size', dict(actor=ACTOR, hand_size=I, bind=S), ['actor', 'hand_size', 'bind'])
CONSTRAINTS = obj(dict(single_area=B, distinct_names=B, shared_affiliation=B))
node('move', dict(**COUNT, pool=ref('selector'), destination=S, bind=S, reason=enum('effect', 'effect_placement_not_play'),
                  requires_character_at_destination=B), ['pool', 'destination', 'count_mode'])
node('move_self', dict(destination=S, reason=enum('declaration_cost', 'effect'), bind=S), ['destination', 'reason'])
node('move_result', dict(result=S, destination=S, order=enum('chooser')), ['result', 'destination', 'order'])
node('retrieve', dict(count=I, count_mode=enum('exact', 'upto'), pool=ref('selector'), destination=S,
                      bind=S, group_constraints=CONSTRAINTS), ['count', 'count_mode', 'pool', 'destination', 'bind'])
node('retrieve_slots', dict(slots=array(ref('retrieve'), 1), destination=S, bind=S, distinct_instances={'const': True}), ['slots', 'destination', 'bind', 'distinct_instances'])
node('enter', dict(count=I, count_mode=enum('exact', 'upto'), pool=ref('selector'), destination=enum('serve', 'block', 'receive', 'toss', 'attack'), as_side_blocker=B, bind=S), ['count', 'count_mode', 'pool', 'destination', 'as_side_blocker', 'bind'])
node('enter_self', dict(destination=enum('serve', 'block', 'receive', 'toss', 'attack'), as_side_blocker=B, bind=S), ['destination', 'as_side_blocker', 'bind'])
selection = obj(dict(filters=ref('filters'), count=union(I, {'const': 'all'}), count_mode=enum('exact', 'upto', 'all'),
                     reveal_selected=B, bind=S), ['filters', 'count', 'count_mode', 'reveal_selected', 'bind'])
secondary = obj(dict(when_primary_added=B, filters=ref('filters'), count=I, count_mode=enum('exact', 'upto'), from_remaining=B), ['when_primary_added', 'filters', 'count', 'count_mode', 'from_remaining'])
node('deck_selection', dict(actor=ACTOR, top_count=I, visibility=enum('look', 'reveal'), selection=selection,
                            secondary_selection=union(secondary, NULL), remainder=obj(dict(destination=enum('deck_bottom', 'choose_deck_top_or_bottom'),
                            order={'const': 'chooser'}, choice_applies_to={'const': 'whole_remainder'}), ['destination', 'order', 'choice_applies_to']), bind=S),
     ['actor', 'top_count', 'visibility', 'selection', 'secondary_selection', 'remainder', 'bind'])
node('watch', dict(event=enum('character_entry', 'block_success', 'hand_added', 'loss', 'source_moved'),
                   actor=ACTOR, filters=ref('filters'), duration=DURATION, per_object={'const': True},
                   remaining_uses=union({'type': 'integer', 'minimum': 1}, NULL), then=ref('sequence')),
     ['event', 'actor', 'filters', 'duration', 'per_object', 'remaining_uses', 'then'])
node('keyword', dict(keyword=enum('doshat', 'one_touch', 'feint', 'blockout', 'a_pass', 'two_attack', 'back_attack', 'multi_attack'),
                     N=I, parameters=obj(dict(affiliation=S))), ['keyword', 'N', 'parameters'])
scope_fields = dict(FILTER_FIELDS, max_count=I, origins=array(enum('rule', 'skill'), 1, True), phases=array(PHASE, 1, True))
node('ban_action', dict(action=enum('enter_character', 'play_event', 'add_hand'), actor=ACTOR, duration=DURATION, scope=obj(scope_fields)), ['action', 'actor', 'duration', 'scope'])
skill_selector = dict(roles=array(ROLE, 1, True), keyword_families=STRINGS, names=STRINGS,
                      type=enum('event', 'character'), play_icons_any=array(PHASE, 1, True), phase_tags=array(PHASE, 1, True), source_zones=array(ZONE, 1, True))
DEFS['skill_selector'] = obj(dict(skill_selector, union_with=obj(skill_selector)))
node('invalidate_skill', dict(actor=ACTOR, duration=DURATION, selector=ref('skill_selector')), ['actor', 'duration', 'selector'])
node('protect_numeric_decrease', dict(target=TARGET, target_scope=ref('target_scope'), duration=DURATION, parameter=PARAM), ['target', 'target_scope', 'duration', 'parameter'])
node('exchange', dict(sides=array(ref('selector'), 2), count_each=I, count_mode={'const': 'upto'}, requires_both={'const': True}, atomic_movement={'const': True}), ['sides', 'count_each', 'count_mode', 'requires_both', 'atomic_movement'])
node('phase_jump', dict(actor=ACTOR, destination={'const': 'draw'}, position={'const': 'start'}, skip_current={'const': True}), ['actor', 'destination', 'position', 'skip_current'])
node('external_action', dict(action=S, bind=S, alternative_requires_both_consent=B), ['action', 'bind'])
node('optional', dict(then=ref('sequence'), bind=S, actor=enum('self','opponent')), ['then', 'bind'])
node('choose_modes', dict(count={'const': 1}, options=array(ref('sequence'), 1), required={'const': True}), ['count', 'options', 'required'])
node('parameter_absent', dict(target=TARGET, target_scope=ref('target_scope'), parameter=PARAM, duration=DURATION), ['target', 'target_scope', 'parameter', 'duration'])
node('force_judgment_failure', dict(judge=enum('serve', 'block', 'receive', 'toss', 'attack'), actor=ACTOR, duration=DURATION, condition=ref('predicate')), ['judge', 'actor', 'duration', 'condition'])
node('cover_source_with_guts', dict(pool=ref('selector'), count=I, count_mode={'const': 'exact'}), ['pool', 'count', 'count_mode'])
node('simultaneous_entry_group', dict(entries=array(ref('enter'), 1), complete_group_before_triggers={'const': True}), ['entries', 'complete_group_before_triggers'])
node('shuffle', dict(actor=ACTOR), ['actor'])
node('reveal_and_retrieve', dict(top_count=I, count_mode=enum('exact', 'upto'), filters=ref('filters'),
                                remainder={'const': 'deck_bottom'}, bind=S, retrieved_bind=S), ['top_count', 'count_mode', 'filters', 'remainder', 'bind', 'retrieved_bind'])
node('each_player_optional_draw', dict(count=I, count_mode={'const': 'exact_or_zero'}, chooser={'const': 'each_affected_player'}), ['count', 'count_mode', 'chooser'])
node('rename_before_entry', dict(target=TARGET, target_scope=ref('target_scope'), original_name=S, choose_name=STRINGS,
                                 duration=DURATION, character_count={'const': 1}), ['target', 'target_scope', 'original_name', 'choose_name', 'duration', 'character_count'])
node('printed_parameter', dict(parameter=PARAM, of=S), ['parameter', 'of'])
node('sum_result_parameter', dict(result=S, parameter=PARAM), ['result', 'parameter'])
node('result_count', dict(result=S), ['result'])
node('source_skill_maximum', dict(max_result=INTEGER, only_this_skill={'const': True}, never_reduce_other_source_value={'const': True}), ['max_result', 'only_this_skill', 'never_reduce_other_source_value'])
node('formal_declaration_cost', dict(steps=array(ref('node'), 1), must_be_complete={'const': True}, performed_for_this_skill_only={'const': True}), ['steps', 'must_be_complete', 'performed_for_this_skill_only'])
PREDICATES = ['all', 'any', 'compare', 'equal_fields', 'count_compare', 'uniform_affiliation', 'all_result_cards_match']
DEFS['predicate'] = {'oneOf': [ref(k) for k in PREDICATES]}
DEFS['node'] = {'oneOf': [ref(k) for k in NODES]}
DEFS['trigger'] = obj(dict(event=enum('before_entry', 'self_entry', 'self_entry_cover', 'source_covered', 'character_entry', 'event_played'),
                           actor=ACTOR, source_role=union(ROLE, NULL), source_role_checkpoint=enum('before_coverage', 'at_trigger'),
                           destination_any=array(ZONE, 1, True), filters=ref('filters')), ['event'])
DEFS['activation'] = obj(dict(skill_type=enum('event', 'permanent_entry_name', 'active', 'passive'), activation_phases=array(PHASE, unique=True),
                              source_zones=array(ZONE, 1, True), trigger=union(ref('trigger'), NULL),
                              window=enum('free_step_after_required_draw_and_entry_checks', 'trigger_check_process'),
                              reveal_source_on_declaration=B, explicit_phase_gate_only={'const': True}),
                         ['skill_type', 'activation_phases', 'source_zones', 'trigger', 'window', 'reveal_source_on_declaration', 'explicit_phase_gate_only'])
DEFS['skill_contract'] = obj(dict(program=union(ref('sequence'), NULL), formal_cost=union(ref('formal_declaration_cost'), NULL),
                                  activation=union(ref('activation'), NULL)), ['program', 'formal_cost', 'activation'])
SCHEMA = {'$schema': 'https://json-schema.org/draft/2020-12/schema', 'title': 'BREAK skill program contract v2',
          '$ref': '#/$defs/skill_contract', '$defs': DEFS}

class ContractError(ValueError): pass
def fail(path, message): raise ContractError(f'{path}: {message}')
def validate(value, definition, path='$'):
    """Validate the explicitly used schema subset; booleans are not integers."""
    if '$ref' in definition:
        name = definition['$ref'].removeprefix('#/$defs/')
        if name in ['node', 'predicate'] and isinstance(value, dict):
            kind = value.get('kind')
            allowed = PREDICATES if name == 'predicate' else NODES
            if kind not in allowed: fail(path, f'unknown {name} kind: {kind!r}')
            return validate(value, DEFS[kind], path)
        return validate(value, DEFS[name], path)
    for keyword in ['anyOf', 'oneOf']:
        if keyword in definition:
            matches = 0
            errors = []
            for choice in definition[keyword]:
                try: validate(value, choice, path); matches += 1
                except ContractError as error: errors.append(str(error))
            if not matches or keyword == 'oneOf' and matches != 1:
                fail(path, f'{keyword} matched {matches}; ' + ' | '.join(errors[:2]))
            return
    if 'const' in definition and (type(value) != type(definition['const']) or value != definition['const']): fail(path, 'wrong constant')
    if 'enum' in definition and not any(type(value) == type(v) and value == v for v in definition['enum']): fail(path, 'value outside enum')
    types = dict(string=str, boolean=bool, integer=int, object=dict, array=list, null=type(None))
    if 'type' in definition and type(value) is not types[definition['type']]: fail(path, f"expected {definition['type']}")
    if isinstance(value, dict) and definition.get('type') == 'object':
        missing = set(definition['required']) - set(value)
        if missing: fail(path, f'missing fields: {sorted(missing)}')
        unknown = set(value) - set(definition['properties'])
        if unknown: fail(path, f'unknown fields: {sorted(unknown)}')
        for key, child in value.items(): validate(child, definition['properties'][key], path + '.' + key)
    elif isinstance(value, list) and definition.get('type') == 'array':
        if len(value) < definition.get('minItems', 0): fail(path, 'too few items')
        if definition.get('uniqueItems') and len({json.dumps(v, sort_keys=True) for v in value}) != len(value): fail(path, 'duplicate items')
        for i, child in enumerate(value): validate(child, definition['items'], f'{path}[{i}]')
    elif type(value) is int:
        if value < definition.get('minimum', value) or value > definition.get('maximum', value): fail(path, 'integer outside bounds')
    elif isinstance(value, str) and len(value) < definition.get('minLength', 0): fail(path, 'empty string')

def walk(value, path='$'):
    if isinstance(value, dict):
        yield path, value
        for key, child in value.items(): yield from walk(child, path + '.' + key)
    elif isinstance(value, list):
        for i, child in enumerate(value): yield from walk(child, f'{path}[{i}]')

def validate_semantics(value):
    for path, record in walk(value):
        mode = record.get('count_mode')
        if mode is not None:
            fields = {k for k in ['count', 'count_each', 'allowed_counts'] if k in record}
            expected = {'allowed_counts'} if mode == 'one_of_exact' else {'count_each'} if mode == 'exact_each' or record.get('kind') == 'exchange' else {'count'}
            if record.get('kind') == 'reveal_and_retrieve':
                if 'top_count' in record: fields.add('top_count')
                expected = {'top_count'}
            if mode == 'all':
                if fields - {'count'} or 'count' in record and record['count'] != 'all': fail(path, 'all-count conflict')
            elif fields != expected: fail(path, 'count mode requires exactly ' + str(sorted(expected)))
            if mode not in ['all', 'one_of_exact', 'exact_each'] and record.get('kind') not in ['exchange', 'reveal_and_retrieve'] and type(record.get('count')) is not int: fail(path, 'count must be an integer')
            if mode == 'one_of_exact' and record['allowed_counts'] != sorted(record['allowed_counts']): fail(path, 'allowed counts must be sorted')
        if 'target_scope' in record:
            scope, target = record['target_scope'], record['target']
            selector = isinstance(target, dict) and target.get('kind') == 'selector'
            if scope['binding'] == 'reference' and selector: fail(path, 'reference target cannot be a selector')
            if scope['binding'] in ['choose', 'all_matches'] and not selector: fail(path, 'selection requires a selector target')
        if record.get('kind') == 'uniform_affiliation':
            if ('pool' in record) == ('pools' in record): fail(path, 'exactly one of pool/pools required')
        if record.get('kind') == 'exchange' and len(record['sides']) != 2: fail(path, 'exchange requires two sides')
        if record.get('kind') == 'compare':
            op, operand = record['op'], record['value']
            if op in ['gte', 'lte'] and type(operand) is not int: fail(path, 'numeric comparison requires integer operand')
            if op == 'odd' and type(operand) is not bool: fail(path, 'odd comparison requires boolean operand')
            if op == 'in' and not isinstance(operand, list): fail(path, 'in comparison requires a list')
            if op in ['lt_field', 'contains'] and type(operand) is not str: fail(path, 'comparison requires a field/string operand')
        for key in ['names', 'exclude_names', 'covered_names', 'choose_name']:
            for name in record.get(key, []):
                normalized = re.sub(r'\s+', '', unicodedata.normalize('NFKC', name))
                if name != normalized: fail(path + '.' + key, 'name identifier is not normalized')

def validate_profile(profile):
    value = {k: profile[k] for k in ['program', 'formal_cost', 'activation']}
    validate(value, ref('skill_contract'))
    validate_semantics(value)
    if (value['program'] is None) != (value['activation'] is None): fail('$', 'skill program and activation must be present together')
    if value['program'] is None and value['formal_cost'] is not None: fail('$', 'no-skill profile cannot have a cost')
    activation = value['activation']
    if activation is not None:
        free_step = activation['skill_type'] in ['active', 'event']
        if free_step and (not activation['activation_phases'] or activation['trigger'] is not None): fail('$', 'active/event activation requires phases and no passive trigger')
        if not free_step and activation['trigger'] is None: fail('$', 'passive/entry-name activation requires a trigger')
        expected_window = 'free_step_after_required_draw_and_entry_checks' if free_step else 'trigger_check_process'
        if activation['window'] != expected_window: fail('$', 'activation window contradicts skill type')
    unresolved = any(n.get('target_scope', {}).get('membership') == 'unresolved'
                     for _, n in walk(value))
    if unresolved and 'TARGET_MEMBERSHIP_UNRESOLVED' not in profile.get('flags', []): fail('$', 'unresolved membership must have a visible flag')
    if unresolved and profile.get('runtime_approved'): fail('$', 'unresolved membership cannot be runtime approved')
    return sum('kind' in n for _, n in walk(value))

def validate_mapping(data):
    profiles = nodes = 0
    for card in data['cards']:
        for profile in card['profiles']:
            try: nodes += validate_profile(profile)
            except (ContractError, KeyError) as error:
                raise ContractError(f"{profile['profile_id']}: {error}") from error
            profiles += 1
    return dict(profiles=profiles, nodes=nodes, known_node_kinds=len(NODES))
