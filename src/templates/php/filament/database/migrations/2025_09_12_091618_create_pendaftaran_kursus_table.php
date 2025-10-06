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
        Schema::create('pendaftaran_kursus', function (Blueprint $table) {
            $table->id('id_pendaftaran');

            // Kunci asing yang dihubungkan ke jadual 'pelajar' dan 'kursus'

			$table->foreignId('pelajar_id')->constrained(table: 'pelajar', column: 'id_pelajar')->onDelete('cascade');
			$table->foreignId('kursus_id')->constrained(table: 'kursus', column: 'id_kursus')->onDelete('cascade');


            $table->timestamp('tarikh_pendaftaran')->useCurrent();
            $table->string('gred', 4)->nullable(); // Guna string dengan had 4 aksara
            $table->string('status')->default('Pending');
            $table->timestamps();

            // Indeks unik komposit yang betul. Laravel akan uruskan nama indeks.
            $table->unique(['pelajar_id', 'kursus_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pendaftaran_kursus');
    }
};