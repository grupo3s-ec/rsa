<?php

namespace App\Console\Commands;

use App\Models\MitAdverseEvent;
use App\Services\GoogleDirectionsService;
use App\Services\GoogleDirectionsTransientException;
use Illuminate\Console\Command;

class ComputeMitEventRoutes extends Command
{
    protected $signature = 'mit:route
        {--limit=0 : Máximo de tramos distintos a rutear en esta corrida (0 = sin límite)}
        {--force : Recalcula también los tramos que YA tienen ruta_polyline (ej. tras un cambio de formato/lógica de trazado)}';

    protected $description = 'Calcula (por carretera, vía Directions API) el trazado entre inicio y fin de cada tramo geocodificado del histórico MIT pendiente, para dibujarlo alineado a la vía real en vez de una línea recta';

    /** @var array<string, list<string>|null> */
    private array $cachePorCoordenadas = [];

    public function handle(GoogleDirectionsService $directions): int
    {
        if ((string) config('services.google_maps.server_key') === '') {
            $this->error('GOOGLE_MAPS_SERVER_KEY no está configurada en .env — no se puede calcular la ruta.');

            return self::FAILURE;
        }

        $limit = (int) $this->option('limit');
        $force = (bool) $this->option('force');

        // Igual que `mit:geocode`: agrupamos por tramo textual idéntico, ya que
        // la misma vía crónica se repite en muchos boletines mensuales y
        // comparte el mismo inicio/fin geocodificado — evita decenas de
        // llamadas redundantes a Directions API por el mismo trazado.
        $query = MitAdverseEvent::query()->where('geocoding_status', 'ok');
        if (!$force) {
            $query->whereNull('ruta_polyline');
        }
        $grupos = $query
            ->get(['id', 'tramo', 'inicio_lat', 'inicio_lng', 'fin_lat', 'fin_lng'])
            ->groupBy('tramo');

        $procesados = 0;
        $ok = 0;
        $sinRuta = 0;

        foreach ($grupos as $tramo => $eventos) {
            if ($limit > 0 && $procesados >= $limit) {
                $this->info("Límite de {$limit} tramos alcanzado, el resto queda pendiente.");
                break;
            }

            $primero = $eventos->first();

            try {
                $polylines = $this->rutearConCache(
                    (float) $primero->inicio_lat,
                    (float) $primero->inicio_lng,
                    (float) $primero->fin_lat,
                    (float) $primero->fin_lng,
                    $directions,
                );
            } catch (GoogleDirectionsTransientException $e) {
                // Mismo criterio que `mit:geocode`: un fallo transitorio detiene
                // la corrida entera en vez de dejar el resto sin `ruta_polyline`
                // permanentemente (la próxima corrida los retoma, ya que el
                // filtro es `whereNull('ruta_polyline')`).
                $this->error("Detenido por fallo transitorio de la Directions API: {$e->getMessage()}");
                $this->info("Tramos procesados antes del corte: {$procesados} (ok: {$ok}, sin ruta: {$sinRuta}). El resto queda pendiente para reintentar.");

                return self::FAILURE;
            }

            $procesados++;

            if ($polylines !== null) {
                // JSON, no una sola polyline: el frontend decodifica cada
                // tramo (`step`) por separado y los concatena — más preciso
                // que la `overview_polyline` única (ver doc de `stepPolylines`).
                MitAdverseEvent::query()
                    ->whereIn('id', $eventos->pluck('id'))
                    ->update(['ruta_polyline' => json_encode($polylines)]);
                $ok++;
            } else {
                // Sin ruta conocida entre esos dos puntos (ZERO_RESULTS) — el
                // frontend cae de vuelta a la línea recta para este tramo.
                $sinRuta++;
            }

            // Respetar límites de tasa razonables de la Directions API.
            usleep(200_000);
        }

        $this->info("Tramos procesados: {$procesados} (ok: {$ok}, sin ruta: {$sinRuta}).");

        return self::SUCCESS;
    }

    /** @return list<string>|null */
    private function rutearConCache(
        float $originLat,
        float $originLng,
        float $destLat,
        float $destLng,
        GoogleDirectionsService $directions,
    ): ?array {
        $clave = "{$originLat},{$originLng}|{$destLat},{$destLng}";

        if (!array_key_exists($clave, $this->cachePorCoordenadas)) {
            $this->cachePorCoordenadas[$clave] = $directions->stepPolylines($originLat, $originLng, $destLat, $destLng);
        }

        return $this->cachePorCoordenadas[$clave];
    }
}
