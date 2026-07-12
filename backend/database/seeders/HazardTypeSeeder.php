<?php

namespace Database\Seeders;

use App\Models\HazardType;
use Illuminate\Database\Seeder;

class HazardTypeSeeder extends Seeder
{
    public function run(): void
    {
        $rows = [
            // Física
            ['fisica', 'Intersección', 'Choque, accidente de tránsito', 'high'],
            ['fisica', 'Semáforo', 'Atropellamiento, choque', 'high'],
            ['fisica', 'Peaje', 'N/A', 'low'],
            ['fisica', 'Curva peligrosa', 'Volcamiento', 'medium'],
            ['fisica', 'Curva', 'Salir de vía, invasión de carril, encunetar', 'medium'],
            ['fisica', 'Caída de rocas', 'Aplastamiento, deslizamiento, derrape', 'high'],
            ['fisica', 'Pasos peatonales', 'Atropellamiento', 'low'],
            ['fisica', 'Estación de servicios', 'N/A', 'low'],
            ['fisica', 'Puente peatonal', 'Peatones imprudentes, no usan paso peatonal, atropellamiento', 'medium'],
            ['fisica', 'Cruce peligroso', 'Choque, accidente de tránsito', 'high'],
            ['fisica', 'Descenso', 'Recalentamiento de frenos', 'medium'],
            ['fisica', 'Zona escolar', 'Atropellamiento', 'high'],
            ['fisica', 'Límite de velocidad', 'Choque, accidente de tránsito', 'high'],
            ['fisica', 'Glorieta', 'Choque, accidente de tránsito', 'high'],
            // Natural
            ['natural', 'Neblina', 'Choque, accidente de tránsito', 'medium'],
            ['natural', 'Poca visibilidad', 'Choque, accidente de tránsito', 'medium'],
            // Entorno / Riesgo Público
            ['entorno_riesgo_publico', 'Piratería', 'Robo, hurto, atraco', 'high'],
            ['entorno_riesgo_publico', 'Polizones', 'Caídas del vehículo, accidentados, fatalidades', 'high'],
            ['entorno_riesgo_publico', 'Paros, huelgas, manifestaciones', 'Incendio del vehículo y mercancía, robo, hurto', 'medium'],
            ['entorno_riesgo_publico', 'Guerrilla en la zona', 'Incendio del vehículo y mercancía, robo, hurto', 'medium'],
        ];

        foreach ($rows as [$condition, $name, $risks, $severity]) {
            HazardType::updateOrCreate(
                ['name' => $name],
                ['condition' => $condition, 'risks' => $risks, 'severity' => $severity],
            );
        }
    }
}
