<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('jana_bil', function (Blueprint $table) {
            $table->id();
            $table->integer('bil_1');
            $table->integer('bil_2');
            $table->integer('jumlah');
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('jana_bil');
    }
};