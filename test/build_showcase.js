// Builds test/fixtures/showcase_demo.json — a rich, publish-ready demo project:
// 10 tables (university domain, English captions), 3 menu groups + custom items,
// 15 widgets covering ALL 12 widget types, realtime+audit+scheduler+fake data on.
// Reuses big_university structure with translated captions.
'use strict';
const fs = require('fs');
const path = require('path');

const big = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'big_university.json'), 'utf8'));

// ---- caption translation map (Malay -> English, publish-ready) ----
const CAP = {
  'Pelajar Kursus': 'Student Enrolment', 'Pelajar': 'Students', 'Id': 'ID', 'Id Fakulti': 'Faculty ID',
  'Nama Penuh': 'Full Name', 'No Matrik': 'Matric Number', 'Tarikh Daftar': 'Registration Date',
  'Gambar Profil': 'Profile Photo', 'Surat Tawaran': 'Offer Letter', 'Profil Pelajar': 'Student Profile',
  'ProfilPelajar': 'Student Profile', 'Pelajar Id': 'Student ID', 'Alamat': 'Address', 'No Telefon': 'Phone Number',
  'Tarikh Lahir': 'Date of Birth', 'Info Kecemasan': 'Emergency Info', 'Dokumen Pelajarx': 'Student Documents',
  'DokumenPelajar': 'Student Documents', 'Nama Fail': 'File Name', 'Path Fail': 'File Path', 'Jenis Dokumen': 'Document Type',
  'Tarikh Muatnaik': 'Upload Date', 'Kursus': 'Courses', 'Nama Kursus': 'Course Name', 'Kod Kursus': 'Course Code',
  'Deskripsi': 'Description', 'Jam Kredit': 'Credit Hours', 'Prasyarat Kursus Id': 'Prerequisite Course ID',
  'Lokasi Kelas': 'Class Location', 'Youtube Intro': 'Intro Video', 'Pendaftaran Kursus': 'Course Registration',
  'PendaftaranKursus': 'Course Registration', 'Kursus Id': 'Course ID', 'Tarikh Pendaftaran': 'Enrolment Date',
  'Gred': 'Grade', 'Dokumen Lengkap': 'Documents Complete', 'Pengesahan Pendaftaran': 'Registration Approval',
  'PengesahanPendaftaran': 'Registration Approval', 'Pendaftaran Id': 'Registration ID', 'User Id': 'User ID',
  'Status': 'Status', 'Catatan': 'Notes', 'Tarikh Tindakan': 'Action Date', 'Pelajar Fakulti Ekonomi': 'Faculties',
  'Fakulti': 'Faculties', 'Nama Fakulti': 'Faculty Name', 'table_khpmrn': 'Exam Results', 'KeputusanUjian': 'Exam Results',
  'Invoice': 'Invoices', 'Fakulti ID': 'Faculty ID', 'Jumlah Bayaran': 'Payment Amount',
  'Users': 'Users', 'Name': 'Name', 'Email': 'Email', 'Email Verified At': 'Email Verified At',
  'Password': 'Password', 'Remember Token': 'Remember Token', 'Created At': 'Created At', 'Updated At': 'Updated At', 'Deleted At': 'Deleted At',
  'Test': 'Exam', 'Created By': 'Created By', 'Updated By': 'Updated By', 'Deleted By': 'Deleted By',
  'pelajar_id': 'Student ID',
};
const tr = (s) => (s && CAP[s]) || s;

// ---- translate captions across all tables ----
for (const t of Object.values(big.database.table)) {
  t.table_view_title = tr(t.table_view_title);
  t.module_name = tr(t.module_name);
  // Showcase must show ALL seeded rows: drop per-user scoping (record_owner
  // 'current_user' hides rows whose owner != admin, leaving empty lists).
  t.record_owner = null;
  t.owner_fk_value = null;
  // Seeder writes fake image paths that don't exist -> broken thumbnails.
  // Hide image columns in Table List for a clean showcase.
  for (const f of Object.values(t.fields)) {
    if (f.media_type === 'image' || f.media_type === 'youtube') f.hide_in_tv = 1;
  }
  for (const f of Object.values(t.fields)) {
    f.caption = tr(f.caption);
  }
}

// ---- menu: 3 groups + custom items, referencing real tables ----
const menu = [
  {
    type: 'group', id: 1, order: 0, name: 'Academic',
    items: [
      { type: 'table_item', order: 0, item_id: 9001, item_label: 'Students', item_detail: 'Manage student records', show_record_count: 1, table_name: 'pelajar' },
      { type: 'table_item', order: 1, item_id: 9002, item_label: 'Student Profiles', item_detail: 'Extended student info', show_record_count: 1, table_name: 'profil_pelajar' },
      { type: 'table_item', order: 2, item_id: 9003, item_label: 'Courses', item_detail: 'Course catalogue', show_record_count: 1, table_name: 'kursus' },
      { type: 'table_item', order: 3, item_id: 9004, item_label: 'Exam Results', item_detail: 'Exam results per student', show_record_count: 1, table_name: 'keputusan_ujian' },
    ],
  },
  {
    type: 'group', id: 2, order: 1, name: 'Enrolment & Finance',
    items: [
      { type: 'table_item', order: 0, item_id: 9011, item_label: 'Registrations', item_detail: 'Course registrations', show_record_count: 1, table_name: 'pendaftaran_kursus' },
      { type: 'table_item', order: 1, item_id: 9012, item_label: 'Approvals', item_detail: 'Registration approvals', show_record_count: 1, table_name: 'pengesahan_pendaftaran' },
      { type: 'table_item', order: 2, item_id: 9013, item_label: 'Invoices', item_detail: 'Student billing', show_record_count: 1, table_name: 'invoice' },
    ],
  },
  {
    type: 'group', id: 3, order: 2, name: 'Administration',
    items: [
      { type: 'table_item', order: 0, item_id: 9021, item_label: 'Faculties', item_detail: 'Faculty directory', show_record_count: 1, table_name: 'fakulti' },
      { type: 'table_item', order: 1, item_id: 9022, item_label: 'Documents', item_detail: 'Student document vault', show_record_count: 1, table_name: 'dokumen_pelajar' },
      { type: 'table_item', order: 2, item_id: 9023, item_label: 'Users', item_detail: 'System users', show_record_count: 1, table_name: 'users' },
    ],
  },
  { type: 'custom_item', order: 3, item_id: 9201, item_label: 'Reports Portal', item_detail: '/reports', show_record_count: 0 },
  { type: 'custom_item', order: 4, item_id: 9202, item_label: 'Help Center', item_detail: '/help', show_record_count: 0 },
];

// ---- widgets: 15 covering all 12 types, mapped to real tables/fields ----
const W = (id, title, type, table, extra = {}) => ({
  id, title, widget_type: type, target_table: table, target_field: null, aggregate_type: 'count',
  width_span: '3', color: 'primary', icon: 'heroicon-o-chart-bar', timeframe_range: 'all',
  refresh_mode: 'poll', refresh_interval: 15, ...extra,
});
const widgets = [
  W('w1', 'Total Students', 'stats', 'pelajar', { icon: 'heroicon-o-users', width_span: '3', color: 'primary' }),
  W('w2', 'Total Courses', 'stats', 'kursus', { icon: 'heroicon-o-book-open', width_span: '3', color: 'success' }),
  W('w3', 'Total Invoices', 'stats', 'invoice', { icon: 'heroicon-o-receipt-percent', width_span: '3', color: 'warning' }),
  W('w4', 'Revenue Collected', 'stats', 'invoice', { target_field: 'jumlah_bayaran', aggregate_type: 'sum', icon: 'heroicon-o-banknotes', width_span: '3', color: 'danger' }),
  W('w5', 'Enrolments by Grade', 'chart_bar', 'pendaftaran_kursus', { chart_label_column: 'gred', width_span: '6', color: 'primary' }),
  W('w6', 'Approval Status', 'chart_pie', 'pengesahan_pendaftaran', { chart_label_column: 'status', width_span: '6', color: 'success' }),
  W('w7', 'Invoices by Faculty', 'chart_doughnut', 'invoice', { chart_label_column: 'fakulti_id', width_span: '4', color: 'warning' }),
  W('w8', 'Registrations Over Time', 'chart_line', 'pelajar', { chart_label_column: 'tarikh_daftar', width_span: '8', color: 'primary' }),
  W('w9', 'Credit Hours by Course', 'chart_area', 'kursus', { chart_label_column: 'nama_kursus', target_field: 'jam_kredit', aggregate_type: 'sum', width_span: '6', color: 'info' }),
  W('w10', 'Payment vs Faculty', 'chart_combo', 'invoice', { chart_label_column: 'fakulti_id', target_field: 'jumlah_bayaran', aggregate_type: 'sum', chart_series_field: 'created_by', series_aggregate_type: 'count', width_span: '6', color: 'primary' }),
  W('w11', 'Course Credit Profile', 'chart_radar', 'kursus', { chart_label_column: 'nama_kursus', target_field: 'jam_kredit', aggregate_type: 'sum', width_span: '4', color: 'danger' }),
  W('w12', 'Payment Distribution', 'chart_scatter', 'invoice', { target_field: 'jumlah_bayaran', chart_series_field: 'fakulti_id', width_span: '4', color: 'info' }),
  W('w13', 'Payment Volume Bubble', 'chart_bubble', 'invoice', { target_field: 'jumlah_bayaran', chart_series_field: 'fakulti_id', chart_size_field: 'created_by', width_span: '4', color: 'warning' }),
  W('w14', 'Latest Students', 'table_latest', 'pelajar', { width_span: '6', color: 'primary' }),
  W('w15', 'Recent Invoices', 'table_latest', 'invoice', { width_span: '6', color: 'success' }),
  W('w16', 'Faculty Value (Polar)', 'chart_polar', 'invoice', { chart_label_column: 'fakulti_id', target_field: 'jumlah_bayaran', aggregate_type: 'sum', width_span: '4', color: 'danger' }),
];

// ---- project: rich feature flags ----
const project = { ...big.project };
project.project_id = 1;
project.app_title = 'Campus Management System';
project.theme_select = 'fixzySys';
project.stack_database = 'sqlite';
project.module_auth_email = 1;
project.module_authorization = 1;
project.module_log_audit = 1;
project.module_log_activity = 1;
project.module_realtime = 1;
project.realtime_backend = 'reverb';
project.module_scheduler = 1;
project.module_fake_data = 1;
project.debug_mode = 0;
project.kiosk_enabled = 1;
project.kiosk_rotate_seconds = 10;
project.kiosk_page_size = 8;

const out = {
  project,
  database: {
    name: 'campus_demo',
    table: big.database.table,
    relationships: big.database.relationships || [],
    unified_menu: menu,
    widgets,
  },
};

const outPath = path.join(__dirname, 'fixtures', 'showcase_demo.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log('wrote', outPath);
console.log('tables:', Object.keys(out.database.table).length,
  '| menu groups:', menu.filter(m => m.type === 'group').length,
  '| menu items:', menu.filter(m => m.type === 'group').reduce((n, g) => n + g.items.length, 0),
  '| custom:', menu.filter(m => m.type === 'custom_item').length,
  '| widgets:', widgets.length,
  '| widget types:', [...new Set(widgets.map(w => w.widget_type))].length);
