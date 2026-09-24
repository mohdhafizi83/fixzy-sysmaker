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
            'fields' => ["id","nama_fakulti","created_at","updated_at","deleted_at"],
            'rules' => ['id' => ["integer"], 'nama_fakulti' => ["required","string","max:255"], 'created_at' => ["date"], 'updated_at' => ["date"], 'deleted_at' => ["date"]],
            'unique' => [],
            'read_roles' => ["admin","viewer"],
            'write_roles' => ["admin"],
            'rate_limit' => 120,
        ],

    ];

    public static function for(string $slug): ?array
    {
        return self::$tables[$slug] ?? null;
    }
}
