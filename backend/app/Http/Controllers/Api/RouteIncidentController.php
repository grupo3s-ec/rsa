<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\IncidentResource;
use App\Models\Incident;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class RouteIncidentController extends Controller
{
    public function __invoke(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'origin_lat' => ['required', 'numeric', 'between:-90,90'],
            'origin_lng' => ['required', 'numeric', 'between:-180,180'],
            'destination_lat' => ['required', 'numeric', 'between:-90,90'],
            'destination_lng' => ['required', 'numeric', 'between:-180,180'],
        ]);

        $margin = 0.25;

        $minLat = min((float) $validated['origin_lat'], (float) $validated['destination_lat']) - $margin;
        $maxLat = max((float) $validated['origin_lat'], (float) $validated['destination_lat']) + $margin;
        $minLng = min((float) $validated['origin_lng'], (float) $validated['destination_lng']) - $margin;
        $maxLng = max((float) $validated['origin_lng'], (float) $validated['destination_lng']) + $margin;

        $incidents = Incident::query()
            ->whereBetween('latitude', [$minLat, $maxLat])
            ->whereBetween('longitude', [$minLng, $maxLng])
            ->whereIn('status', ['open', 'in_progress'])
            ->latest()
            ->get();

        return IncidentResource::collection($incidents);
    }
}