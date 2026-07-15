<?php

namespace App\Console\Commands;

use App\Models\MitAdverseEvent;
use App\Services\GoogleGeocodingService;
use App\Services\GoogleGeocodingTransientException;
use App\Services\TramoEndpointParser;
use Illuminate\Console\Command;

class GeocodeMitAdverseEvents extends Command
{
    protected $signature = 'mit:geocode {--limit=0 : Máximo de tramos distintos a geocodificar en esta corrida (0 = sin límite)}';

    protected $description = 'Geocodifica (aproximado, por nombre de lugar) los extremos de cada tramo del histórico MIT pendiente';

    /** @var array<string, array{lat: float, lng: float}|null> */
    private array $cachePorLugar = [];

    public function handle(TramoEndpointParser $parser, GoogleGeocodingService $geocoder): int
    {
        if ((string) config('services.google_maps.server_key') === '') {
            $this->error('GOOGLE_MAPS_SERVER_KEY no está configurada en .env — no se puede geocodificar.');

            return self::FAILURE;
        }

        $limit = (int) $this->option('limit');

        // Agrupamos por tramo textual idéntico: la misma vía crónica se repite
        // en muchos boletines mensuales, así que geocodificar por grupo evita
        // decenas de llamadas redundantes a la API por el mismo lugar.
        $grupos = MitAdverseEvent::query()
            ->where('geocoding_status', 'pendiente')
            ->get(['id', 'tramo'])
            ->groupBy('tramo');

        $procesados = 0;
        $ok = 0;
        $fallidos = 0;

        foreach ($grupos as $tramo => $eventos) {
            if ($limit > 0 && $procesados >= $limit) {
                $this->info("Límite de {$limit} tramos alcanzado, el resto queda pendiente.");
                break;
            }

            [$inicio, $fin] = $parser->endpoints((string) $tramo);

            try {
                $puntoInicio = $inicio !== null ? $this->geocodificarConCache($inicio, $geocoder) : null;
                $puntoFin = $fin !== null ? $this->geocodificarConCache($fin, $geocoder) : null;
            } catch (GoogleGeocodingTransientException $e) {
                // Cuota agotada, la API rechazó la petición, o falló la red: NO
                // es "este lugar no existe" (eso sí sería 'fallido' legítimo).
                // Se detiene la corrida entera dejando el resto en 'pendiente'
                // para reintentar más tarde, en vez de marcar de más filas
                // como 'fallido' permanentemente por un problema transitorio.
                $this->error("Detenido por fallo transitorio de la Geocoding API: {$e->getMessage()}");
                $this->info("Tramos procesados antes del corte: {$procesados} (ok: {$ok}, fallidos: {$fallidos}). El resto queda 'pendiente' para reintentar.");

                return self::FAILURE;
            }

            $procesados++;
            $exito = $puntoInicio !== null && $puntoFin !== null;

            MitAdverseEvent::query()
                ->whereIn('id', $eventos->pluck('id'))
                ->update([
                    'inicio_lat'       => $puntoInicio['lat'] ?? null,
                    'inicio_lng'       => $puntoInicio['lng'] ?? null,
                    'fin_lat'          => $puntoFin['lat'] ?? null,
                    'fin_lng'          => $puntoFin['lng'] ?? null,
                    'geocoding_status' => $exito ? 'ok' : 'fallido',
                ]);

            $exito ? $ok++ : $fallidos++;

            // Respetar límites de tasa razonables de la Geocoding API.
            usleep(200_000);
        }

        $this->info("Tramos procesados: {$procesados} (ok: {$ok}, fallidos: {$fallidos}).");

        return self::SUCCESS;
    }

    /** @return array{lat: float, lng: float}|null */
    private function geocodificarConCache(string $lugar, GoogleGeocodingService $geocoder): ?array
    {
        if (!array_key_exists($lugar, $this->cachePorLugar)) {
            $this->cachePorLugar[$lugar] = $geocoder->geocode($lugar);
        }

        return $this->cachePorLugar[$lugar];
    }
}
