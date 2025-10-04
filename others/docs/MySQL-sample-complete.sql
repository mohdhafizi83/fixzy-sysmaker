-- 8 jenis hubungan utama : hasOne(), belongsTo(), hasMany(), belongsToMany(), hasOneThrough(), hasManyThrough(), morphOne(), morphMany(), morphToMany(), 
-- =================================================================
-- BAHAGIAN ASAS (DARI SAMPEL ASAL ANDA)
-- =================================================================

CREATE TABLE `pelajar` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `fakulti_id` INT(11) DEFAULT NULL, -- <-- LAJUR BARU untuk HasManyThrough
  `nama_penuh` VARCHAR(150) NOT NULL,
  `no_matrik` VARCHAR(20) NOT NULL,
  `email` VARCHAR(100) NOT NULL,
  `tarikh_daftar` DATE DEFAULT NULL,
  -- `gambar_profil` VARCHAR(255) DEFAULT NULL, -- Digantikan oleh MorphOne
  PRIMARY KEY (`id`),
  UNIQUE KEY `no_matrik` (`no_matrik`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `profil_pelajar` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `pelajar_id` INT(11) NOT NULL,
  `alamat` TEXT,
  `no_telefon` VARCHAR(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pelajar_id_unique` (`pelajar_id`),
  CONSTRAINT `fk_profil_pelajar` FOREIGN KEY (`pelajar_id`) REFERENCES `pelajar` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `dokumen_pelajar` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `pelajar_id` INT(11) NOT NULL,
  `nama_fail` VARCHAR(200) NOT NULL,
  `path_fail` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_dokumen_pelajar` FOREIGN KEY (`pelajar_id`) REFERENCES `pelajar` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `kursus` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `nama_kursus` VARCHAR(150) NOT NULL,
  `kod_kursus` VARCHAR(10) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `kod_kursus` (`kod_kursus`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `pendaftaran_kursus` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `pelajar_id` INT(11) NOT NULL,
  `kursus_id` INT(11) NOT NULL,
  `tarikh_pendaftaran` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pelajar_kursus_unique` (`pelajar_id`, `kursus_id`),
  CONSTRAINT `fk_pendaftaran_pelajar` FOREIGN KEY (`pelajar_id`) REFERENCES `pelajar` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pendaftaran_kursus` FOREIGN KEY (`kursus_id`) REFERENCES `kursus` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =================================================================
-- PENAMBAHAN & UBAH SUAI UNTUK HUBUNGAN BARU
-- =================================================================

-- ---------------------------------
-- JADUAL untuk HAS MANY THROUGH & HAS ONE THROUGH
-- ---------------------------------
CREATE TABLE `fakulti` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `nama_fakulti` VARCHAR(100) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Kemas kini jadual pelajar untuk menambah fakulti_id
-- ALTER TABLE `pelajar` ADD COLUMN `fakulti_id` INT(11) NULL AFTER `id`, ADD CONSTRAINT `fk_pelajar_fakulti` FOREIGN KEY (`fakulti_id`) REFERENCES `fakulti` (`id`) ON DELETE SET NULL;

CREATE TABLE `pengesahan_pendaftaran` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `pendaftaran_id` INT(11) NOT NULL,
  `status` VARCHAR(15) NOT NULL,
  `catatan` TEXT DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pendaftaran_id_unique` (`pendaftaran_id`),
  CONSTRAINT `fk_pengesahan_pendaftaran` FOREIGN KEY (`pendaftaran_id`) REFERENCES `pendaftaran_kursus` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ---------------------------------
-- JADUAL untuk HUBUNGAN POLIMORFIK (MorphOne, MorphMany, MorphToMany)
-- ---------------------------------

-- JADUAL untuk MorphOne & MorphMany: gambar
-- Boleh menyimpan gambar untuk Pelajar (satu-ke-satu) atau Kursus (satu-ke-banyak).
CREATE TABLE `gambar` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `path` varchar(255) NOT NULL,
  `imageable_id` int(11) NOT NULL,
  `imageable_type` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `imageable_idx` (`imageable_id`, `imageable_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- JADUAL untuk MorphMany: komen
-- Komen boleh ditinggalkan pada Pelajar atau Kursus.
CREATE TABLE `komen` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `teks` TEXT NOT NULL,
  `commentable_id` int(11) NOT NULL,
  `commentable_type` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `commentable_idx` (`commentable_id`, `commentable_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- JADUAL untuk MorphToMany: tag dan taggables
CREATE TABLE `tag` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nama_tag` varchar(50) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nama_tag_unique` (`nama_tag`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `taggables` (
  `tag_id` int(11) NOT NULL,
  `taggable_id` int(11) NOT NULL,
  `taggable_type` varchar(255) NOT NULL,
  PRIMARY KEY (`tag_id`, `taggable_id`, `taggable_type`),
  CONSTRAINT `fk_taggables_tag` FOREIGN KEY (`tag_id`) REFERENCES `tag` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;