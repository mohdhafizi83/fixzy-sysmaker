<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('slot_bilik', function (Blueprint $table) {
            $table->id();
            $table->string('slot_label', 255)->nullable();
            $table->foreignId('bilik_id')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('slot_bilik');
    }
};