<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pelajar', function (Blueprint $table) {
            $table->id();
            $table->foreignId('fakulti_id')->nullable();
            $table->string('nama_penuh', 150);
            $table->string('no_matrik', 20)->unique();
            $table->json('email')->unique();
            $table->date('tarikh_daftar')->nullable()->default('NULL');
            $table->string('gambar_profil', 255)->nullable()->default('NULL');
            $table->string('surat_tawaran', 255)->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pelajar');
    }
};