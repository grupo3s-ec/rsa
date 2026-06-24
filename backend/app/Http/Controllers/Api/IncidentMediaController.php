<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Incident;
use App\Models\IncidentMedia;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class IncidentMediaController extends Controller
{
    public function upload(Request $request, Incident $incident): JsonResponse
    {
        $data = $request->validate([
            'file'       => ['required', 'file', 'mimes:jpeg,jpg,png,gif,webp', 'max:5120'],
            'media_type' => ['sometimes', 'string', 'in:photo,video'],
        ]);

        /** @var \Illuminate\Http\UploadedFile $file */
        $file     = $data['file'];
        $ext      = strtolower($file->getClientOriginalExtension() ?: 'jpg');
        $key      = "incidents/{$incident->id}/" . Str::uuid() . ".{$ext}";
        $uploaded = false;

        try {
            $path   = $file->getRealPath();
            if ($path === false) {
                throw new \RuntimeException('No se pudo acceder al archivo temporal.');
            }
            $stream = fopen($path, 'r');
            Storage::disk('r2')->put($key, $stream);
            $uploaded = true;

            $baseUrl   = rtrim((string) config('filesystems.disks.r2.url', ''), '/');
            $publicUrl = $baseUrl ? "{$baseUrl}/{$key}" : $key;

            $media = $incident->media()->create([
                'url'        => $publicUrl,
                'media_type' => $data['media_type'] ?? 'photo',
                'file_name'  => $file->getClientOriginalName(),
                'file_size'  => $file->getSize(),
            ]);

            return response()->json($media, 201);
        } catch (\Throwable) {
            if ($uploaded) {
                Storage::disk('r2')->delete($key);
            }
            return response()->json(['message' => 'No se pudo subir el archivo.'], 500);
        }
    }

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
