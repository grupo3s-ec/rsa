<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('incidents', function (Blueprint $table): void {
            // Vincula el incidente con su ExceptionEvent en Geotab.
            $table->string('geotab_exception_event_id', 64)->nullable()->after('source');
            $table->string('geotab_device_id', 64)->nullable()->after('geotab_exception_event_id');
            $table->string('geotab_rule_id', 64)->nullable()->after('geotab_device_id');
            // Altimetría en metros sobre el nivel del mar (de StatusData).
            $table->decimal('altitude_meters', 8, 2)->nullable()->after('geotab_rule_id');

            $table->index('geotab_exception_event_id');
            $table->index('geotab_device_id');
        });
    }

    public function down(): void
    {
        Schema::table('incidents', function (Blueprint $table): void {
            $table->dropIndex(['geotab_exception_event_id']);
            $table->dropIndex(['geotab_device_id']);
            $table->dropColumn([
                'geotab_exception_event_id',
                'geotab_device_id',
                'geotab_rule_id',
                'altitude_meters',
            ]);
        });
    }
};
