<?php

namespace Database\Seeders;

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

        Incident::factory()->createMany([
            [
                'title' => 'Cierre parcial por siniestro',
                'type' => 'accident',
                'severity' => 'critical',
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
                'type' => 'road_damage',
                'severity' => 'high',
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
                'type' => 'checkpoint',
                'severity' => 'medium',
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