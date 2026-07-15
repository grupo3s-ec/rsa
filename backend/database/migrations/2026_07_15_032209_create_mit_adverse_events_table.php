<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mit_adverse_events', function (Blueprint $table): void {
            $table->id();

            // Cabeceras del boletín (texto crudo tal cual viene en el PDF)
            $table->unsignedTinyInteger('region')->nullable();
            $table->string('provincia', 60);
            $table->string('fecha_periodo_texto', 255);
            $table->text('tramo');
            $table->text('evento');
            $table->text('acciones_realizadas')->nullable();
            $table->text('observaciones')->nullable();
            $table->text('recomendaciones')->nullable();

            // Derivados para filtrar (calculados al importar, no vienen tal cual del PDF)
            $table->string('ruta_codigo', 20)->nullable();
            $table->string('tipo_evento', 60);
            $table->date('fecha_evento_inicio')->nullable();
            $table->date('fecha_evento_fin')->nullable();

            // Geocodificación aproximada del tramo (extremos), para dibujar en el mapa
            $table->decimal('inicio_lat', 10, 7)->nullable();
            $table->decimal('inicio_lng', 10, 7)->nullable();
            $table->decimal('fin_lat', 10, 7)->nullable();
            $table->decimal('fin_lng', 10, 7)->nullable();
            $table->string('geocoding_status', 20)->default('pendiente'); // pendiente|ok|fallido

            // Trazabilidad de la fuente exacta (el nombre del ministerio cambió entre boletines)
            $table->string('fuente_nombre', 120);
            $table->string('fuente_boletin', 180);
            $table->unsignedTinyInteger('boletin_mes');
            $table->unsignedSmallInteger('boletin_anio');

            $table->timestamps();

            $table->index('provincia');
            $table->index('ruta_codigo');
            $table->index('tipo_evento');
            $table->index('fecha_evento_inicio');
            $table->index(['boletin_anio', 'boletin_mes']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mit_adverse_events');
    }
};
