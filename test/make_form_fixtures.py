import json, copy

base = json.load(open('test/fixtures/base_simple.json'))
src = base['database']['table']['fakulti']

def fld(name, dtype, disp, order, **kw):
    f = copy.deepcopy(src['fields']['nama_fakulti'])
    f['field_name'] = name
    f['data_type'] = dtype
    f['display_type'] = disp
    f['field_order'] = order
    f['caption'] = kw.pop('caption', name.replace('_', ' ').title())
    f['primary_key'] = 0
    f['auto_increment'] = 0
    f['unique'] = 0
    f['required'] = 0
    for k, v in kw.items():
        f[k] = v
    return f

def make_tempahan():
    t = copy.deepcopy(src)
    t['table_id'] = 91
    t['table_name'] = 'tempahan'
    t['module_name'] = 'Tempahan'
    t['table_view_title'] = 'Tempahan'
    specs = [
        ('nama', 'VARCHAR', 'text_input', 1, {}),
        ('country', 'VARCHAR', 'options_list', 2, {'options_display': 'dropdown', 'options_list_values': 'MY;;SG;;TH'}),
        ('state', 'VARCHAR', 'options_list', 3, {'options_display': 'dropdown', 'options_list_values': 'Johor;;Selangor;;Perlis'}),
        ('notes', 'TEXT', 'text_area', 4, {}),
        ('agree', 'BOOLEAN', 'check_box', 5, {}),
    ]
    fid = 9100
    t['fields'] = {k: v for k, v in src['fields'].items() if k in ('id', 'created_at', 'updated_at', 'deleted_at')}
    for name, dtype, disp, order, kw in specs:
        f = fld(name, dtype, disp, order, **kw)
        f['field_id'] = fid
        fid += 1
        t['fields'][name] = f
    return t

def variant(**mut):
    v = copy.deepcopy(base)
    v['database']['table']['tempahan'] = make_tempahan()
    for path, val in mut.items():
        obj = v
        parts = path.split('.')
        for p in parts[:-1]:
            obj = obj[int(p)] if p.isdigit() else obj[p]
        obj[parts[-1]] = val
    return v

T = 'database.table.tempahan'

# 1) grouped
v = variant()
v['database']['table']['tempahan']['form_layout_config'] = json.dumps({
    'style': 'grouped', 'columns': 2,
    'groups': [
        {'key': 'your_info', 'title': 'Your Info', 'description': 'Basic details'},
        {'key': 'travel_info', 'title': 'Travel Info', 'collapsible': True},
    ],
    'ungrouped_title': 'Other'})
v['database']['table']['tempahan']['fields']['nama']['form_group'] = 'your_info'
v['database']['table']['tempahan']['fields']['country']['form_group'] = 'travel_info'
v['database']['table']['tempahan']['fields']['state']['form_group'] = 'travel_info'
v['database']['table']['tempahan']['fields']['agree']['label_display'] = 'inline'
json.dump(v, open('test/fixtures/form_grouped.json', 'w'), indent=2)

# 2) conditional
v = variant()
v['database']['table']['tempahan']['form_layout_config'] = json.dumps({'style': 'grouped', 'groups': [{'key': 'core', 'title': 'Core'}]})
v['database']['table']['tempahan']['fields']['state']['visible_if'] = json.dumps({'field': 'country', 'op': 'equals', 'value': 'MY'})
v['database']['table']['tempahan']['fields']['state']['required_if_state'] = json.dumps({'field': 'country', 'op': 'equals', 'value': 'MY'})
v['database']['table']['tempahan']['fields']['notes']['visible_if'] = json.dumps({'field': 'agree', 'op': 'checked'})
json.dump(v, open('test/fixtures/form_conditional.json', 'w'), indent=2)

# 3) label modes
v = variant()
v['database']['table']['tempahan']['form_layout_config'] = json.dumps({'style': 'grouped', 'label_display': 'hidden_placeholder', 'groups': [{'key': 'g1', 'title': 'G1'}]})
v['database']['table']['tempahan']['fields']['nama']['label_display'] = 'inline'
v['database']['table']['tempahan']['fields']['country']['label_display'] = 'above'
json.dump(v, open('test/fixtures/form_label_modes.json', 'w'), indent=2)

# 4) wizard
v = variant()
v['database']['table']['tempahan']['form_layout_config'] = json.dumps({'style': 'wizard', 'groups': [{'key': 's1', 'title': 'Step One'}, {'key': 's2', 'title': 'Step Two'}]})
v['database']['table']['tempahan']['fields']['nama']['form_group'] = 's1'
v['database']['table']['tempahan']['fields']['country']['form_group'] = 's1'
v['database']['table']['tempahan']['fields']['state']['form_group'] = 's2'
v['database']['table']['tempahan']['fields']['notes']['form_group'] = 's2'
json.dump(v, open('test/fixtures/form_wizard.json', 'w'), indent=2)

# 5) accordion
v = variant()
v['database']['table']['tempahan']['form_layout_config'] = json.dumps({'style': 'accordion', 'groups': [{'key': 'a1', 'title': 'Section A'}, {'key': 'a2', 'title': 'Section B', 'collapsible': True, 'collapsed': True}]})
v['database']['table']['tempahan']['fields']['nama']['form_group'] = 'a1'
v['database']['table']['tempahan']['fields']['country']['form_group'] = 'a2'
json.dump(v, open('test/fixtures/form_accordion.json', 'w'), indent=2)

# 6) inline
v = variant()
v['database']['table']['tempahan']['form_layout_config'] = json.dumps({'style': 'inline'})
json.dump(v, open('test/fixtures/form_inline.json', 'w'), indent=2)

# 7) survey
v = variant()
v['database']['table']['tempahan']['form_layout_config'] = json.dumps({'style': 'survey', 'groups': [{'key': 'q1', 'title': 'Question 1'}, {'key': 'q2', 'title': 'Question 2'}]})
v['database']['table']['tempahan']['fields']['nama']['form_group'] = 'q1'
v['database']['table']['tempahan']['fields']['notes']['form_group'] = 'q2'
json.dump(v, open('test/fixtures/form_survey.json', 'w'), indent=2)

# 8) checkout
v = variant()
v['database']['table']['tempahan']['form_layout_config'] = json.dumps({'style': 'checkout', 'groups': [{'key': 'items', 'title': 'Order Items'}, {'key': 'billing', 'title': 'Billing'}]})
v['database']['table']['tempahan']['fields']['nama']['form_group'] = 'items'
v['database']['table']['tempahan']['fields']['country']['form_group'] = 'billing'
json.dump(v, open('test/fixtures/form_checkout.json', 'w'), indent=2)

print('fixtures written: form_grouped, form_conditional, form_label_modes, form_wizard, form_accordion, form_inline, form_survey, form_checkout')
