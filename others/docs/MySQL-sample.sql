-- Mengelakkan jenis data ENUM dan memastikan saiz kunci adalah munasabah.

-- ---------------------------------
-- JADUAL UTAMA: pelajar
-- Menyimpan maklumat asas pelajar.
-- ---------------------------------
CREATE TABLE `pelajar` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `nama_penuh` VARCHAR(150) NOT NULL,
  `no_matrik` VARCHAR(20) NOT NULL,
  `email` VARCHAR(100) NOT NULL,
  `tarikh_daftar` DATE DEFAULT NULL,
  `gambar_profil` VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `no_matrik` (`no_matrik`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------
-- JADUAL ONE-TO-ONE: profil_pelajar
-- Menyimpan maklumat tambahan yang unik untuk setiap pelajar.
-- ---------------------------------
CREATE TABLE `profil_pelajar` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `pelajar_id` INT(11) NOT NULL,
  `alamat` TEXT,
  `no_telefon` VARCHAR(20) DEFAULT NULL,
  `tarikh_lahir` DATE DEFAULT NULL,
  `info_kecemasan` VARCHAR(200) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pelajar_id_unique` (`pelajar_id`),
  CONSTRAINT `fk_profil_pelajar` FOREIGN KEY (`pelajar_id`) REFERENCES `pelajar` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------
-- JADUAL ONE-TO-MANY: dokumen_pelajar
-- Setiap pelajar boleh memuat naik banyak fail.
-- ---------------------------------
CREATE TABLE `dokumen_pelajar` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `pelajar_id` INT(11) NOT NULL,
  `nama_fail` VARCHAR(200) NOT NULL,
  `path_fail` VARCHAR(255) NOT NULL,
  `jenis_dokumen` VARCHAR(50) DEFAULT 'Am',
  `tarikh_muatnaik` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_dokumen_pelajar` FOREIGN KEY (`pelajar_id`) REFERENCES `pelajar` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------
-- JADUAL SOKONGAN UNTUK MANY-TO-MANY: kursus
-- Menyimpan senarai kursus yang ditawarkan.
-- ---------------------------------
CREATE TABLE `kursus` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `nama_kursus` VARCHAR(150) NOT NULL,
  `kod_kursus` VARCHAR(10) NOT NULL,
  `deskripsi` TEXT,
  `jam_kredit` INT(2) DEFAULT 3,
  `prasyarat_kursus_id` INT(11) DEFAULT NULL, -- <-- LAJUR BARU
  PRIMARY KEY (`id`),
  UNIQUE KEY `kod_kursus` (`kod_kursus`),
  CONSTRAINT `fk_kursus_prasyarat` FOREIGN KEY (`prasyarat_kursus_id`) REFERENCES `kursus` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------
-- JADUAL PENGHUBUNG (JUNCTION TABLE) UNTUK MANY-TO-MANY: pendaftaran_kursus
-- Menghubungkan pelajar dan kursus.
-- ---------------------------------
CREATE TABLE `pendaftaran_kursus` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `pelajar_id` INT(11) NOT NULL,
  `kursus_id` INT(11) NOT NULL,
  `tarikh_pendaftaran` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `gred` VARCHAR(5) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pelajar_kursus_unique` (`pelajar_id`, `kursus_id`),
  CONSTRAINT `fk_pendaftaran_pelajar` FOREIGN KEY (`pelajar_id`) REFERENCES `pelajar` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_pendaftaran_kursus` FOREIGN KEY (`kursus_id`) REFERENCES `kursus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------
-- JADUAL LOG: pengesahan_pendaftaran
-- Menyimpan sejarah tindakan pengesahan oleh admin.
-- ---------------------------------
CREATE TABLE `pengesahan_pendaftaran` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `pendaftaran_id` INT(11) NOT NULL,
  `user_id` INT(11) NOT NULL, -- Merujuk kepada jadual 'pentadbir'
  `status` VARCHAR(15) NOT NULL, -- 'Approved' atau 'Disapproved'
  `catatan` TEXT DEFAULT NULL, -- Ruang untuk admin memberi sebab/komen
  `tarikh_tindakan` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_pendaftaran` (`pendaftaran_id`),
  INDEX `idx_user` (`user_id`),
  CONSTRAINT `fk_pengesahan_pendaftaran` FOREIGN KEY (`pendaftaran_id`) REFERENCES `pendaftaran_kursus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
  -- CONSTRAINT `fk_pengesahan_admin` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
