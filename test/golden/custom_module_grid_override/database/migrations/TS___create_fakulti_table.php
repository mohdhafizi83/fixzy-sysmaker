<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fakulti', function (Blueprint $table) {
            $table->id();
            $table->string('nama_fakulti', 255)->nullable();
            $table->boolean('is_aktif')->nullable();
            $table->string('status_kerja', 50)->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fakulti');
    }
};