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
        Schema::create('dokumen_pelajar', function (Blueprint $table) {
            $table->id('id_dokumen');
            $table->integer('pelajar_id');
            $table->text('nama_fail');
            $table->text('path_fail');
            $table->text('jenis_dokumen')->nullable()->default('Am');
            $table->timestamp('tarikh_muatnaik')->nullable()->useCurrent();
			$table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('dokumen_pelajar');
    }
};
