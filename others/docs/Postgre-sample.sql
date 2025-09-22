-- ---------------------------------
-- JADUAL UTAMA: pelajar
-- Menyimpan maklumat asas pelajar.
-- ---------------------------------
CREATE TABLE pelajar (
    id SERIAL PRIMARY KEY,
    nama_penuh VARCHAR(150) NOT NULL,
    no_matrik VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    tarikh_daftar DATE DEFAULT NULL,
    gambar_profil VARCHAR(255) DEFAULT NULL
);

-- ---------------------------------
-- JADUAL ONE-TO-ONE: profil_pelajar
-- Menyimpan maklumat tambahan yang unik untuk setiap pelajar.
-- ---------------------------------
CREATE TABLE profil_pelajar (
    id SERIAL PRIMARY KEY,
    pelajar_id INTEGER NOT NULL UNIQUE,
    alamat TEXT,
    no_telefon VARCHAR(20) DEFAULT NULL,
    tarikh_lahir DATE DEFAULT NULL,
    info_kecemasan VARCHAR(200) DEFAULT NULL,
    CONSTRAINT fk_profil_pelajar FOREIGN KEY (pelajar_id) REFERENCES pelajar(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- ---------------------------------
-- JADUAL ONE-TO-MANY: dokumen_pelajar
-- Setiap pelajar boleh memuat naik banyak fail.
-- ---------------------------------
CREATE TABLE dokumen_pelajar (
    id SERIAL PRIMARY KEY,
    pelajar_id INTEGER NOT NULL,
    nama_fail VARCHAR(200) NOT NULL,
    path_fail VARCHAR(255) NOT NULL,
    jenis_dokumen VARCHAR(50) DEFAULT 'Am',
    tarikh_muatnaik TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dokumen_pelajar FOREIGN KEY (pelajar_id) REFERENCES pelajar(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- ---------------------------------
-- JADUAL SOKONGAN UNTUK MANY-TO-MANY: kursus
-- Menyimpan senarai kursus yang ditawarkan.
-- ---------------------------------
CREATE TABLE kursus (
    id SERIAL PRIMARY KEY,
    nama_kursus VARCHAR(150) NOT NULL,
    kod_kursus VARCHAR(10) NOT NULL UNIQUE,
    deskripsi TEXT,
    jam_kredit INTEGER DEFAULT 3,
    prasyarat_kursus_id INTEGER DEFAULT NULL,
    CONSTRAINT fk_kursus_prasyarat FOREIGN KEY (prasyarat_kursus_id) REFERENCES kursus(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- ---------------------------------
-- JADUAL PENGHUBUNG (JUNCTION TABLE) UNTUK MANY-TO-MANY: pendaftaran_kursus
-- Menghubungkan pelajar dan kursus.
-- ---------------------------------
CREATE TABLE pendaftaran_kursus (
    id SERIAL PRIMARY KEY,
    pelajar_id INTEGER NOT NULL,
    kursus_id INTEGER NOT NULL,
    tarikh_pendaftaran TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    gred VARCHAR(5) DEFAULT NULL,
    CONSTRAINT pelajar_kursus_unique UNIQUE (pelajar_id, kursus_id),
    CONSTRAINT fk_pendaftaran_pelajar FOREIGN KEY (pelajar_id) REFERENCES pelajar(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_pendaftaran_kursus FOREIGN KEY (kursus_id) REFERENCES kursus(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- ---------------------------------
-- JADUAL LOG: pengesahan_pendaftaran
-- Menyimpan sejarah tindakan pengesahan oleh admin.
-- ---------------------------------
CREATE TABLE pengesahan_pendaftaran (
    id SERIAL PRIMARY KEY,
    pendaftaran_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL, -- Merujuk kepada jadual 'pentadbir'
    status VARCHAR(15) NOT NULL, -- 'Approved' atau 'Disapproved'
    catatan TEXT DEFAULT NULL, -- Ruang untuk admin memberi sebab/komen
    tarikh_tindakan TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pengesahan_pendaftaran FOREIGN KEY (pendaftaran_id) REFERENCES pendaftaran_kursus(id) ON DELETE CASCADE ON UPDATE CASCADE
    -- CONSTRAINT fk_pengesahan_admin FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE NO ACTION ON UPDATE CASCADE
);

-- Mencipta indeks secara berasingan untuk prestasi carian yang lebih baik
CREATE INDEX idx_pendaftaran ON pengesahan_pendaftaran(pendaftaran_id);
CREATE INDEX idx_user ON pengesahan_pendaftaran(user_id);