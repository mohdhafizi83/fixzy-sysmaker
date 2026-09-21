#!/usr/bin/env python3
"""Generate Phase 3 feature-axis fixtures from base_simple.json shape.

Run once: python3 test/fixtures/gen_phase3_fixtures.py
Each fixture exercises specific feature axes (see docs/FEATURE_MATRIX.md).
"""
import json, copy, os

HERE = os.path.dirname(os.path.abspath(__file__))
base = json.load(open(os.path.join(HERE, 'base_simple.json')))

# Templates extracted from the live-dump shape
users_table = copy.deepcopy(base['database']['table']['users'])
field_tpl = {
    "field_id": 900, "table_id": 900, "field_name": "x", "field_order": 0,
    "caption": None, "description": None, "data_type": "VARCHAR", "length": 255,
    "precision": None, "max_chars_in_tv": 50, "alignment": "left",
    "default_value": None, "read_only": 0, "primary_key": 0, "zero_fill": 0,
    "required": 0, "display_type": "text_input", "auto_increment": 0,
    "unique": 0, "is_indexed": 0, "show_sum": 0, "allow_sorting": 1,
    "tv_wrap_header": 0, "tv_wrap_text": 0, "tv_enable_toggle": 0,
    "tv_description_tooltips": 0, "tv_text_limit": 50, "tv_text_size": "Normal",
    "tv_font_weight": "Regular", "tv_date_time_format": "date_and_time",
    "tv_alignment": "left", "tv_text_color": None, "tv_icon": None,
    "tv_icon_color": None, "tv_currency_code": None, "unsigned": 0,
    "enable_global_filter": 1, "enable_individual_filter": 0,
    "enable_range_filter": 0, "binary": 0, "hide_in_tv": 0, "editable_in_tv": 0,
    "hide_in_dv": 0, "media_type": "link", "media_link_behavior": "detail_view",
    "media_link_display_as": "field_contents", "media_link_other_field": None,
    "allow_image_uploads": 0, "image_storage_provider": "local",
    "max_file_size": 250, "delete_image_server": 0, "dont_rename_image": 0,
    "tv_thumb_shape": "square", "tv_thumb_width": 50, "tv_thumb_height": 50,
    "tv_enable_zooming": 0, "tv_show_full_size": 0, "dv_thumb_shape": "square",
    "dv_thumb_width": 250, "dv_thumb_height": 250, "dv_enable_zooming": 0,
    "dv_show_full_size": 0, "allow_file_uploads": 0,
}
# extra keys seen on rich field dumps (from big_university)
extra_keys = ['accept_video_url','algorithm_enable','algorithm_logic','allow_file_uploads',
 'boolean_label_false','boolean_label_true','calculated_enable','calculated_query',
 'calculation_builder_state','column_span_full','display_gmap','file_behavior',
 'file_display_as','file_max_size','file_other_field','file_storage_provider',
 'file_types','format_as','format_mask','gmap_dv_height','gmap_tv_height',
 'gmap_tv_width','gmap_type','helper_text','hook_functions','lookup_caption_1',
 'lookup_caption_2','lookup_custom_query','lookup_display_as',
 'lookup_inherit_permissions','lookup_link_behavior','lookup_parent_table',
 'lookup_preload','lookup_searchable','lookup_separator','max_length','max_value',
 'min_length','min_value','not_null','off_autocomplete','options_display',
 'options_list_values','options_quick_list','placeholder','prefix',
 'repeater_1_display_as','repeater_1_format_as','repeater_1_list_values',
 'repeater_1_required','repeater_2_display_as','repeater_2_format_as',
 'repeater_2_list_values','repeater_2_required','repeater_3_display_as',
 'repeater_3_format_as','repeater_3_list_values','repeater_3_required',
 'repeater_simple_display_as','repeater_simple_format_as',
 'repeater_simple_list_values','repeater_simple_required','show_avg_summary',
 'show_count_summary','show_range_summary','suffix','suffix_icon',
 'suffix_icon_color','validations','youtube_dv_height','youtube_dv_width',
 'youtube_tv_height','youtube_tv_width']
for k in extra_keys:
    field_tpl.setdefault(k, None)

table_tpl = copy.deepcopy(base['database']['table']['fakulti'])
for k in ('fields', 'custom_modules', 'constraints'):
    table_tpl[k] = [] if k != 'fields' else {}

_fid = [1000]
_tid = [100]

def field(name, **ov):
    _fid[0] += 1
    f = copy.deepcopy(field_tpl)
    f.update({"field_id": _fid[0], "field_name": name, "caption": name.replace('_', ' ').title()})
    f.update(ov)
    return f

def table(name, fields, **ov):
    _tid[0] += 1
    t = copy.deepcopy(table_tpl)
    t.update({"table_id": _tid[0], "table_name": name, "module_name": name.replace('_', ' ').title()})
    t["fields"] = {f["field_name"]: f for f in fields}
    t["custom_modules"] = []
    t["constraints"] = []
    t.update(ov)
    return t

def rel(parent, child, fk, rtype="one-to-many", **ov):
    r = {"relationship_id": _fid[0] + 5000, "parent_table_id": 1, "child_table_id": 2,
         "fk_child_field": fk, "parent_field": "id", "relationship_type": rtype,
         "show_tab": 1, "show_icon": 0, "autoclose_modal": 0,
         "tab_title": child.replace('_', ' ').title(), "copy_records": 0,
         "show_link_above": 0, "show_count_in_tv": 0, "allow_add_from_tv": 1,
         "on_delete": "CASCADE", "on_update": "CASCADE",
         "parent_table_name": parent, "child_table_name": child}
    r.update(ov)
    return r

def menu_item(table_name, label=None, order=0, group=None, count=0):
    return {"type": "table_item", "order": order, "item_id": 7000 + order,
            "project_id": 1, "menu_group_id": group, "table_id": 1,
            "module_id": None, "item_label": label or table_name.title(),
            "item_detail": f"{table_name} Module", "item_order": order,
            "show_record_count": count, "table_name": table_name}

def flat_menu(*names):
    return [menu_item(n, order=i) for i, n in enumerate(names)]

def make(name, tables, rels=None, menu=None, **proj):
    p = copy.deepcopy(base['project'])
    p['app_title'] = name.replace('_', ' ').title()
    p.update(proj)
    doc = {"project": p, "database": {
        "name": name,
        "table": {"users": copy.deepcopy(users_table)},
        "relationships": rels or [],
        "unified_menu": menu or flat_menu('users'),
    }}
    for t in tables:
        doc['database']['table'][t['table_name']] = t
    # menu defaults: include all non-users tables too if menu was auto
    if menu is None:
        doc['database']['unified_menu'] = flat_menu('users', *[t['table_name'] for t in tables])
    out = os.path.join(HERE, name + '.json')
    json.dump(doc, open(out, 'w'), indent=1)
    print("wrote", out)

STD_TS = ["created_at", "updated_at"]

# ---------------------------------------------------------------- tenancy_1m
sekolah = table('sekolah', [
    field('id', data_type='INT', primary_key=1, auto_increment=1, read_only=1),
    field('nama_sekolah', length=150, required=1),
])
kelas = table('kelas', [
    field('id', data_type='INT', primary_key=1, auto_increment=1, read_only=1),
    field('sekolah_id', data_type='INT'),
    field('nama_kelas', length=100, required=1),
])
make('tenancy_1m', [sekolah, kelas],
     rels=[rel('sekolah', 'kelas', 'sekolah_id')],
     tenancy_type='one_to_many', tenant_table='sekolah')

# ---------------------------------------------------------------- tenancy_mm
organisasi = table('organisasi', [
    field('id', data_type='INT', primary_key=1, auto_increment=1, read_only=1),
    field('nama_organisasi', length=150, required=1),
])
produk = table('produk', [
    field('id', data_type='INT', primary_key=1, auto_increment=1, read_only=1),
    field('nama_produk', length=150, required=1),
    field('harga', data_type='DECIMAL', length=10, precision=2),
])
make('tenancy_mm', [organisasi, produk],
     rels=[rel('organisasi', 'produk', 'organisasi_id', 'many-to-many')],
     tenancy_type='many_to_many', tenant_table='organisasi')

# ---------------------------------------------------------------- row_owner
aset = table('aset', [
    field('id', data_type='INT', primary_key=1, auto_increment=1, read_only=1),
    field('nama_aset', length=150, required=1),
    field('created_by', data_type='INT'),
    field('updated_by', data_type='INT'),
], record_owner='current_user')
make('row_owner', [aset], data_delete_type='hard')

# ------------------------------------------------------- custom_module_basic
fakulti = table('fakulti', [
    field('id', data_type='INT', primary_key=1, auto_increment=1, read_only=1),
    field('nama_fakulti', length=150, required=1),
])
fakulti['custom_modules'] = [{
    "module_id": 21, "project_id": 1, "table_id": fakulti['table_id'],
    "module_name": "FakultiAktif", "module_order": 0, "menu_icon": "fas fa-list",
    "filter_rules": json.dumps({"condition": "AND", "rules": [{"column": "id", "operator": ">", "value": "0"}]}),
    "included_relations": None, "settings_override": None,
    "created_at": "2026-01-01 00:00:00", "updated_at": "2026-01-01 00:00:00",
    "fields": [],
}]
menu = flat_menu('users', 'fakulti')
menu.append({"type": "custom_view_item", "order": 9, "item_id": 7100,
            "project_id": 1, "menu_group_id": None, "table_id": None,
            "module_id": 21, "item_label": "FakultiAktif",
            "item_detail": "fakulti Custom Module", "item_order": 9,
            "show_record_count": 0, "table_name": None})
make('custom_module_basic', [fakulti], menu=menu)

# ----------------------------------------------------- custom_module_override
fakulti2 = table('fakulti', [
    field('id', data_type='INT', primary_key=1, auto_increment=1, read_only=1),
    field('nama_fakulti', length=150, required=1),
    field('kod_fakulti', length=20, unique=1),
])
fakulti2['custom_modules'] = [{
    "module_id": 22, "project_id": 1, "table_id": fakulti2['table_id'],
    "module_name": "FakultiRingkas", "module_order": 0, "menu_icon": "fas fa-eye",
    "filter_rules": json.dumps({"condition": "AND", "rules": [{"column": "kod_fakulti", "operator": "!=", "value": "X"}]}),
    "included_relations": None,
    "settings_override": json.dumps({"table_view_title": "Fakulti (Ringkas)", "allow_pagination": 0}),
    "created_at": "2026-01-01 00:00:00", "updated_at": "2026-01-01 00:00:00",
    "fields": [{
        "module_field_id": 220, "module_id": 22,
        "field_id": fakulti2['fields']['nama_fakulti']['field_id'],
        "is_readonly": 1,
        "settings_override": json.dumps({"format_as": "default", "lookup_display_as": "dropdown"}),
        "display_order": 0,
    }],
}]
menu = flat_menu('users', 'fakulti')
menu.append({"type": "custom_view_item", "order": 9, "item_id": 7101,
            "project_id": 1, "menu_group_id": None, "table_id": None,
            "module_id": 22, "item_label": "FakultiRingkas",
            "item_detail": "fakulti Custom Module", "item_order": 9,
            "show_record_count": 1, "table_name": None})
make('custom_module_override', [fakulti2], menu=menu)

# ---------------------------------------------------------------- relations_all
projek = table('projek', [
    field('id', data_type='INT', primary_key=1, auto_increment=1, read_only=1),
    field('nama_projek', length=150, required=1),
])
tugas = table('tugas', [
    field('id', data_type='INT', primary_key=1, auto_increment=1, read_only=1),
    field('projek_id', data_type='INT'),
    field('tajuk', length=200, required=1),
])
nota = table('nota', [
    field('id', data_type='INT', primary_key=1, auto_increment=1, read_only=1),
    field('projek_id', data_type='INT'),
    field('isi_nota', data_type='TEXT', display_type='text_area'),
])
kategori = table('kategori', [
    field('id', data_type='INT', primary_key=1, auto_increment=1, read_only=1),
    field('nama_kategori', length=100, required=1),
    field('parent_kategori_id', data_type='INT'),
])
make('relations_all', [projek, tugas, nota, kategori],
     rels=[
        rel('projek', 'tugas', 'projek_id', 'one-to-many', on_delete='CASCADE', on_update='CASCADE'),
        rel('projek', 'nota', 'projek_id', 'one-to-one', on_delete='SET NULL', on_update='RESTRICT'),
        rel('kategori', 'kategori', 'parent_kategori_id', 'one-to-many', on_delete='NO ACTION', on_update='NO ACTION'),
     ])

# ------------------------------------------------------------- field_types_all
ft = table('semua_field', [
    field('id', data_type='INT', primary_key=1, auto_increment=1, read_only=1),
    field('teks_biasa', length=120, required=1),
    field('emel', display_type='text_input', format_as='email', length=150),
    field('katalaluan', display_type='text_input', format_as='password', length=100),
    field('telefon', display_type='text_input', format_as='tel', length=30),
    field('pautan', display_type='text_input', format_as='url', length=255),
    field('berkas_topeng', display_type='text_input', format_as='custom', format_mask='AAA-9999', length=20),
    field('umur', data_type='INT', min_value=0, max_value=150),
    field('gaji', data_type='DECIMAL', length=12, precision=2, min_value=0),
    field('kod_zero', data_type='INT', length=6, zero_fill=1),
    field('unik_kod', length=40, unique=1),
    field('cerita', data_type='TEXT', display_type='text_area', column_span_full=1, placeholder='Cersa di sini'),
    field('rich_teks', data_type='TEXT', display_type='rich_html', column_span_full=1),
    field('aktif', data_type='BOOLEAN', display_type='check_box'),
    field('status', display_type='options_list', options_display='dropdown',
          options_list_values='aktif;;tidak aktif;;senarai hitam'),
    field('tag_multi', display_type='options_list', options_display='multi',
          options_list_values='penting;;segera;;biasa'),
    field('tarikh_masa', data_type='DATETIME', display_type='datetime_input'),
    field('emel_berulang', data_type='JSON', display_type='repeater_simple',
          repeater_simple_display_as='text_input', repeater_simple_format_as='email'),
    field('butiran', data_type='JSON', display_type='repeater',
          repeater_1_display_as='text_input', repeater_1_format_as=None, repeater_1_required=1,
          repeater_2_display_as='dropdown_list', repeater_2_list_values='a;;b;;c',
          repeater_3_display_as='text_input', repeater_3_format_as='url'),
    field('helper_cara', length=80, helper_text='Isi mengikut panduan'),
    field('auto_off', length=50, off_autocomplete=1),
])
make('field_types_all', [ft])

# -------------------------------------------------------- import_export_print
inventori = table('inventori', [
    field('id', data_type='INT', primary_key=1, auto_increment=1, read_only=1),
    field('item_name', length=150, required=1),
    field('kuantiti', data_type='INT'),
    field('harga_seunit', data_type='DECIMAL', length=10, precision=2),
], allow_csv_export=1, allow_csv_import=1, allow_print_view=1,
   allow_mass_delete=1, allow_restore_delete=1, allow_force_delete=1,
   dv_allow_print_view=1)
make('import_export_print', [inventori])

# ------------------------------------------------------------------ auditing_on
log_penting = table('log_penting', [
    field('id', data_type='INT', primary_key=1, auto_increment=1, read_only=1),
    field('perihal', length=200, required=1),
])
make('auditing_on', [log_penting], module_log_audit=1)

# ------------------------------------------------------------------ soft_delete
dokumen = table('dokumen', [
    field('id', data_type='INT', primary_key=1, auto_increment=1, read_only=1),
    field('tajuk_dokumen', length=200, required=1),
    field('created_by', data_type='INT'),
    field('updated_by', data_type='INT'),
    field('deleted_by', data_type='INT'),
])
make('soft_delete', [dokumen], data_delete_type='soft')

# ----------------------------------------------------------------- calc_queries
janaan = table('jana_bil', [
    field('id', data_type='INT', primary_key=1, auto_increment=1, read_only=1),
    field('bil_1', data_type='INT'),
    field('bil_2', data_type='INT'),
    field('jumlah', data_type='INT', calculated_enable=1,
         calculated_query='SELECT {bil_1} + {bil_2}',
         algorithm_enable=1, algorithm_logic='sum'),
])
make('calc_queries', [janaan])

# ----------------------------------------------------------------- menus_complex
g1 = table('laporan_harian', [
    field('id', data_type='INT', primary_key=1, auto_increment=1, read_only=1),
    field('tarikh_laporan', data_type='DATETIME', display_type='datetime_input'),
])
g2 = table('laporan_bulanan', [
    field('id', data_type='INT', primary_key=1, auto_increment=1, read_only=1),
    field('bulan', length=20, required=1),
])
g3 = table('carta_jualan', [
    field('id', data_type='INT', primary_key=1, auto_increment=1, read_only=1),
    field('kategori', length=50, required=1),
])
menu = [
    menu_item('laporan_harian', order=0, group=1, count=1),
    menu_item('laporan_bulanan', order=1, group=1),
    {"type": "group", "id": 1, "order": 2, "name": "Laporan", "items": [
        menu_item('laporan_harian', order=0, group=1, count=1),
        menu_item('laporan_bulanan', order=1, group=1),
    ]},
    {"type": "group", "id": 2, "order": 3, "name": "Analitik", "items": [
        menu_item('carta_jualan', order=0, group=2, count=1),
    ]},
    {"type": "custom_item", "order": 4, "item_id": 7200, "project_id": 1,
     "menu_group_id": None, "table_id": None, "module_id": None,
     "item_label": "Bantuan", "item_detail": "help.php", "item_order": 4,
     "show_record_count": 0, "table_name": None},
]
make('menus_complex', [g1, g2, g3], menu=menu)

# --------------------------------------- combo_tenancy_custommodule_audit
syarikat = table('syarikat', [
    field('id', data_type='INT', primary_key=1, auto_increment=1, read_only=1),
    field('nama_syarikat', length=150, required=1),
])
kontrak = table('kontrak', [
    field('id', data_type='INT', primary_key=1, auto_increment=1, read_only=1),
    field('syarikat_id', data_type='INT'),
    field('no_rujukan', length=50, unique=1, required=1),
    field('nilai', data_type='DECIMAL', length=12, precision=2),
    field('created_by', data_type='INT'),
    field('updated_by', data_type='INT'),
    field('deleted_by', data_type='INT'),
])
kontrak['custom_modules'] = [{
    "module_id": 23, "project_id": 1, "table_id": kontrak['table_id'],
    "module_name": "KontrakNilaiTinggi", "module_order": 0, "menu_icon": "fas fa-star",
    "filter_rules": json.dumps({"condition": "AND", "rules": [{"column": "nilai", "operator": ">", "value": "10000"}]}),
    "included_relations": None,
    "settings_override": json.dumps({"table_view_title": "Kontrak Besar"}),
    "created_at": "2026-01-01 00:00:00", "updated_at": "2026-01-01 00:00:00",
    "fields": [],
}]
menu = flat_menu('users', 'syarikat', 'kontrak')
menu.append({"type": "custom_view_item", "order": 9, "item_id": 7102,
            "project_id": 1, "menu_group_id": None, "table_id": None,
            "module_id": 23, "item_label": "KontrakNilaiTinggi",
            "item_detail": "kontrak Custom Module", "item_order": 9,
            "show_record_count": 1, "table_name": None})
make('combo_tenancy_custommodule_audit', [syarikat, kontrak],
     rels=[rel('syarikat', 'kontrak', 'syarikat_id')],
     tenancy_type='one_to_many', tenant_table='syarikat',
     module_log_audit=1, data_delete_type='soft', menu=menu)

# ------------------------------------------ combo_owner_relations_export
pelanggan = table('pelanggan', [
    field('id', data_type='INT', primary_key=1, auto_increment=1, read_only=1),
    field('nama_pelanggan', length=150, required=1),
    field('emel', format_as='email', length=150, unique=1),
])
tempahan = table('tempahan', [
    field('id', data_type='INT', primary_key=1, auto_increment=1, read_only=1),
    field('pelanggan_id', data_type='INT'),
    field('no_tempahan', length=40, unique=1, required=1),
    field('created_by', data_type='INT'),
    field('updated_by', data_type='INT'),
], record_owner='current_user', allow_csv_export=1, allow_csv_import=1,
   allow_print_view=1, dv_allow_print_view=1, allow_mass_delete=1)
item_tempahan = table('item_tempahan', [
    field('id', data_type='INT', primary_key=1, auto_increment=1, read_only=1),
    field('tempahan_id', data_type='INT'),
    field('produk', length=100, required=1),
    field('kuantiti', data_type='INT'),
    field('harga', data_type='DECIMAL', length=10, precision=2),
], allow_csv_export=1)
make('combo_owner_relations_export', [pelanggan, tempahan, item_tempahan],
     rels=[
        rel('pelanggan', 'tempahan', 'pelanggan_id', 'one-to-many'),
        rel('tempahan', 'item_tempahan', 'tempahan_id', 'one-to-many', show_count_in_tv=1),
     ],
     data_delete_type='hard')

print("done: 14 fixtures")
