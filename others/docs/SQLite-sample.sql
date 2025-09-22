-- Memastikan sokongan foreign key diaktifkan (perlu dijalankan setiap kali sambungan ke pangkalan data dibuka)
PRAGMA foreign_keys = ON;

-- ---------------------------------
-- JADUAL UTAMA: pelajar
-- Menyimpan maklumat asas pelajar.
-- ---------------------------------
CREATE TABLE pelajar (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    nama_penuh TEXT NOT NULL,
    no_matrik TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    tarikh_daftar TEXT DEFAULT NULL,
    gambar_profil TEXT DEFAULT NULL
);

-- ---------------------------------
-- JADUAL ONE-TO-ONE: profil_pelajar
-- Menyimpan maklumat tambahan yang unik untuk setiap pelajar.
-- ---------------------------------
CREATE TABLE profil_pelajar (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    pelajar_id INTEGER NOT NULL UNIQUE,
    alamat TEXT,
    no_telefon TEXT DEFAULT NULL,
    tarikh_lahir TEXT DEFAULT NULL,
    info_kecemasan TEXT DEFAULT NULL,
    FOREIGN KEY (pelajar_id) REFERENCES pelajar(id) ON DELETE CASCADE
);

-- ---------------------------------
-- JADUAL ONE-TO-MANY: dokumen_pelajar
-- Setiap pelajar boleh memuat naik banyak fail.
-- ---------------------------------
CREATE TABLE dokumen_pelajar (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    pelajar_id INTEGER NOT NULL,
    nama_fail TEXT NOT NULL,
    path_fail TEXT NOT NULL,
    jenis_dokumen TEXT DEFAULT 'Am',
    tarikh_muatnaik TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pelajar_id) REFERENCES pelajar(id) ON DELETE CASCADE
);

-- ---------------------------------
-- JADUAL SOKONGAN UNTUK MANY-TO-MANY: kursus
-- Menyimpan senarai kursus yang ditawarkan.
-- ---------------------------------
CREATE TABLE kursus (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    nama_kursus TEXT NOT NULL,
    kod_kursus TEXT NOT NULL UNIQUE,
    deskripsi TEXT,
    jam_kredit INTEGER DEFAULT 3,
    prasyarat_kursus_id INTEGER DEFAULT NULL,
    FOREIGN KEY (prasyarat_kursus_id) REFERENCES kursus(id) ON DELETE SET NULL
);

-- ---------------------------------
-- JADUAL PENGHUBUNG (JUNCTION TABLE) UNTUK MANY-TO-MANY: pendaftaran_kursus
-- Menghubungkan pelajar dan kursus.
-- ---------------------------------
CREATE TABLE pendaftaran_kursus (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    pelajar_id INTEGER NOT NULL,
    kursus_id INTEGER NOT NULL,
    tarikh_pendaftaran TEXT DEFAULT CURRENT_TIMESTAMP,
    gred TEXT DEFAULT NULL,
    UNIQUE (pelajar_id, kursus_id),
    FOREIGN KEY (pelajar_id) REFERENCES pelajar(id) ON DELETE CASCADE,
    FOREIGN KEY (kursus_id) REFERENCES kursus(id) ON DELETE CASCADE
);

-- ---------------------------------
-- JADUAL LOG: pengesahan_pendaftaran
-- Menyimpan sejarah tindakan pengesahan oleh admin.
-- ---------------------------------
CREATE TABLE pengesahan_pendaftaran (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    pendaftaran_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL, -- Merujuk kepada jadual 'pentadbir'
    status TEXT NOT NULL, -- 'Approved' atau 'Disapproved'
    catatan TEXT DEFAULT NULL, -- Ruang untuk admin memberi sebab/komen
    tarikh_tindakan TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pendaftaran_id) REFERENCES pendaftaran_kursus(id) ON DELETE CASCADE
    -- FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE NO ACTION
);

-- Mencipta indeks secara berasingan untuk prestasi carian yang lebih baik
CREATE INDEX idx_pendaftaran ON pengesahan_pendaftaran(pendaftaran_id);
CREATE INDEX idx_user ON pengesahan_pendaftaran(user_id);