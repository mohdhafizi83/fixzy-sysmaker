<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('pelajar', function (Blueprint $table) {
            $table->id('id_pelajar'); // Mencipta lajur 'id' auto-increment sebagai kunci utama
            $table->string('nama_penuh');
            $table->string('no_matrik')->unique(); // Indeks unik yang betul
            $table->string('email')->unique(); // Indeks unik yang betul
            $table->date('tarikh_daftar')->nullable();
            $table->string('gambar_profil')->nullable(); // Guna string untuk laluan fail
			$table->string('surat_tawaran')->nullable();
            $table->timestamps(); // Menambah lajur created_at dan updated_at
			$table->softDeletes(); // Jika softdelete
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pelajar');
    }
};