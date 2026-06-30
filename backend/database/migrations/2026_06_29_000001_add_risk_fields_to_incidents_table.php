<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('incidents', function (Blueprint $table) {
            $table->unsignedTinyInteger('probability')->nullable()->after('altitude_meters');
            $table->unsignedTinyInteger('impact')->nullable()->after('probability');
            $table->unsignedTinyInteger('risk_score')->nullable()->after('impact');
            $table->string('risk_level', 20)->nullable()->after('risk_score');
        });
    }

    public function down(): void
    {
        Schema::table('incidents', function (Blueprint $table) {
            $table->dropColumn(['probability', 'impact', 'risk_score', 'risk_level']);
        });
    }
};
