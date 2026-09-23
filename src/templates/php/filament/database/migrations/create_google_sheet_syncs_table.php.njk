<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Mapping between generated app tables and their Google Spreadsheets.
 * Created by Fixzy SysMaker (Google Sheets Sync module).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('google_sheet_syncs', function (Blueprint $table) {
            $table->id();
            $table->string('table_key')->unique();          // model class basename, e.g. "Pelajar"
            $table->string('spreadsheet_id')->nullable();
            $table->string('sheet_name')->default('Sheet1');
            $table->timestamp('last_synced_at')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('google_sheet_syncs');
    }
};
