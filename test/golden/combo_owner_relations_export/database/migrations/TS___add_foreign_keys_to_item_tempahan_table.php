<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('item_tempahan', function (Blueprint $table) {
            $table->foreign(['tempahan_id'])->references(['id'])->on('tempahan')->onUpdate('cascade')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::table('item_tempahan', function (Blueprint $table) {
            $table->dropForeign(['tempahan_id']);
        });
    }
};