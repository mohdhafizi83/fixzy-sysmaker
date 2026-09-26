<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tickets', function (Blueprint $table) {
            $table->id();
            $table->string('ticket_no', 30)->nullable()->unique();
            $table->string('subject', 200)->nullable();
            $table->string('requester_name', 150)->nullable();
            $table->string('requester_email', 150)->nullable();
            $table->string('priority', 20)->nullable()->default('medium');
            $table->string('ticket_status', 30)->nullable()->default('new');
            $table->string('assigned_to', 150)->nullable();
            $table->text('description')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->unsignedBigInteger('deleted_by')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tickets');
    }
};