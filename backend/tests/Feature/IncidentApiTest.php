<?php

namespace Tests\Feature;

use App\Models\HazardType;
use App\Models\Incident;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class IncidentApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_lists_incidents(): void
    {
        Incident::factory()->count(3)->create();

        $response = $this->getJson('/api/incidents');

        $response
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonStructure([
                'data' => [
                    '*' => [
                        'id',
                        'title',
                        'type',
                        'severity',
                        'hazard_type_id',
                        'condition',
                        'risks',
                        'description',
                        'latitude',
                        'longitude',
                        'source',
                        'video_url',
                        'occurred_at',
                        'status',
                        'created_at',
                        'updated_at',
                    ],
                ],
            ]);
    }

    public function test_it_shows_an_incident(): void
    {
        $incident = Incident::factory()->create([
            'title' => 'Visible incident',
        ]);

        $response = $this->getJson("/api/incidents/{$incident->id}");

        $response
            ->assertOk()
            ->assertJsonPath('data.id', $incident->id)
            ->assertJsonPath('data.title', 'Visible incident');
    }

    public function test_it_creates_an_incident(): void
    {
        $hazardType = HazardType::factory()->create([
            'name' => 'Curva peligrosa',
            'condition' => 'fisica',
            'risks' => 'Volcamiento',
            'severity' => 'medium',
        ]);

        $payload = [
            'title' => 'Created incident',
            'hazard_type_id' => $hazardType->id,
            'description' => 'Created from test.',
            'latitude' => -0.1900000,
            'longitude' => -78.4800000,
            'source' => 'manual',
            'video_url' => 'https://drive.google.com/file/d/demo-created-reference/view',
            'status' => 'open',
        ];

        $response = $this->postJson('/api/incidents', $payload);

        $response
            ->assertCreated()
            ->assertJsonPath('data.title', 'Created incident')
            ->assertJsonPath('data.hazard_type_id', $hazardType->id)
            ->assertJsonPath('data.type', 'Curva peligrosa')
            ->assertJsonPath('data.severity', 'medium')
            ->assertJsonPath('data.condition', 'fisica')
            ->assertJsonPath('data.risks', 'Volcamiento')
            ->assertJsonPath('data.status', 'open');

        $this->assertDatabaseHas('incidents', [
            'title' => 'Created incident',
            'hazard_type_id' => $hazardType->id,
            'type' => 'Curva peligrosa',
            'severity' => 'medium',
            'source' => 'manual',
            'status' => 'open',
        ]);
    }

    public function test_it_validates_required_fields_when_creating_an_incident(): void
    {
        $response = $this->postJson('/api/incidents', []);

        $response
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'title',
                'hazard_type_id',
                'latitude',
                'longitude',
                'source',
            ]);
    }

    public function test_it_validates_incident_enums(): void
    {
        $payload = [
            'title' => 'Invalid incident',
            'hazard_type_id' => 999999,
            'latitude' => -0.1900000,
            'longitude' => -78.4800000,
            'source' => 'invalid_source',
            'status' => 'invalid_status',
        ];

        $response = $this->postJson('/api/incidents', $payload);

        $response
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'hazard_type_id',
                'source',
                'status',
            ]);
    }
}