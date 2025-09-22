-- Skrip ini sengaja direka untuk gagal bagi tujuan pengujian.
-- Ia menggunakan klausa 'PARTITION BY' yang merupakan sintaks MySQL lanjutan.

CREATE TABLE `ujian_import_gagal` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `log_data` VARCHAR(255) DEFAULT NULL,
  `tarikh_masuk` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
PARTITION BY HASH(id)
PARTITIONS 2;

-- Penterjemah SQL tidak akan sampai ke jadual ini kerana ia akan gagal pada jadual di atas.
CREATE TABLE `jadual_kedua` (
    `id` INT(11) NOT NULL,
    `info` VARCHAR(50)
);