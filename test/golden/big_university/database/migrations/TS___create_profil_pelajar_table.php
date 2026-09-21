<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('profil_pelajar', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pelajar_id')->unique();
            $table->text('alamat')->nullable();
            $table->string('no_telefon', 20)->nullable()->default('NULL');
            $table->date('tarikh_lahir')->nullable()->default('NULL');
            $table->string('info_kecemasan', 200)->nullable()->default('NULL');
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('profil_pelajar');
    }
};