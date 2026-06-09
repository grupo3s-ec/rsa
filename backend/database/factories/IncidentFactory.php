<?php

namespace Database\Factories;

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
        return [
            'title' => fake()->randomElement([
                'Accidente en vía principal',
                'Daño en calzada',
                'Deslizamiento reportado',
                'Cierre parcial de vía',
                'Punto crítico operativo',
            ]),
            'type' => fake()->randomElement([
                'accident',
                'road_damage',
                'landslide',
                'closure',
                'risk',
                'checkpoint',
                'assistance',
            ]),
            'severity' => fake()->randomElement(['low', 'medium', 'high', 'critical']),
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