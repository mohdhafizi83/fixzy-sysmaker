<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tempahan', function (Blueprint $table) {
            $table->id();
            $table->string('nama', 255)->nullable();
            $table->foreignId('room_number')->nullable();
            $table->foreignId('slot')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tempahan');
    }
};