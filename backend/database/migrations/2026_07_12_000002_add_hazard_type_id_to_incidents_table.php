<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('incidents', function (Blueprint $table): void {
            $table->foreignId('hazard_type_id')->nullable()->after('severity')
                ->constrained('hazard_types')->nullOnDelete();
            $table->string('condition', 40)->nullable()->after('hazard_type_id');
            $table->text('risks')->nullable()->after('condition');

            $table->index('hazard_type_id');
        });
    }

    public function down(): void
    {
        Schema::table('incidents', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('hazard_type_id');
            $table->dropColumn(['condition', 'risks']);
        });
    }
};
