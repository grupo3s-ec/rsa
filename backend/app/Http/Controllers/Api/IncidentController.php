<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreIncidentRequest;
use App\Http\Resources\IncidentResource;
use App\Models\Incident;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

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
        $incident = Incident::query()->create($request->validated());

        return IncidentResource::make($incident);
    }

    public function show(Incident $incident): IncidentResource
    {
        return IncidentResource::make($incident);
    }

    public function update(StoreIncidentRequest $request, Incident $incident): IncidentResource
    {
        $incident->update($request->validated());

        return IncidentResource::make($incident->refresh());
    }

    public function destroy(Incident $incident): never
    {
        abort(405, 'Incident deletion is not available in the MVP.');
    }
}