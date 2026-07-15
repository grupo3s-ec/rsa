<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GoogleDirectionsService
{
    private const ENDPOINT = 'https://maps.googleapis.com/maps/api/directions/json';

    // Mismos estados "no reintentables" que `GoogleGeocodingService` — cuota
    // agotada o config inválida, a diferencia de ZERO_RESULTS (no hay ruta por
    // carretera entre esos dos puntos, que es una respuesta null legítima).
    private const ESTADOS_NO_REINTENTABLES = ['OVER_QUERY_LIMIT', 'OVER_DAILY_LIMIT', 'REQUEST_DENIED'];

    /** Pide a Directions API la ruta por carretera entre dos puntos y devuelve
     * su polyline codificada (formato estándar de Google, la misma que decodifica
     * `google.maps.geometry.encoding.decodePath` en el frontend) — o null si
     * genuinamente no hay ruta conocida entre esos puntos, o si la key no está
     * configurada. Lanza `GoogleDirectionsTransientException` ante cuota
     * agotada, rechazo de la API, o fallo de red/timeout. */
    public function overviewPolyline(float $originLat, float $originLng, float $destLat, float $destLng): ?string
    {
        $key = (string) config('services.google_maps.server_key');

        if ($key === '') {
            Log::warning('GoogleDirectionsService: GOOGLE_MAPS_SERVER_KEY no configurada.');

            return null;
        }

        try {
            $response = Http::timeout(10)->get(self::ENDPOINT, [
                'origin'      => "{$originLat},{$originLng}",
                'destination' => "{$destLat},{$destLng}",
                'mode'        => 'driving',
                'key'         => $key,
            ]);
        } catch (\Throwable $e) {
            throw new GoogleDirectionsTransientException("Fallo de red al pedir la ruta: {$e->getMessage()}", previous: $e);
        }

        $json = $response->json();
        $status = $json['status'] ?? null;

        if (in_array($status, self::ESTADOS_NO_REINTENTABLES, true)) {
            throw new GoogleDirectionsTransientException(
                "Directions API devolvió {$status}" . (isset($json['error_message']) ? ": {$json['error_message']}" : ''),
            );
        }

        if ($status !== 'OK') {
            return null;
        }

        $points = $json['routes'][0]['overview_polyline']['points'] ?? null;

        return is_string($points) && $points !== '' ? $points : null;
    }
}
