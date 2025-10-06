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
        Schema::create('kursus', function (Blueprint $table) {
            $table->id('id_kursus');
            $table->string('nama_kursus'); // Jenis string lebih sesuai
            $table->string('kod_kursus')->unique(); // Laravel akan uruskan nama indeks unik
            $table->text('deskripsi')->nullable();
            $table->integer('jam_kredit')->default(3);

            // Jika prasyarat merujuk kepada id kursus lain
            // $table->foreignId('prasyarat_kursus_id')->nullable()->constrained('kursus');
            $table->integer('prasyarat_kursus_id')->nullable();

            $table->timestamps(); // Amalan terbaik untuk menambah lajur created_at dan updated_at
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('kursus');
    }
};