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
        Schema::create('pengesahan_pendaftaran', function (Blueprint $table) {
            $table->id('id_pengesahan');
            $table->integer('pendaftaran_id')->index('idx_pendaftaran');
            $table->integer('user_id')->index('idx_users');
            $table->text('status_baharu');
            $table->text('catatan')->nullable()->default('NULL');
            $table->timestamp('tarikh_tindakan')->useCurrent();
			$table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pengesahan_pendaftaran');
    }
};
