<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_saved_routes', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            $table->string('nombre', 60);

            // Origen, destino y waypoints intermedios en orden — cada uno
            // {lat, lng, address, placeId?}. No son columnas propias porque
            // el número de puntos es variable (2 a 8, igual que el planner).
            $table->json('waypoints');

            $table->timestamps();

            $table->unique(['user_id', 'nombre']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_saved_routes');
    }
};
