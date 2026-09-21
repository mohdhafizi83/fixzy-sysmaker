<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('kursus', function (Blueprint $table) {
            $table->foreign(['prasyarat_kursus_id'])->references(['id'])->on('kursus')->onUpdate('cascade')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('kursus', function (Blueprint $table) {
            $table->dropForeign(['prasyarat_kursus_id']);
        });
    }
};