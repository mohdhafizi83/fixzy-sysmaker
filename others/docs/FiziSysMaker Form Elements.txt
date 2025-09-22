###############
General
###############
app-title
app-date-preview						
app-date-order
app-separator
app-char-encoding
app-language-select
app-timezone-select
app-use-24hr-format
app-enforce_mysql_encoding
app-theme-select
app-use_3d_effects
app-rtl
app-compact
app-menu_orientation
app-menu_at_homepage
app-tables-per-row
app-extra-wide
app-panel-height
app-hide_login
app-allow_sql_tool
app-allow_server_status
app-admins_group_access
app-allow_table_view_sql
app-copy_children_async
app-allow_pwa_install
app-url
app-hook-logic
####################
Table - child of General
####################
tbl-table-name
tbl-table-view-title
tbl-table-description
tbl-show-quick-search
tbl-records-per-page
tbl-default-sort-by
tbl-sort-descending
tbl-allow-sorting
tbl-allow-filters
tbl-allow-csv-export
tbl-allow-print-view
tbl-allow-user-save-filters
tbl-hide-homepage-link
tbl-allow-mass-delete
tbl-filter-before-view
tbl-hide-nav-menu-link
tbl-show-record-count
tbl-tv-template
tbl-hide-field-captions
tbl-use-first-field-as-title
tbl-table-view-classes-input
tbl-detail-view-classes-input
tbl-detail-view-title
tbl-record-owner
tbl-default-focus
tbl-redirect-after-insert
tbl-enable-detail-view
tbl-delete-with-children
tbl-dv-allow-print-view
tbl-dv-separate-page
tbl-dv-hide-save-as-copy
tbl-dv-sticky-buttons
tbl-dv-allow-add-from-homepage
parentchild-show-tab
parentchild-show-icon
parentchild-autoclose-modal
parentchild-tab-title
parentchild-copy-records
parentchild-show-link-above
parentchild-show-count-in-tv
parentchild-allow-add-from-tv
tbl-hook-logic
#################
Field - child of Table
####################
fld-field-name
fld-caption
fld-description
fld-data-type
fld-length
fld-precision
fld-max-chars-in-tv
fld-alignment
fld-default-value
fld-read-only
fld-primary-key
fld-zero-fill
fld-required
fld-rich-html
fld-auto-increment
fld-unique
fld-show-sum
fld-text-area
fld-unsigned
fld-no-filter
fld-binary
fld-check-box
fld-hide-in-tv
fld-hide-in-dv
fld-enable-column-width
fld-column-width
fld-media-type
fld-media-link-behavior
fld-media-link-display-as
fld-media-link-other-field
fld-allow-image-uploads
fld-max-file-size
fld-delete-image-server
fld-dont-rename-image
fld-tv-thumb-width
fld-tv-thumb-height
fld-tv-enable-zooming
fld-tv-show-full-size
fld-dv-thumb-width
fld-dv-thumb-height
fld-dv-enable-zooming
fld-dv-show-full-size
fld-allow-file-uploads
fld-file-types
fld-file-max-size
fld-file-size-info
fld-delete-file-server
fld-dont-rename-file
fld-file-behavior
fld-file-display-as
fld-file-other-field
fld-display-gmap
fld-gmap-type
fld-gmap-tv-width
fld-gmap-tv-height
fld-gmap-dv-height
fld-accept-video-url
fld-youtube-tv-width
fld-youtube-tv-height
fld-youtube-dv-width
fld-youtube-dv-height
fld-lookup-parent-table
fld-lookup-caption-1
fld-lookup-separator
fld-lookup-caption-2
fld-lookup-display-as
fld-lookup-inherit-permissions
fld-lookup-link-behavior
fld-options-list-values
fld-options-display
fld-format-as
fld-calculated-enable
fld-calculated-query
fld-lookup-custom-query-hidden
fld-algorithm-enable
fld-algorithm-logic
fld-calculation-builder-state
fld-hook-functions
##################
fizisysmaker
##################
fizisys-check-updates
fizisys-autosave-interval
fizisys-show-begin-box
fizisys-icon-size
fizisys-doc-root
fizisys-base-url
fizisys-field-default-type
fizisys-field-default-length
fizisys-table-suggest-icon
fizisys-table-allow-csv
fizisys-table-dv-separate-page
fizisys-table-hide-save-as-copy
fizisys-table-allow-add-from-homepage
fizisys-table-show-record-count
fizisys-project-encoding
fizisys-project-rtl
fizisys-project-doxygen
fizisys-project-hide-footer
fizisys-max-entries
fizisys-project-no-trim
##################
Parent Child - Tables relationship
##################
parentchild-parent
parentchild-child
parentchild-show-tab
parentchild-show-icon
parentchild-autoclose-modal
parentchild-tab-title
parentchild-copy-records
parentchild-show-link-above
parentchild-show-count-in-tv
parentchild-allow-add-from-tv
###################
Menu group - group of Table
###################
menu_group_name
menu_table

-----------------------------------------
Maklumat tambahan yang penting
-----------------------------------------
kitaran kerja aplikasi adalah betul:

Ubah data ➡️ Simpan ➡️ Data dikemas kini di SQLite ➡️ Aplikasi muat semula SEMUA data dari SQLite ke jsonData ➡️ UI dipaparkan semula dengan data TERKINI

Auto-Save akan menjadi kaedah simpanan utama untuk halaman-halaman utama (Tetapan Projek, Jadual, dan Medan).

Butang "OK" akan digunakan untuk menyimpan data dari modal "FiziSysMaker Preferences".

## Fungsi Simpanan Auto-Save

Tetapan Projek (Halaman Utama)

	Fungsi Sedia Ada: initializeProjectSaveHandlers()

	Tanggungjawab: Menyimpan semua tetapan di papan pemuka utama, seperti tema, lokalisasi, dan pengurusan menu.

Tetapan Jadual

	Fungsi Sedia Ada: initializeTableSaveHandlers()

	Tanggungjawab: Menyimpan semua tetapan untuk jadual yang dipilih (contoh: tajuk, rekod per halaman, kebenaran).

Tetapan Medan

	Fungsi Sedia Ada: initializeFieldSaveHandlers()

	Tanggungjawab: Menyimpan semua tetapan untuk medan yang dipilih (contoh: kapsyen, jenis data, tetapan media, lookup).

Tetapan Hubungan (Parent/Child)

	Fungsi Sedia Ada: initializeRelationshipSaveHandlers()

	Tanggungjawab: Menyimpan tetapan untuk hubungan induk-anak di dalam tab "Parent/Child settings".

Tetapan Medan Carian (Lookup Field)

	Fungsi Sedia Ada: initializeLookupFieldSaveHandler()

	Tanggungjawab: Menyimpan hubungan (relationship) secara automatik apabila "Parent table" dipilih di dalam tab "Lookup field".

Pengurusan Susunan Menu

	Fungsi Sedia Ada: initializeMenuManagementHandlers()

	Tanggungjawab: Menyimpan struktur dan susunan kumpulan menu apabila pengguna melakukan aksi seret dan lepas (drag-and-drop) atau menambah/membuang item.
	
###################################################
## Rules Algorithm Builder (Konteks Workflow)
Ini adalah senarai komponen yang dibenarkan untuk diletakkan selepas komponen tertentu:

Selepas permulaan (start):

if

open_paren

Sebarang komponen "nilai" (value)

Selepas komponen if:

Sebarang komponen "nilai" (value)

open_paren

Selepas komponen "nilai" (value):

comparison_operator (cth: is equal to, contains)

arithmetic_operator (cth: +, -)

logical_operator (cth: AND, OR)

then

Selepas komponen comparison_operator, arithmetic_operator, atau logical_operator:

Sebarang komponen "nilai" (value)

open_paren

Selepas komponen open_paren (():

Sebarang komponen "nilai" (value)

if

open_paren
###########################################################

## 1. Algorithm Builder untuk "Algorithm Field" (Kekal Kompleks)
Contoh Kes Penggunaan: Mengira status pesanan.
IF [tarikh_hantar] IS NULL THEN 'Memproses' ELSE IF [tarikh_hantar] > [tarikh_jangka] THEN 'Lewat' ELSE 'Dihantar'

## 2. Builder Khas untuk Blok "Condition"
Contoh Kes Penggunaan: [harga] > 500

## 3. Builder Khas untuk Blok "Action" (Berorientasikan Tindakan)
Fungsi yang Jelas: Blok Action kini mempunyai tujuan yang sangat spesifik: melakukan sesuatu. Ini termasuk memanipulasi data atau berhubung dengan sistem luar.


Pengalaman Pengguna (UX) yang Terbimbing: Pengguna tidak lagi dibanjiri dengan pilihan yang tidak relevan. Apabila mereka berada di dalam blok Condition, mereka hanya melihat alat untuk membina syarat. Apabila di blok Action, mereka melihat alat untuk melakukan tindakan. Ini mengurangkan kesilapan dan kekeliruan.


############################################################

## Pemahaman Saya (Versi Baharu)
Berdasarkan penjelasan anda, berikut adalah pemahaman saya yang baharu mengenai bagaimana sistem auto-save sepatutnya berfungsi:

Matlamat Utama:
Untuk mewujudkan pengalaman pengguna (UX) yang lancar di mana proses auto-save berlaku di latar belakang tanpa mengganggu kerja pengguna. Ini bermakna tiada kelipan UI, kehilangan fokus pada input, atau rasa "tersangkut".

Peraturan Asas (Untuk 99% Perubahan Data):
Apabila pengguna mengubah data biasa (contoh: caption medan, deskripsi jadual, tetapan projek), sistem akan:

Menambah perubahan ke dalam SaveManager.

Menyimpan data ke pangkalan data secara senyap.

Memaparkan status "All changes saved ✔".

TIDAK memuat semula atau populate semula mana-mana bahagian UI (baik borang utama mahupun sidebar). Data terkini sudah pun ada di skrin pengguna.

Pengecualian Penting (Hanya Untuk Perubahan Nama):
Peraturan di atas mempunyai satu pengecualian yang sangat spesifik, iaitu apabila nama jadual atau nama medan diubah. Dalam kes ini sahaja, aliran yang berbeza diperlukan untuk memastikan sidebar sentiasa konsisten dengan nama terkini.

1. Senario: Nama Jadual Ditukar

Pengguna menukar nama jadual pada borang "Table Settings".

Auto-save dicetuskan.

Selepas simpanan berjaya, sistem PERLU:

Mengambil data terkini dari pangkalan data.

Memuat semula (populate) hanya bahagian sidebar sahaja untuk memaparkan nama jadual yang baharu.

Memastikan jadual yang baru dinamakan itu kekal aktif di sidebar (menggunakan setActiveSidebarLink).

PENTING: Borang "Table Settings" di sebelah kanan TIDAK BOLEH dimuat semula untuk mengelakkan gangguan.

2. Senario: Nama Medan Ditukar

Pengguna menukar nama medan pada borang "Field Settings".

Auto-save dicetuskan.

Selepas simpanan berjaya, sistem PERLU:

Mengambil data terkini dari pangkalan data.

Memuat semula (populate) hanya bahagian sidebar sahaja untuk memaparkan nama medan yang baharu di bawah jadualnya.

Memastikan medan yang baru dinamakan itu kekal aktif di sidebar (menggunakan focusOnSidebarField).

PENTING: Borang "Field Settings" di sebelah kanan TIDAK BOLEH dimuat semula.

3. Senario: Perubahan data di Tab Parent/Child settings

Pengguna melakukan perubahan data untuk Parent/Child settings.

Auto-save dicetuskan.

Selepas simpanan berjaya, sistem PERLU:

Mengambil data terkini dari pangkalan data.

Memuat semula (populate) hanya bahagian Parent/Child settings sahaja.

Memastikan pilihan jadual kekal aktif di sidebar (menggunakan focusOnSidebarField).

PENTING: Tiada muat naik semula kecuali di bahagian Parent/Child settings sahaja,

Secara ringkasnya: proses populate semula UI selepas auto-save hanya berlaku dalam 2 senario iaitu pertama untuk sidebar, dan hanya dicetuskan oleh perubahan nama jadual atau medan. Kedua apabila berlaku perubahan Parent/Child settings. Semua perubahan data lain tidak akan mencetuskan sebarang populate semula.


#############################################
## Analisis Aliran Data
Aliran data dalam aplikasi ini kini lebih jelas dan terbahagi kepada dua senario yang berbeza:

1. Senario: Auto-Save (Ketika Bekerja pada Item Aktif)
Tindakan: Anda mengubah data pada borang (cth: menukar caption medan).

Proses: SaveManager menyimpan perubahan di latar belakang.

Hasil: Tiada apa-apa berlaku pada UI selain status "Saved" muncul. Borang tidak dimuat semula. Ini adalah "ciri" yang kita bincangkan tadi untuk mengelakkan gangguan. jsonData di frontend pada ketika ini secara teknikalnya sudah lapuk (stale), tetapi ia tidak mengapa kerana anda masih melihat perubahan yang baru anda taip.

2. Senario: Navigasi (Memilih Item Baharu di Sidebar)
Tindakan: Anda selesai mengedit Medan A dan sekarang anda mengklik pada Jadual B atau Medan C di sidebar.

Proses:

Event listener click di dalam initializeSidebarInteractivity (sidebar.js) akan dicetuskan.

Listener ini tidak lagi memanggil fungsi populate secara terus. Sebaliknya, ia kini memanggil fungsi induk loadProjectData.

loadProjectData akan sentiasa mengambil data paling terkini dari pangkalan data (getFullSchema).

Selepas data terkini diperoleh, loadProjectData akan memanggil fungsi populate yang betul (populateTableSettings atau populateFieldSettings) untuk halaman baharu yang anda pilih.

Hasil: Halaman yang baru anda pilih itu dijamin akan memaparkan data yang paling terkini dari pangkalan data, termasuk sebarang perubahan yang telah disimpan oleh auto-save dari halaman sebelumnya.

