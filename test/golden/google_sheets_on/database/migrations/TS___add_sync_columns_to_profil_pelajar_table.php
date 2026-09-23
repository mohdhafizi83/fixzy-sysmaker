<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Google Sheets sync identity columns for table `profil_pelajar`.
 *
 * - sync_uuid: stable row identity carried in the sheet's first column.
 *   Rows inserted from the sheet get a fresh UUID; rows created in the
 *   app get one at first push. Never edited by users.
 * - sheet_synced_at: last time this row was reconciled with the sheet
 *   (used for last-write-wins conflict detection).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('profil_pelajar', function (Blueprint $table) {
            $table->char('sync_uuid', 36)->nullable()->unique();
            $table->timestamp('sheet_synced_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('profil_pelajar', function (Blueprint $table) {
            $table->dropUnique(['sync_uuid']);
            $table->dropColumn(['sync_uuid', 'sheet_synced_at']);
        });
    }
};
