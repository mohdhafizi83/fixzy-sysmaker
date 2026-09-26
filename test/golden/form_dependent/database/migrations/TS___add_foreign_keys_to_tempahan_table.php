<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tempahan', function (Blueprint $table) {
            $table->foreign(['room_number'])->references(['id'])->on('bilik');
            $table->foreign(['slot'])->references(['id'])->on('slot_bilik');
        });
    }

    public function down(): void
    {
        Schema::table('tempahan', function (Blueprint $table) {
            $table->dropForeign(['room_number']);
            $table->dropForeign(['slot']);
        });
    }
};