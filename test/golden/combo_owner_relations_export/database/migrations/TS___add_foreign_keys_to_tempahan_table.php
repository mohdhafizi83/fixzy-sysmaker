<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tempahan', function (Blueprint $table) {
            $table->foreign(['pelanggan_id'])->references(['id'])->on('pelanggan')->onUpdate('cascade')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::table('tempahan', function (Blueprint $table) {
            $table->dropForeign(['pelanggan_id']);
        });
    }
};