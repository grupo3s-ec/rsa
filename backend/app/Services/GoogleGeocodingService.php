<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GoogleGeocodingService
{
    private const ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';

    // Ecuador continental (excluye Galápagos, ~1000 km al oeste). Los boletines
    // MIT/MTOP son exclusivamente sobre la Red Vial Estatal continental, así que
    // cualquier resultado más al oeste que esto es necesariamente un lugar
    // homónimo mal resuelto (ej. "El Progreso" también existe en Galápagos),
    // no una ubicación real del boletín — se descarta en vez de aceptarla.
    private const CONTINENTAL_LNG_MIN = -81.5;
    private const BOUNDS_SW = ['lat' => -5.0, 'lng' => -81.1];
    private const BOUNDS_NE = ['lat' => 1.5,  'lng' => -75.2];

    // Estados de la Geocoding API que significan "esto no volverá a funcionar
    // solo": la cuota se agotó o la key/config tiene un problema. Se
    // distinguen de ZERO_RESULTS (no existe ese lugar — null es la respuesta
    // correcta) porque si se tratan igual, una corrida que se queda sin cuota
    // a la mitad marca el resto de tramos como 'fallido' permanentemente
    // (mit:geocode solo reintenta filas 'pendiente').
    private const ESTADOS_NO_REINTENTABLES = ['OVER_QUERY_LIMIT', 'OVER_DAILY_LIMIT', 'REQUEST_DENIED'];

    /** Geocodifica un nombre de lugar (sesgado a Ecuador continental). Devuelve
     * null si genuinamente no hay resultado (o cae fuera de Ecuador continental
     * — un homónimo mal resuelto), o si la key no está configurada. Lanza
     * `GoogleGeocodingTransientException` ante cuota agotada, rechazo de la API,
     * o fallo de red/timeout — eso NO es "sin resultado", es una corrida entera
     * a detener antes de que marque de más filas como 'fallido' sin haberlo sido. */
    public function geocode(string $placeName): ?array
    {
        $key = (string) config('services.google_maps.server_key');

        if ($key === '') {
            Log::warning('GoogleGeocodingService: GOOGLE_MAPS_SERVER_KEY no configurada.');

            return null;
        }

        try {
            $response = Http::timeout(10)->get(self::ENDPOINT, [
                'address' => $placeName . ', Ecuador',
                'region'  => 'ec',
                'bounds'  => sprintf(
                    '%f,%f|%f,%f',
                    self::BOUNDS_SW['lat'], self::BOUNDS_SW['lng'],
                    self::BOUNDS_NE['lat'], self::BOUNDS_NE['lng'],
                ),
                'key' => $key,
            ]);
        } catch (\Throwable $e) {
            throw new GoogleGeocodingTransientException("Fallo de red al geocodificar: {$e->getMessage()}", previous: $e);
        }

        $json = $response->json();
        $status = $json['status'] ?? null;

        if (in_array($status, self::ESTADOS_NO_REINTENTABLES, true)) {
            throw new GoogleGeocodingTransientException(
                "Geocoding API devolvió {$status}" . (isset($json['error_message']) ? ": {$json['error_message']}" : ''),
            );
        }

        if ($status !== 'OK') {
            return null;
        }

        $location = $json['results'][0]['geometry']['location'] ?? null;

        if (!is_array($location) || !isset($location['lat'], $location['lng'])) {
            return null;
        }

        $lat = (float) $location['lat'];
        $lng = (float) $location['lng'];

        if (!$this->dentroDeEcuadorContinental($lat, $lng)) {
            Log::warning('GoogleGeocodingService: resultado fuera de Ecuador continental, descartado.', [
                'place' => $placeName, 'lat' => $lat, 'lng' => $lng,
            ]);

            return null;
        }

        return ['lat' => $lat, 'lng' => $lng];
    }

    private function dentroDeEcuadorContinental(float $lat, float $lng): bool
    {
        return $lat >= self::BOUNDS_SW['lat'] && $lat <= self::BOUNDS_NE['lat']
            && $lng >= self::CONTINENTAL_LNG_MIN && $lng <= self::BOUNDS_NE['lng'];
    }
}
