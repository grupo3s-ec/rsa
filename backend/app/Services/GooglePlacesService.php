<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Places API (New) — usada para encontrar puntos de interés reales de Google
 * Maps (gasolineras, UPC/policía, paradas) cerca de un punto de la ruta, en
 * vez de mantener una base de datos aparte de esos lugares: ya vienen
 * indicados por los propios usuarios de Google Maps.
 */
class GooglePlacesService
{
    private const ENDPOINT = 'https://places.googleapis.com/v1/places:searchNearby';

    /**
     * @param array<int, string> $includedTypes ej. ['gas_station'], ['police']
     * @return array<int, array{name: string, lat: float, lng: float, address: string}>
     */
    public function searchNearby(float $lat, float $lng, int $radiusMeters, array $includedTypes, int $maxResults = 5): array
    {
        $key = (string) config('services.google_maps.server_key');

        if ($key === '') {
            Log::warning('GooglePlacesService: GOOGLE_MAPS_SERVER_KEY no configurada.');

            return [];
        }

        try {
            $response = Http::timeout(10)
                ->withHeaders([
                    'Content-Type'      => 'application/json',
                    'X-Goog-Api-Key'    => $key,
                    'X-Goog-FieldMask'  => 'places.displayName,places.location,places.formattedAddress',
                ])
                ->post(self::ENDPOINT, [
                    'locationRestriction' => [
                        'circle' => [
                            'center' => ['latitude' => $lat, 'longitude' => $lng],
                            'radius' => min(50000, max(1, $radiusMeters)),
                        ],
                    ],
                    'includedTypes'  => $includedTypes,
                    'maxResultCount' => min(20, max(1, $maxResults)),
                    'rankPreference' => 'DISTANCE',
                ]);
        } catch (\Throwable $e) {
            Log::warning("GooglePlacesService: fallo de red — {$e->getMessage()}");

            return [];
        }

        if (!$response->successful()) {
            Log::warning('GooglePlacesService: respuesta no exitosa', ['status' => $response->status(), 'body' => $response->body()]);

            return [];
        }

        $places = $response->json('places') ?? [];

        return array_map(static fn (array $p) => [
            'name'    => $p['displayName']['text'] ?? 'Sin nombre',
            'lat'     => (float) ($p['location']['latitude'] ?? 0),
            'lng'     => (float) ($p['location']['longitude'] ?? 0),
            'address' => $p['formattedAddress'] ?? '',
        ], $places);
    }

    /**
     * Como `searchNearby`, pero para varias consultas (punto × tipo) a la
     * vez con `Http::pool` en vez de secuencial — una ruta larga puede tener
     * varias decenas de consultas, y hacerlas una por una puede tardar
     * decenas de segundos y toparse con el timeout del proxy (mismo tipo de
     * problema que el cold-start de Render, pero por acumulación en vez de
     * por arranque en frío).
     *
     * @param array<int, array{lat: float, lng: float, type: string}> $queries
     * @return array<int, array{name: string, lat: float, lng: float, address: string, type: string}>
     */
    public function searchNearbyMany(array $queries, int $radiusMeters, int $maxResults = 5): array
    {
        if ($queries === []) {
            return [];
        }

        $key = (string) config('services.google_maps.server_key');
        if ($key === '') {
            Log::warning('GooglePlacesService: GOOGLE_MAPS_SERVER_KEY no configurada.');

            return [];
        }

        $radius = min(50000, max(1, $radiusMeters));
        $count  = min(20, max(1, $maxResults));

        try {
            $responses = Http::pool(fn (\Illuminate\Http\Client\Pool $pool) => array_map(
                static fn (array $q, int $i) => $pool->as((string) $i)
                    ->timeout(10)
                    ->withHeaders([
                        'Content-Type'      => 'application/json',
                        'X-Goog-Api-Key'    => $key,
                        'X-Goog-FieldMask'  => 'places.displayName,places.location,places.formattedAddress',
                    ])
                    ->post(self::ENDPOINT, [
                        'locationRestriction' => [
                            'circle' => [
                                'center' => ['latitude' => $q['lat'], 'longitude' => $q['lng']],
                                'radius' => $radius,
                            ],
                        ],
                        'includedTypes'  => [$q['type']],
                        'maxResultCount' => $count,
                        'rankPreference' => 'DISTANCE',
                    ]),
                $queries,
                array_keys($queries),
            ));
        } catch (\Throwable $e) {
            Log::warning("GooglePlacesService: fallo de red en pool — {$e->getMessage()}");

            return [];
        }

        $results = [];
        foreach ($queries as $i => $q) {
            $response = $responses[(string) $i] ?? null;
            // Una respuesta individual del pool puede venir como excepción de
            // conexión en vez de Response — no aborta el resto del pool.
            if (!$response instanceof \Illuminate\Http\Client\Response || !$response->successful()) {
                continue;
            }
            $places = $response->json('places') ?? [];
            foreach ($places as $p) {
                $results[] = [
                    'name'    => $p['displayName']['text'] ?? 'Sin nombre',
                    'lat'     => (float) ($p['location']['latitude'] ?? 0),
                    'lng'     => (float) ($p['location']['longitude'] ?? 0),
                    'address' => $p['formattedAddress'] ?? '',
                    'type'    => $q['type'],
                ];
            }
        }

        return $results;
    }
}
