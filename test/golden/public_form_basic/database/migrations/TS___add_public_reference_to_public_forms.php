<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add a unique public_reference column to every table that has a
     * public intake form enabled (Fixzy SysMaker generated code).
     * Guests reference their submissions by this code — never the
     * internal auto-increment id.
     */
    public function up(): void
    {

        if (Schema::hasTable('log_penting') && !Schema::hasColumn('log_penting', 'public_reference')) {
            Schema::table('log_penting', function (Blueprint $table) {
                $table->string('public_reference', 32)->nullable()->unique();
            });
        }

    }

    public function down(): void
    {

        if (Schema::hasTable('log_penting') && Schema::hasColumn('log_penting', 'public_reference')) {
            Schema::table('log_penting', function (Blueprint $table) {
                $table->dropUnique(['public_reference']);
            });
        }

    }
};
