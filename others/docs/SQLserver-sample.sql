-- ---------------------------------
-- JADUAL UTAMA: pelajar
-- Menyimpan maklumat asas pelajar.
-- ---------------------------------
CREATE TABLE pelajar (
    id INT IDENTITY(1,1) NOT NULL,
    nama_penuh NVARCHAR(150) NOT NULL,
    no_matrik NVARCHAR(20) NOT NULL,
    email NVARCHAR(100) NOT NULL,
    tarikh_daftar DATE DEFAULT NULL,
    gambar_profil NVARCHAR(255) DEFAULT NULL,
    CONSTRAINT PK_pelajar PRIMARY KEY (id),
    CONSTRAINT UQ_pelajar_no_matrik UNIQUE (no_matrik),
    CONSTRAINT UQ_pelajar_email UNIQUE (email)
);

-- ---------------------------------
-- JADUAL ONE-TO-ONE: profil_pelajar
-- Menyimpan maklumat tambahan yang unik untuk setiap pelajar.
-- ---------------------------------
CREATE TABLE profil_pelajar (
    id INT IDENTITY(1,1) NOT NULL,
    pelajar_id INT NOT NULL,
    alamat NVARCHAR(MAX),
    no_telefon NVARCHAR(20) DEFAULT NULL,
    tarikh_lahir DATE DEFAULT NULL,
    info_kecemasan NVARCHAR(200) DEFAULT NULL,
    CONSTRAINT PK_profil_pelajar PRIMARY KEY (id),
    CONSTRAINT UQ_profil_pelajar_pelajar_id UNIQUE (pelajar_id),
    CONSTRAINT FK_profil_pelajar FOREIGN KEY (pelajar_id) REFERENCES pelajar(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- ---------------------------------
-- JADUAL ONE-TO-MANY: dokumen_pelajar
-- Setiap pelajar boleh memuat naik banyak fail.
-- ---------------------------------
CREATE TABLE dokumen_pelajar (
    id INT IDENTITY(1,1) NOT NULL,
    pelajar_id INT NOT NULL,
    nama_fail NVARCHAR(200) NOT NULL,
    path_fail NVARCHAR(255) NOT NULL,
    jenis_dokumen NVARCHAR(50) DEFAULT 'Am',
    tarikh_muatnaik DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT PK_dokumen_pelajar PRIMARY KEY (id),
    CONSTRAINT FK_dokumen_pelajar FOREIGN KEY (pelajar_id) REFERENCES pelajar(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- ---------------------------------
-- JADUAL SOKONGAN UNTUK MANY-TO-MANY: kursus
-- Menyimpan senarai kursus yang ditawarkan.
-- ---------------------------------
CREATE TABLE kursus (
    id INT IDENTITY(1,1) NOT NULL,
    nama_kursus NVARCHAR(150) NOT NULL,
    kod_kursus NVARCHAR(10) NOT NULL,
    deskripsi NVARCHAR(MAX),
    jam_kredit INT DEFAULT 3,
    prasyarat_kursus_id INT DEFAULT NULL,
    CONSTRAINT PK_kursus PRIMARY KEY (id),
    CONSTRAINT UQ_kursus_kod_kursus UNIQUE (kod_kursus),
    CONSTRAINT FK_kursus_prasyarat FOREIGN KEY (prasyarat_kursus_id) REFERENCES kursus(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- ---------------------------------
-- JADUAL PENGHUBUNG (JUNCTION TABLE) UNTUK MANY-TO-MANY: pendaftaran_kursus
-- Menghubungkan pelajar dan kursus.
-- ---------------------------------
CREATE TABLE pendaftaran_kursus (
    id INT IDENTITY(1,1) NOT NULL,
    pelajar_id INT NOT NULL,
    kursus_id INT NOT NULL,
    tarikh_pendaftaran DATETIME2 DEFAULT GETDATE(),
    gred NVARCHAR(5) DEFAULT NULL,
    CONSTRAINT PK_pendaftaran_kursus PRIMARY KEY (id),
    CONSTRAINT UQ_pendaftaran_kursus_pelajar_kursus UNIQUE (pelajar_id, kursus_id),
    CONSTRAINT FK_pendaftaran_pelajar FOREIGN KEY (pelajar_id) REFERENCES pelajar(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT FK_pendaftaran_kursus FOREIGN KEY (kursus_id) REFERENCES kursus(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- ---------------------------------
-- JADUAL LOG: pengesahan_pendaftaran
-- Menyimpan sejarah tindakan pengesahan oleh admin.
-- ---------------------------------
CREATE TABLE pengesahan_pendaftaran (
    id INT IDENTITY(1,1) NOT NULL,
    pendaftaran_id INT NOT NULL,
    user_id INT NOT NULL, -- Merujuk kepada jadual 'pentadbir'
    status NVARCHAR(15) NOT NULL, -- 'Approved' atau 'Disapproved'
    catatan NVARCHAR(MAX) DEFAULT NULL, -- Ruang untuk admin memberi sebab/komen
    tarikh_tindakan DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_pengesahan_pendaftaran PRIMARY KEY (id),
    CONSTRAINT FK_pengesahan_pendaftaran FOREIGN KEY (pendaftaran_id) REFERENCES pendaftaran_kursus(id) ON DELETE CASCADE ON UPDATE CASCADE
    -- CONSTRAINT FK_pengesahan_admin FOREIGN KEY (user_id) REFERENCES [user](id) ON DELETE NO ACTION ON UPDATE CASCADE
);
GO

-- Mencipta indeks (non-clustered) secara berasingan untuk prestasi carian yang lebih baik
CREATE INDEX idx_pendaftaran ON pengesahan_pendaftaran(pendaftaran_id);
CREATE INDEX idx_user ON pengesahan_pendaftaran(user_id);
GO