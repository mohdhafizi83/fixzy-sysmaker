<?php
// seed parent watak rows for CM round-trip test
$db = new PDO('sqlite:/tmp/fsm-matrix-app/database/database.sqlite');
$db->exec("DELETE FROM watak");
$db->exec("INSERT INTO watak (nama_watak, created_at, updated_at) VALUES ('Watak Satu', datetime('now'), datetime('now'))");
$db->exec("INSERT INTO watak (nama_watak, created_at, updated_at) VALUES ('Watak Dua', datetime('now'), datetime('now'))");
echo "seeded\n";
