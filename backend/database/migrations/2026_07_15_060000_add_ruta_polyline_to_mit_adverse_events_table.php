<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mit_adverse_events', function (Blueprint $table): void {
            // Polyline codificada (formato estándar de Google) de la ruta por
            // carretera entre inicio y fin del tramo — evita dibujar una línea
            // recta que atraviesa el país cuando esos dos puntos están lejos
            // entre sí. Nullable: puede no haber ruta conocida entre los dos
            // puntos, o la fila puede no haber sido geocodificada aún.
            $table->text('ruta_polyline')->nullable()->after('geocoding_status');
        });
    }

    public function down(): void
    {
        Schema::table('mit_adverse_events', function (Blueprint $table): void {
            $table->dropColumn('ruta_polyline');
        });
    }
};
