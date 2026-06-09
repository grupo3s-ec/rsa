<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
{
    Schema::create('incidents', function (Blueprint $table): void {
        $table->id();
        $table->string('title', 160);
        $table->string('type', 40);
        $table->string('severity', 40);
        $table->text('description')->nullable();
        $table->decimal('latitude', 10, 7);
        $table->decimal('longitude', 10, 7);
        $table->string('source', 40);
        $table->string('video_url', 2048)->nullable();
        $table->timestamp('occurred_at')->nullable();
        $table->string('status', 40)->default('open');
        $table->timestamps();

        $table->index(['latitude', 'longitude']);
        $table->index(['type', 'severity']);
        $table->index('status');
        $table->index('source');
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('incidents');
    }
};
