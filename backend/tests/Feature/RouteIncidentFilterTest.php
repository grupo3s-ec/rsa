<?php

namespace Tests\Feature;

use App\Models\Incident;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RouteIncidentFilterTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_returns_open_or_in_progress_incidents_inside_route_bounding_box(): void
    {
        $insideOpen = Incident::factory()->create([
            'title' => 'Inside open',
            'latitude' => -0.1800000,
            'longitude' => -78.4800000,
            'status' => 'open',
        ]);

        $insideInProgress = Incident::factory()->create([
            'title' => 'Inside in progress',
            'latitude' => -0.2200000,
            'longitude' => -78.5000000,
            'status' => 'in_progress',
        ]);

        Incident::factory()->create([
            'title' => 'Inside resolved',
            'latitude' => -0.1900000,
            'longitude' => -78.4900000,
            'status' => 'resolved',
        ]);

        Incident::factory()->create([
            'title' => 'Outside open',
            'latitude' => -1.5000000,
            'longitude' => -79.5000000,
            'status' => 'open',
        ]);

        $response = $this->getJson(
            '/api/routes/incidents?origin_lat=-0.10&origin_lng=-78.50&destination_lat=-0.30&destination_lng=-78.45'
        );

        $response
            ->assertOk()
            ->assertJsonPath('data.0.id', $insideInProgress->id)
            ->assertJsonFragment(['id' => $insideOpen->id])
            ->assertJsonFragment(['id' => $insideInProgress->id])
            ->assertJsonMissing(['title' => 'Inside resolved'])
            ->assertJsonMissing(['title' => 'Outside open']);
    }

    public function test_it_validates_route_coordinates(): void
    {
        $response = $this->getJson('/api/routes/incidents');

        $response
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'origin_lat',
                'origin_lng',
                'destination_lat',
                'destination_lng',
            ]);
    }
}