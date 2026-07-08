<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreIncidentRequest;
use App\Http\Resources\IncidentResource;
use App\Models\Incident;
use App\Models\IncidentHistory;
use App\Services\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class IncidentController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        $incidents = Incident::query()
            ->latest()
            ->paginate(50);

        return IncidentResource::collection($incidents);
    }

    public function store(StoreIncidentRequest $request): IncidentResource
    {
        $incident = DB::transaction(function () use ($request): Incident {
            $incident = Incident::query()->create($this->withRisk($request->validated()));

            IncidentHistory::query()->create([
                'incident_id' => $incident->id,
                'user_id'     => $request->user()?->id,
                'from_status' => null,
                'to_status'   => $incident->status ?? 'open',
            ]);

            return $incident;
        });

        Audit::log('incident.create', 'incident', $incident->id, $incident->title);

        return IncidentResource::make($incident);
    }

    public function show(Incident $incident): IncidentResource
    {
        return IncidentResource::make($incident);
    }

    public function update(StoreIncidentRequest $request, Incident $incident): IncidentResource
    {
        $incident = DB::transaction(function () use ($request, $incident): Incident {
            $previousStatus = $incident->status;

            $incident->update($this->withRisk($request->validated(), $incident));

            $newStatus = $incident->fresh()->status;

            if ($previousStatus !== $newStatus) {
                IncidentHistory::query()->create([
                    'incident_id' => $incident->id,
                    'user_id'     => $request->user()?->id,
                    'from_status' => $previousStatus,
                    'to_status'   => $newStatus,
                    'note'        => $request->input('note'),
                ]);
                Audit::log('incident.status_change', 'incident', $incident->id, "{$incident->title}: {$previousStatus} → {$newStatus}");
            }

            return $incident->refresh();
        });

        return IncidentResource::make($incident);
    }

    public function history(Incident $incident): JsonResponse
    {
        $history = $incident->history()
            ->with('user:id,name')
            ->orderByDesc('created_at')
            ->get(['id', 'incident_id', 'user_id', 'from_status', 'to_status', 'note', 'created_at']);

        return response()->json($history);
    }

    public function destroy(Incident $incident): never
    {
        abort(405, 'Incident deletion is not available in the MVP.');
    }

    /**
     * Matriz ISO 31000: índice [probabilidad][impacto] → nivel de riesgo.
     *
     * @var array<int, array<int, string>>
     */
    private const RISK_MATRIX = [
        1 => [1 => 'muy_bajo', 2 => 'muy_bajo', 3 => 'bajo',     4 => 'medio',    5 => 'medio'   ],
        2 => [1 => 'muy_bajo', 2 => 'medio',    3 => 'medio',    4 => 'alto',     5 => 'alto'    ],
        3 => [1 => 'bajo',     2 => 'medio',    3 => 'alto',     4 => 'alto',     5 => 'muy_alto'],
        4 => [1 => 'medio',    2 => 'alto',     3 => 'alto',     4 => 'muy_alto', 5 => 'extremo' ],
        5 => [1 => 'medio',    2 => 'alto',     3 => 'muy_alto', 4 => 'extremo',  5 => 'extremo' ],
    ];

    /**
     * Agrega risk_score y risk_level a los datos validados si hay probabilidad e impacto.
     * En PATCH, complementa con los valores actuales del incidente si no se envían.
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    private function withRisk(array $data, ?Incident $existing = null): array
    {
        $p = isset($data['probability']) ? (int) $data['probability'] : ($existing?->probability);
        $i = isset($data['impact'])      ? (int) $data['impact']      : ($existing?->impact);

        if ($p !== null && $i !== null && $p >= 1 && $p <= 5 && $i >= 1 && $i <= 5) {
            $data['risk_score'] = $p * $i;
            $data['risk_level'] = self::RISK_MATRIX[$p][$i];
        }

        return $data;
    }
}
