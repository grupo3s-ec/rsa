<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreIncidentRequest;
use App\Http\Resources\IncidentResource;
use App\Models\Incident;
use App\Models\IncidentHistory;
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
            $incident = Incident::query()->create($request->validated());

            IncidentHistory::query()->create([
                'incident_id' => $incident->id,
                'user_id'     => $request->user()?->id,
                'from_status' => null,
                'to_status'   => $incident->status ?? 'open',
            ]);

            return $incident;
        });

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

            $incident->update($request->validated());

            $newStatus = $incident->fresh()->status;

            if ($previousStatus !== $newStatus) {
                IncidentHistory::query()->create([
                    'incident_id' => $incident->id,
                    'user_id'     => $request->user()?->id,
                    'from_status' => $previousStatus,
                    'to_status'   => $newStatus,
                    'note'        => $request->input('note'),
                ]);
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
}
