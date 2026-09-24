<?php

namespace App\Api;

/**
 * Generated API registry (Fixzy SysMaker).
 *
 * Maps each API-enabled table slug to its model, exposed field
 * allowlist, validation rules, and required Shield roles.
 * Sensitive columns are filtered at generation time — they never
 * appear in $tables even if an allowlist mentions them.
 */
class ApiRegistry
{
    /** @var array<string, array<string, mixed>> */
    public static array $tables = [

        'fakulti' => [
            'model' => \App\Models\Fakulti::class,
            'table' => 'fakulti',
            'fields' => ["nama_fakulti"],
            'rules' => ['nama_fakulti' => ["required","string","max:255"]],
            'unique' => [],
            'read_roles' => ["admin"],
            'write_roles' => ["admin"],
            'rate_limit' => 60,
        ],

    ];

    public static function for(string $slug): ?array
    {
        return self::$tables[$slug] ?? null;
    }
}
