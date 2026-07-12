<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hazard_types', function (Blueprint $table): void {
            $table->id();
            $table->string('condition', 40);
            $table->string('name', 120)->unique();
            $table->text('risks')->nullable();
            $table->string('severity', 20);
            $table->timestamps();

            $table->index('condition');
            $table->index('severity');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hazard_types');
    }
};
