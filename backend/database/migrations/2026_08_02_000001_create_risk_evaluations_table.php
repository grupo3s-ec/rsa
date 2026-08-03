<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('risk_evaluations', function (Blueprint $table): void {
            $table->id();
            $table->string('nombre', 160)->unique();
            $table->timestamps();
        });

        Schema::create('risk_evaluation_kms', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('risk_evaluation_id')->constrained()->cascadeOnDelete();

            $table->string('km_label', 20);
            $table->unsignedInteger('km_number');
            $table->decimal('lat', 10, 7);
            $table->decimal('lng', 10, 7);

            $table->dateTime('fecha_video')->nullable();
            $table->string('video_filename', 160)->nullable();
            $table->string('video_url', 500)->nullable();

            $table->string('tipo_camino', 40)->nullable();
            $table->text('comentario')->nullable();

            // Hasta 5 condiciones por km: [{condicion, tipo, riesgos,
            // impacto, imagen_url}, ...] — no son columnas propias porque no
            // se necesita filtrar/ordenar por ellas individualmente, solo
            // mostrarlas juntas en el tooltip del km.
            $table->json('conditions');

            $table->timestamps();

            $table->unique(['risk_evaluation_id', 'km_number']);
            $table->index(['lat', 'lng']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('risk_evaluation_kms');
        Schema::dropIfExists('risk_evaluations');
    }
};
