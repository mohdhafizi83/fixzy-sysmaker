<?php

/**
 * Mock Google Sheets API for the gsheets e2e harness.
 *
 * Run: php -S 127.0.0.1:8788 test/mocks/gsheets_mock.php
 * State persists in GSHEETS_MOCK_STATE (json file, flock-guarded).
 *
 * Implements just enough of the real API surface used by
 * App\Services\GoogleSheets\GoogleSheetsSyncService:
 *   POST /token                                  fake OAuth token
 *   POST /v4/spreadsheets                        create spreadsheet
 *   GET  /v4/spreadsheets/{id}                   metadata (sheets.properties)
 *   POST /v4/spreadsheets/{id}:batchUpdate       deleteDimension
 *   GET  /v4/spreadsheets/{id}/values/{range}    values.get
 *   PUT  /v4/spreadsheets/{id}/values/{range}    values.update
 *   POST /v4/spreadsheets/{id}/values/{range}:append
 *   POST /drive/v3/files/{id}/permissions        share (Drive API)
 *
 * Every request is counted in state['request_log'] so tests can assert
 * write counts (e.g. echo-loop suppression).
 */

$stateFile = getenv('GSHEETS_MOCK_STATE') ?: sys_get_temp_dir() . '/gsheets_mock_state.json';

function load_state(string $f): array
{
    if (!is_file($f)) {
        return ['spreadsheets' => [], 'permissions' => [], 'request_log' => [], 'counter' => 0];
    }
    $json = @file_get_contents($f);
    $s = json_decode((string) $json, true);
    return is_array($s) ? $s : ['spreadsheets' => [], 'permissions' => [], 'request_log' => [], 'counter' => 0];
}

function save_state(string $f, array $s): void
{
    file_put_contents($f, json_encode($s, JSON_PRETTY_PRINT), LOCK_EX);
}

function respond(int $code, array $body): void
{
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($body);
    exit;
}

function col_letters_to_index(string $col): int
{
    $col = strtoupper(preg_replace('/[^A-Z]/', '', $col));
    $n = 0;
    foreach (str_split($col) as $c) {
        $n = $n * 26 + (ord($c) - 64);
    }
    return $n - 1; // 0-based
}

/**
 * Parse an A1 range like "'Sheet Name'!A1:ZZZ" or "A2:A" or "A5".
 * Returns [sheetName, startRow0, startCol0, endRow0|null, endCol0|null].
 */
function parse_range(string $range, string $defaultSheet): array
{
    $sheet = $defaultSheet;
    if (str_contains($range, '!')) {
        [$sheetPart, $range] = explode('!', $range, 2);
        $sheet = trim($sheetPart, "'\" ");
    }
    if (!preg_match('/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+)?)?$/i', strtoupper($range), $m)) {
        return [$sheet, 0, 0, null, null];
    }
    $startRow = (int) $m[2] - 1;
    $startCol = col_letters_to_index($m[1]);
    $endRow = isset($m[4]) && $m[4] !== '' ? (int) $m[4] - 1 : null;
    $endCol = isset($m[3]) && $m[3] !== '' ? col_letters_to_index($m[3]) : null;
    return [$sheet, $startRow, $startCol, $endRow, $endCol];
}

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
parse_str(parse_url($_SERVER['REQUEST_URI'], PHP_URL_QUERY) ?? '', $query);

$state = load_state($stateFile);
$state['request_log'][] = $method . ' ' . $path;
save_state($stateFile, $state);

$body = json_decode(file_get_contents('php://input'), true) ?: [];

// ---- OAuth token endpoint ----------------------------------------------------
if ($path === '/token' && $method === 'POST') {
    respond(200, [
        'access_token' => 'mock-access-token',
        'expires_in' => 3600,
        'token_type' => 'Bearer',
    ]);
}

// ---- Create spreadsheet ----------------------------------------------------
if ($path === '/v4/spreadsheets' && $method === 'POST') {
    $state = load_state($stateFile);
    $id = 'MOCK_SS_' . (++$state['counter']);
    $title = $body['properties']['title'] ?? 'Sheet1';
    $state['spreadsheets'][$id] = [
        'properties' => ['title' => $title],
        'sheets' => [
            ['properties' => ['sheetId' => 0, 'title' => 'Sheet1']],
        ],
        'values' => ['Sheet1' => []],
    ];
    save_state($stateFile, $state);
    respond(200, [
        'spreadsheetId' => $id,
        'properties' => ['title' => $title],
        'sheets' => $state['spreadsheets'][$id]['sheets'],
    ]);
}

if (preg_match('#^/v4/spreadsheets/([^/:]+)$#', $path, $m) && $method === 'GET') {
    $id = $m[1];
    if (!isset($state['spreadsheets'][$id])) respond(404, ['error' => ['message' => 'spreadsheet not found']]);
    $ss = $state['spreadsheets'][$id];
    respond(200, [
        'spreadsheetId' => $id,
        'properties' => $ss['properties'],
        'sheets' => $ss['sheets'],
    ]);
}

// ---- batchUpdate (deleteDimension) ------------------------------------------
if (preg_match('#^/v4/spreadsheets/([^/:]+):batchUpdate$#', $path, $m) && $method === 'POST') {
    $id = $m[1];
    if (!isset($state['spreadsheets'][$id])) respond(404, ['error' => ['message' => 'spreadsheet not found']]);
    $state = load_state($stateFile);
    $ss = &$state['spreadsheets'][$id];
    foreach ($body['requests'] ?? [] as $req) {
        if (isset($req['deleteDimension']['range'])) {
            $r = $req['deleteDimension']['range'];
            $sheetId = (int) ($r['sheetId'] ?? 0);
            $sheetName = null;
            foreach ($ss['sheets'] as $s) {
                if ((int) $s['properties']['sheetId'] === $sheetId) $sheetName = $s['properties']['title'];
            }
            if ($sheetName !== null && ($r['dimension'] ?? '') === 'ROWS') {
                $start = (int) $r['startIndex'];
                $end = (int) ($r['endIndex'] ?? $start + 1);
                $rows = $ss['values'][$sheetName] ?? [];
                array_splice($rows, $start, $end - $start);
                $ss['values'][$sheetName] = $rows;
            }
        }
    }
    save_state($stateFile, $state);
    respond(200, ['replies' => []]);
}

// ---- permissions (Drive API: /drive/v3/files/{id}/permissions) -------------
if (preg_match('#^/drive/v3/files/([^/:]+)/permissions$#', $path, $m) && $method === 'POST') {
    $state = load_state($stateFile);
    $state['permissions'][] = ['spreadsheet' => $m[1]] + $body;
    save_state($stateFile, $state);
    respond(200, ['id' => 'perm-' . count($state['permissions'])] + $body);
}

// ---- values.get ------------------------------------------------------------
if (preg_match('#^/v4/spreadsheets/([^/:]+)/values/(.+)$#', $path, $m) && $method === 'GET') {
    $id = $m[1];
    $range = urldecode($m[2]);
    if (!isset($state['spreadsheets'][$id])) respond(404, ['error' => ['message' => 'spreadsheet not found']]);
    $ss = $state['spreadsheets'][$id];
    $defaultSheet = $ss['sheets'][0]['properties']['title'];
    [$sheet, $sr, $sc, $er, $ec] = parse_range($range, $defaultSheet);
    $rows = $ss['values'][$sheet] ?? [];
    $out = [];
    $endRow = $er ?? (count($rows) - 1);
    for ($i = $sr; $i <= $endRow && $i < count($rows); $i++) {
        $row = $rows[$i];
        $slice = array_slice($row, $sc, ($ec ?? null) !== null ? ($ec - $sc + 1) : null);
        $out[] = $slice;
    }
    respond(200, ['range' => $range, 'majorDimension' => 'ROWS', 'values' => $out]);
}

// ---- values.update ----------------------------------------------------------
if (preg_match('#^/v4/spreadsheets/([^/:]+)/values/(.+)$#', $path, $m) && $method === 'PUT') {
    $id = $m[1];
    $range = urldecode($m[2]);
    if (!isset($state['spreadsheets'][$id])) respond(404, ['error' => ['message' => 'spreadsheet not found']]);
    $state = load_state($stateFile);
    $ss = &$state['spreadsheets'][$id];
    $defaultSheet = $ss['sheets'][0]['properties']['title'];
    [$sheet, $sr, $sc] = parse_range($range, $defaultSheet);
    $rows = $ss['values'][$sheet] ?? [];
    foreach ($body['values'] ?? [] as $i => $vals) {
        $target = $sr + $i;
        while (count($rows) <= $target) $rows[] = [];
        foreach ($vals as $j => $v) {
            $rows[$target][$sc + $j] = $v;
        }
    }
    // Normalize ragged rows to equal width.
    $width = 0;
    foreach ($rows as $r) $width = max($width, count($r));
    foreach ($rows as $i => $r) $rows[$i] = array_pad($r, $width, '');
    $ss['values'][$sheet] = $rows;
    save_state($stateFile, $state);
    respond(200, ['updatedRange' => $range, 'updatedRows' => count($body['values'] ?? [])]);
}

// ---- values.append -----------------------------------------------------------
if (preg_match('#^/v4/spreadsheets/([^/:]+)/values/(.+):append$#', $path, $m) && $method === 'POST') {
    $id = $m[1];
    $state = load_state($stateFile);
    if (!isset($state['spreadsheets'][$id])) respond(404, ['error' => ['message' => 'spreadsheet not found']]);
    $ss = &$state['spreadsheets'][$id];
    $defaultSheet = $ss['sheets'][0]['properties']['title'];
    [$sheet] = parse_range(urldecode($m[2]), $defaultSheet);
    $rows = $ss['values'][$sheet] ?? [];
    $width = 0;
    foreach ($rows as $r) $width = max($width, count($r));
    foreach ($body['values'] ?? [] as $vals) {
        $rows[] = array_pad($vals, $width, '');
    }
    $ss['values'][$sheet] = $rows;
    save_state($stateFile, $state);
    respond(200, ['updatedRange' => $sheet . '!A' . count($rows), 'updatedRows' => count($body['values'] ?? [])]);
}

respond(404, ['error' => ['message' => 'mock: unhandled ' . $method . ' ' . $path]]);
