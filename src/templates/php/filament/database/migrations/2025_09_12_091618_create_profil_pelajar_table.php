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
        Schema::create('profil_pelajar', function (Blueprint $table) {
            $table->id('id_profil');

			$table->foreignId('pelajar_id')->unique()->constrained(table: 'pelajar', column: 'id_pelajar')->onDelete('cascade');

            $table->text('alamat')->nullable();
            $table->string('no_telefon')->nullable();
            $table->date('tarikh_lahir')->nullable();
            $table->text('info_kecemasan')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('profil_pelajar');
    }
};