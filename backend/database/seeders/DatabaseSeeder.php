<?php

namespace Database\Seeders;

use App\Models\HazardType;
use App\Models\Incident;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        User::factory()->create([
            'name' => 'RSA Demo User',
            'email' => 'demo@rsa.local',
        ]);

        $this->call(HazardTypeSeeder::class);

        $cruce = HazardType::where('name', 'Cruce peligroso')->firstOrFail();
        $curva = HazardType::where('name', 'Curva peligrosa')->firstOrFail();
        $peaje = HazardType::where('name', 'Peaje')->firstOrFail();

        Incident::factory()->createMany([
            [
                'title' => 'Cierre parcial por siniestro',
                'hazard_type_id' => $cruce->id,
                'type' => $cruce->name,
                'severity' => $cruce->severity,
                'condition' => $cruce->condition,
                'risks' => $cruce->risks,
                'description' => 'Siniestro reportado en ruta principal. Se recomienda reducir velocidad y confirmar paso con operaciones.',
                'latitude' => -0.1806532,
                'longitude' => -78.4678382,
                'source' => 'manual',
                'video_url' => 'https://drive.google.com/file/d/demo-accident-reference/view',
                'occurred_at' => now()->subHours(2),
                'status' => 'open',
            ],
            [
                'title' => 'Daño severo en calzada',
                'hazard_type_id' => $curva->id,
                'type' => $curva->name,
                'severity' => $curva->severity,
                'condition' => $curva->condition,
                'risks' => $curva->risks,
                'description' => 'Baches profundos en carril derecho. Riesgo para transporte pesado.',
                'latitude' => -0.2298500,
                'longitude' => -78.5249500,
                'source' => 'google_drive',
                'video_url' => 'https://drive.google.com/file/d/demo-road-damage-reference/view',
                'occurred_at' => now()->subDay(),
                'status' => 'in_progress',
            ],
            [
                'title' => 'Punto de control operativo',
                'hazard_type_id' => $peaje->id,
                'type' => $peaje->name,
                'severity' => $peaje->severity,
                'condition' => $peaje->condition,
                'risks' => $peaje->risks,
                'description' => 'Punto de control activo para revisión de documentación y estado de unidad.',
                'latitude' => -0.1200000,
                'longitude' => -78.4800000,
                'source' => 'geotab',
                'video_url' => null,
                'occurred_at' => now()->subHours(5),
                'status' => 'open',
            ],
        ]);
    }
}