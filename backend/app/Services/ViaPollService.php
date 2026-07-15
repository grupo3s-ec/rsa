<?php

namespace App\Services;

use App\Models\ViaStatusEvent;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ViaPollService
{
    private const ECU911_BASE_URL = 'https://ecu911.gob.ec/Services/WSVias/ViasWeb.php';
    private const PAGE_SIZE = 500;
    private const MAX_PAGES = 10; // tope de seguridad: 5000 vías, muy por encima de lo real

    // ECU911 no incluye zona horaria en sus fechas; el servicio es de Ecuador
    // continental, así que se asumen en hora local y se convierten a UTC.
    private const ECU911_TIMEZONE = 'America/Guayaquil';

    /** Consulta ECU911 (paginando hasta agotar resultados), detecta cambios de
     * estado respecto al último evento conocido por vía, y registra un nuevo
     * evento solo cuando el estado cambió. Un `Cache::lock` evita que dos
     * ejecuciones solapadas (ej. un cron externo que se dispara dos veces)
     * generen eventos duplicados.
     *
     * @return int cantidad de eventos nuevos registrados
     */
    public function pollAndRecordChanges(): int
    {
        // Store 'database' explícito: CACHE_STORE por defecto es 'array' (en
        // memoria, no persiste entre requests HTTP separados), lo que haría
        // el lock inútil contra ejecuciones solapadas del cron externo.
        $lock = Cache::store('database')->lock('via-poll-running', 120);

        if (!$lock->get()) {
            Log::info('ViaPollService: poll omitido, ya hay uno en curso.');

            return 0;
        }

        try {
            $vias = $this->fetchAllVias();
            $registered = 0;

            foreach ($vias as $via) {
                try {
                    if ($this->recordIfChanged($via)) {
                        $registered++;
                    }
                } catch (\Throwable $e) {
                    Log::warning('ViaPollService: no se pudo registrar una vía, se omite y se continúa.', [
                        'via_id' => $via['id'] ?? null,
                        'error'  => $e->getMessage(),
                    ]);
                }
            }

            return $registered;
        } finally {
            $lock->release();
        }
    }

    /** Pagina a través de todo el resultado de ECU911 (no solo la primera
     * página) para no perder vías cuando el total supera el tamaño de página.
     *
     * @return array<int, array<string, mixed>>
     */
    private function fetchAllVias(): array
    {
        $all = [];

        for ($page = 0; $page < self::MAX_PAGES; $page++) {
            $start = $page * self::PAGE_SIZE;
            $batch = $this->fetchPage($start);

            if ($batch === []) {
                break;
            }

            $all = [...$all, ...$batch];

            if (count($batch) < self::PAGE_SIZE) {
                break; // última página
            }
        }

        return $all;
    }

    /** @return array<int, array<string, mixed>> */
    private function fetchPage(int $start): array
    {
        try {
            $url = self::ECU911_BASE_URL . '?estado=A&order=modified+DESC'
                . '&limit=' . self::PAGE_SIZE . '&start=' . $start;

            $response = Http::withHeaders([
                'Accept'     => 'application/json, text/plain, */*',
                'Referer'    => 'https://www.ecu911.gob.ec/',
                'User-Agent' => 'Mozilla/5.0 (compatible; RSA/1.0)',
            ])->timeout(15)->get($url);

            $json = $response->json();

            return is_array($json['data'] ?? null) ? $json['data'] : [];
        } catch (\Throwable $e) {
            Log::warning('ViaPollService: fallo al consultar ECU911', ['start' => $start, 'error' => $e->getMessage()]);

            return [];
        }
    }

    /** @param array<string, mixed> $via */
    private function recordIfChanged(array $via): bool
    {
        $viaId = (string) ($via['id'] ?? '');
        if ($viaId === '') {
            return false;
        }

        $estadoActualId = (int) ($via['estado_actual_id'] ?? 0);

        $ultimo = ViaStatusEvent::query()
            ->where('via_ecu911_id', $viaId)
            ->orderByDesc('detected_at')
            ->first();

        if ($ultimo && (int) $ultimo->estado_actual_id === $estadoActualId) {
            return false;
        }

        ViaStatusEvent::query()->create([
            'via_ecu911_id'        => $viaId,
            'descripcion'          => mb_substr((string) ($via['descripcion'] ?? ''), 0, 255),
            'provincia'            => mb_substr($this->stringField($via, 'Provincia', 'descripcion'), 0, 120),
            'canton'               => $this->stringField($via, 'Canton', 'descripcion') !== ''
                ? mb_substr($this->stringField($via, 'Canton', 'descripcion'), 0, 120)
                : null,
            'estado_anterior_id'   => $ultimo?->estado_actual_id,
            'estado_actual_id'     => $estadoActualId,
            'estado_actual_nombre' => mb_substr($this->stringField($via, 'EstadoActual', 'nombre'), 0, 120),
            'observaciones'        => $via['observaciones'] ?? null,
            'via_modified_at'      => $this->parseDate($via['modified'] ?? null),
            'detected_at'          => Carbon::now(),
        ]);

        return true;
    }

    /** Extrae `$via[$key][$sub]` de forma segura: si `$via[$key]` no es un
     * array (ej. ECU911 devuelve un escalar o null), no lanza TypeError. */
    private function stringField(array $via, string $key, string $sub): string
    {
        $nested = $via[$key] ?? null;

        return is_array($nested) ? (string) ($nested[$sub] ?? '') : '';
    }

    private function parseDate(?string $value): ?Carbon
    {
        if (!$value) {
            return null;
        }

        try {
            return Carbon::parse($value, self::ECU911_TIMEZONE)->utc();
        } catch (\Throwable) {
            return null;
        }
    }
}
