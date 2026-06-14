<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('incident_media', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('incident_id')->constrained()->cascadeOnDelete();

            // 'photo' | 'video'
            $table->string('media_type', 20)->default('photo');

            // URL pública del archivo (R2 para subidas manuales, o null si viene de Geotab).
            $table->string('url', 2048)->nullable();

            // Thumbnail generado (para videos o fotos grandes).
            $table->string('thumbnail_url', 2048)->nullable();

            // Referencia al MediaFile de Geotab (cuando el origen es Geotab).
            $table->string('geotab_media_file_id', 64)->nullable();

            // Nombre original del archivo.
            $table->string('file_name', 255)->nullable();

            // Tamaño en bytes (informativo).
            $table->unsignedBigInteger('file_size')->nullable();

            $table->timestamps();

            $table->index('incident_id');
            $table->index('geotab_media_file_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('incident_media');
    }
};
