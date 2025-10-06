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
        Schema::table('pendaftaran_kursus', function (Blueprint $table) {
            $table->foreign(['kursus_id'], null)->references(['id_kursus'])->on('kursus')->onUpdate('cascade')->onDelete('cascade');
            $table->foreign(['pelajar_id'], null)->references(['id_pelajar'])->on('pelajar')->onUpdate('cascade')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('pendaftaran_kursus', function (Blueprint $table) {
            $table->dropForeign();
            $table->dropForeign();
        });
    }
};
