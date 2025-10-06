<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('pengesahan_pendaftaran', function (Blueprint $table) {
            $table->foreign(['user_id'], null)->references(['id'])->on('users')->onUpdate('cascade')->onDelete('no action');
            $table->foreign(['pendaftaran_id'], null)->references(['id_pendaftaran'])->on('pendaftaran_kursus')->onUpdate('cascade')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('pengesahan_pendaftaran', function (Blueprint $table) {
            $table->dropForeign();
            $table->dropForeign();
        });
    }
};
