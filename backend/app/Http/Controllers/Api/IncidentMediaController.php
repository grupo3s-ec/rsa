<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Incident;
use App\Models\IncidentMedia;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class IncidentMediaController extends Controller
{
    public function index(Incident $incident): JsonResponse
    {
        return response()->json(
            $incident->media()->orderBy('created_at')->get()
        );
    }

    public function store(Request $request, Incident $incident): JsonResponse
    {
        $data = $request->validate([
            'url'        => ['required', 'url', 'max:2048'],
            'media_type' => ['sometimes', 'string', 'in:photo,video'],
            'file_name'  => ['nullable', 'string', 'max:255'],
        ]);

        $media = $incident->media()->create([
            'url'        => $data['url'],
            'media_type' => $data['media_type'] ?? 'photo',
            'file_name'  => $data['file_name'] ?? null,
        ]);

        return response()->json($media, 201);
    }

    public function destroy(Incident $incident, IncidentMedia $media): JsonResponse
    {
        abort_if($media->incident_id !== $incident->id, 404);

        $media->delete();

        return response()->json(null, 204);
    }
}
