<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('approval_histories', function (Blueprint $table) {
            $table->id();
            $table->string('record_type');
            $table->unsignedBigInteger('record_id');
            $table->string('from_status')->nullable();
            $table->string('to_status');
            $table->text('comment')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->timestamps();

            $table->index(['record_type', 'record_id']);
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('approval_histories');
    }
};
