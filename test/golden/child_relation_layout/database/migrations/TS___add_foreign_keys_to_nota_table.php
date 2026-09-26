<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('nota', function (Blueprint $table) {
            $table->foreign(['projek_id'])->references(['id'])->on('projek')->onUpdate('restrict')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('nota', function (Blueprint $table) {
            $table->dropForeign(['projek_id']);
        });
    }
};