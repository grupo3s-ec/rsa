<?php

namespace Database\Factories;

use App\Models\HazardType;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\Incident>
 */
class IncidentFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        // Reutiliza un hazard type ya sembrado si existe, en vez de crear uno nuevo
        // por cada incidente (evita ensuciar el catálogo cuando se llama junto al seeder).
        $hazardType = HazardType::query()->inRandomOrder()->first() ?? HazardType::factory()->create();

        return [
            'title' => fake()->randomElement([
                'Accidente en vía principal',
                'Daño en calzada',
                'Deslizamiento reportado',
                'Cierre parcial de vía',
                'Punto crítico operativo',
            ]),
            'hazard_type_id' => $hazardType->id,
            'type' => $hazardType->name,
            'severity' => $hazardType->severity,
            'condition' => $hazardType->condition,
            'risks' => $hazardType->risks,
            'description' => fake()->sentence(18),
            'latitude' => fake()->randomFloat(7, -0.35, -0.05),
            'longitude' => fake()->randomFloat(7, -78.65, -78.35),
            'source' => fake()->randomElement(['manual', 'google_drive', 'geotab']),
            'video_url' => fake()->optional()->url(),
            'occurred_at' => fake()->optional()->dateTimeBetween('-7 days', 'now'),
            'status' => fake()->randomElement(['open', 'in_progress', 'resolved', 'archived']),
        ];
    }
}