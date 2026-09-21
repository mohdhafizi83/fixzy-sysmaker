<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('keputusan_ujian', function (Blueprint $table) {
            $table->foreign(['pelajar_id'])->references(['id'])->on('pelajar');
        });
    }

    public function down(): void
    {
        Schema::table('keputusan_ujian', function (Blueprint $table) {
            $table->dropForeign(['pelajar_id']);
        });
    }
};