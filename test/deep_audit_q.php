<?php
// argv-passed SQLite query helper for the deep-audit harness.
// DB path from FSM_TEST_DB env (default: deep-audit app db).
$db = new PDO('sqlite:' . (getenv('FSM_TEST_DB') ?: '/tmp/fsm-deep-app/database/database.sqlite'));
echo json_encode($db->query($argv[1])->fetchAll(PDO::FETCH_ASSOC)), "\n";
