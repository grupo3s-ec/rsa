<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('via_status_events', function (Blueprint $table): void {
            $table->id();
            $table->string('via_ecu911_id', 40);
            $table->string('descripcion', 255);
            $table->string('provincia', 120);
            $table->string('canton', 120)->nullable();
            $table->unsignedSmallInteger('estado_anterior_id')->nullable();
            $table->unsignedSmallInteger('estado_actual_id');
            $table->string('estado_actual_nombre', 120);
            $table->text('observaciones')->nullable();
            $table->timestamp('via_modified_at')->nullable();
            $table->timestamp('detected_at');
            $table->timestamps();

            $table->index('via_ecu911_id');
            $table->index('provincia');
            $table->index('estado_actual_id');
            $table->index('detected_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('via_status_events');
    }
};
