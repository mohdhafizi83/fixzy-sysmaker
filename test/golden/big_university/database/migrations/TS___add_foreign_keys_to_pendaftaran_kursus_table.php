<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pendaftaran_kursus', function (Blueprint $table) {
            $table->foreign(['pelajar_id'])->references(['id'])->on('pelajar')->onUpdate('cascade')->onDelete('cascade');
            $table->foreign(['kursus_id'])->references(['id'])->on('kursus')->onUpdate('cascade')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::table('pendaftaran_kursus', function (Blueprint $table) {
            $table->dropForeign(['pelajar_id']);
            $table->dropForeign(['kursus_id']);
        });
    }
};