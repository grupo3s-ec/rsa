<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Incident;
use App\Services\GeotabService;
use DateTime;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class GeotabController extends Controller
{
    public function __construct(private readonly GeotabService $geotab) {}

    /** Verifica si las credenciales están configuradas y si la conexión funciona. */
    public function status(): JsonResponse
    {
        if (! $this->geotab->isConfigured()) {
            return response()->json([
                'configured' => false,
                'message'    => 'Variables GEOTAB_USERNAME, GEOTAB_PASSWORD y GEOTAB_DATABASE no configuradas en .env',
            ]);
        }

        try {
            $this->geotab->authenticate();

            return response()->json(['configured' => true, 'connected' => true]);
        } catch (RuntimeException $e) {
            return response()->json([
                'configured' => true,
                'connected'  => false,
                'error'      => $e->getMessage(),
            ]);
        }
    }

    /** Lista los dispositivos (vehículos) disponibles en la cuenta Geotab. */
    public function devices(): JsonResponse
    {
        if (! $this->geotab->isConfigured()) {
            return response()->json(['error' => 'Credenciales Geotab no configuradas.'], 422);
        }

        try {
            $raw = $this->geotab->getDevices();

            $devices = array_map(fn ($d) => [
                'id'           => $d['id'] ?? null,
                'name'         => $d['name'] ?? 'Sin nombre',
                'serialNumber' => $d['serialNumber'] ?? null,
                'licensePlate' => $d['licensePlate'] ?? null,
                'comment'      => $d['comment'] ?? null,
            ], $raw);

            return response()->json($devices);
        } catch (RuntimeException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    /**
     * Sincroniza ExceptionEvents de Geotab como incidentes en la base de datos.
     *
     * Body JSON:
     *   from_date: string (Y-m-d)
     *   to_date:   string (Y-m-d)
     *   device_id: string|null
     */
    public function sync(Request $request): JsonResponse
    {
        if (! $this->geotab->isConfigured()) {
            return response()->json(['error' => 'Credenciales Geotab no configuradas.'], 422);
        }

        $validated = $request->validate([
            'from_date' => ['required', 'date_format:Y-m-d'],
            'to_date'   => ['required', 'date_format:Y-m-d', 'after_or_equal:from_date'],
            'device_id' => ['nullable', 'string', 'max:64'],
        ]);

        try {
            $rules = collect($this->geotab->getRules())
                ->keyBy('id')
                ->map(fn ($r) => $r['name'] ?? 'Unknown');

            $fromIso = (new DateTime($validated['from_date']))->format('Y-m-d\T00:00:00.000\Z');
            $toIso   = (new DateTime($validated['to_date']))->format('Y-m-d\T23:59:59.999\Z');

            $events = $this->geotab->getExceptionEvents(
                $fromIso,
                $toIso,
                $validated['device_id'] ?? null,
            );

            $created = 0;
            $skipped = 0;

            foreach ($events as $event) {
                $geotabId = $event['id'] ?? null;

                if ($geotabId === null) {
                    continue;
                }

                if (Incident::where('geotab_exception_event_id', $geotabId)->exists()) {
                    $skipped++;
                    continue;
                }

                $lat = $event['latitude']  ?? null;
                $lng = $event['longitude'] ?? null;

                if ($lat === null || $lng === null) {
                    continue;
                }

                $ruleName = $rules->get($event['rule']['id'] ?? '') ?? 'Unknown';
                [$type, $severity] = $this->mapRule($ruleName);

                $occurredAt = isset($event['activeFrom'])
                    ? (new DateTime($event['activeFrom']))->format('Y-m-d H:i:s')
                    : null;

                Incident::create([
                    'title'                     => $this->buildTitle($ruleName, $type),
                    'type'                      => $type,
                    'severity'                  => $severity,
                    'description'               => "Evento Geotab — Regla: {$ruleName}. Dispositivo: " . ($event['device']['id'] ?? 'N/A'),
                    'latitude'                  => $lat,
                    'longitude'                 => $lng,
                    'source'                    => 'geotab',
                    'occurred_at'               => $occurredAt,
                    'status'                    => 'open',
                    'geotab_exception_event_id' => $geotabId,
                    'geotab_device_id'          => $event['device']['id'] ?? null,
                    'geotab_rule_id'            => $event['rule']['id'] ?? null,
                ]);

                $created++;
            }

            return response()->json([
                'events_found' => count($events),
                'created'      => $created,
                'skipped'      => $skipped,
            ]);
        } catch (RuntimeException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    /** Mapea el nombre de la regla Geotab al tipo e severidad de incidente RSA. */
    private function mapRule(string $ruleName): array
    {
        $n = strtolower($ruleName);

        if (str_contains($n, 'collision') || str_contains($n, 'rollover') || str_contains($n, 'impact')) {
            return ['accident', 'critical'];
        }
        if (str_contains($n, 'harsh') || str_contains($n, 'brake') || str_contains($n, 'braking')) {
            return ['accident', 'high'];
        }
        if (str_contains($n, 'distract') || str_contains($n, 'drowsy') || str_contains($n, 'phone')) {
            return ['risk', 'high'];
        }
        if (str_contains($n, 'speed') || str_contains($n, 'tailgat') || str_contains($n, 'following')) {
            return ['risk', 'medium'];
        }
        if (str_contains($n, 'lane') || str_contains($n, 'departure') || str_contains($n, 'swerv')) {
            return ['risk', 'medium'];
        }
        if (str_contains($n, 'seatbelt') || str_contains($n, 'seat_belt') || str_contains($n, 'seat belt')) {
            return ['risk', 'low'];
        }
        if (str_contains($n, 'stop') || str_contains($n, 'idle') || str_contains($n, 'checkpoint')) {
            return ['checkpoint', 'low'];
        }

        return ['risk', 'medium'];
    }

    private function buildTitle(string $ruleName, string $type): string
    {
        $labels = [
            'accident'    => 'Accidente',
            'risk'        => 'Riesgo vial',
            'checkpoint'  => 'Control vial',
            'road_damage' => 'Daño vial',
            'landslide'   => 'Derrumbe',
            'closure'     => 'Cierre vial',
            'assistance'  => 'Asistencia',
        ];

        return ($labels[$type] ?? 'Incidente') . ': ' . $ruleName;
    }
}
