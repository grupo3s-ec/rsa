<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ant_accidents', function (Blueprint $table): void {
            $table->id();

            // Código único del siniestro tal cual viene en la BDD de la ANT
            // (ej. "CTE00001012026") — permite reimportar sin duplicar.
            $table->string('codigo', 40)->unique();
            $table->unsignedSmallInteger('anio');
            $table->date('fecha')->nullable();
            $table->time('hora')->nullable();

            // Ubicación exacta — a diferencia de ECU911/MIT, viene ya
            // geocodificada por la ANT, no aproximada por nombre de lugar.
            $table->decimal('lat', 10, 7);
            $table->decimal('lng', 10, 7);

            $table->string('dpa_provincia', 10)->nullable();
            $table->string('provincia', 60)->nullable();
            $table->string('dpa_canton', 10)->nullable();
            $table->string('canton', 80)->nullable();
            $table->string('dpa_parroquia', 10)->nullable();
            $table->string('parroquia', 80)->nullable();
            $table->text('direccion')->nullable();
            $table->string('zona_planificacion', 20)->nullable();
            $table->string('zona', 20)->nullable();
            $table->string('id_via', 40)->nullable();
            $table->string('nombre_via', 120)->nullable();

            // Entidad que reportó el siniestro (CTE, ATM, DMQ, municipios, etc.)
            $table->string('ente_control', 20)->nullable();
            $table->boolean('feriado')->default(false);
            $table->string('codigo_causa', 10)->nullable();
            $table->string('causa_probable', 255)->nullable();
            $table->string('tipo_siniestro', 60)->nullable();

            $table->unsignedSmallInteger('lesionados')->default(0);
            $table->unsignedSmallInteger('fallecidos')->default(0);
            $table->unsignedTinyInteger('num_vehiculos')->default(0);

            $table->timestamps();

            $table->index(['lat', 'lng']);
            $table->index('provincia');
            $table->index('fecha');
            $table->index('tipo_siniestro');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ant_accidents');
    }
};
