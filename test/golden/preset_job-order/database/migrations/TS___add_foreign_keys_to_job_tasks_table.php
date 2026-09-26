<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('job_tasks', function (Blueprint $table) {
            $table->foreign(['job_id'])->references(['id'])->on('jobs');
        });
    }

    public function down(): void
    {
        Schema::table('job_tasks', function (Blueprint $table) {
            $table->dropForeign(['job_id']);
        });
    }
};