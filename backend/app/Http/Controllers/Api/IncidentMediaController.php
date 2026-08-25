<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Incident;
use App\Models\IncidentMedia;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class IncidentMediaController extends Controller
{
    public function upload(Request $request, Incident $incident): JsonResponse
    {
        // `media_type` decide qué formatos/tamaño son válidos — antes el
        // `mimes:` era fijo a formatos de foto sin importar `media_type`, así
        // que "subir video" nunca funcionaba realmente (rechazaba cualquier
        // .mp4/.mov real) aunque el campo lo aceptara como valor.
        $isVideo = $request->input('media_type') === 'video';

        $data = $request->validate([
            // 5MB/sin heic era muy restrictivo para una foto de celular actual
            // (un iPhone guarda en .heic por defecto y pesa 5-12+ MB en alta
            // resolución) — subía el incidente pero la foto fallaba en
            // silencio (ver IncidentCreateDialog.tsx). Video permite más peso
            // (50MB) — hasta unos pocos minutos de clip de celular.
            'file' => $isVideo
                ? ['required', 'file', 'mimes:mp4,mov,webm,avi,quicktime', 'max:51200']
                : ['required', 'file', 'mimes:jpeg,jpg,png,gif,webp,heic,heif', 'max:20480'],
            'media_type' => ['sometimes', 'string', 'in:photo,video'],
        ]);

        /** @var UploadedFile $file */
        $file = $data['file'];
        $ext = strtolower($file->getClientOriginalExtension() ?: 'jpg');
        $key = "incidents/{$incident->id}/".Str::uuid().".{$ext}";
        $uploaded = false;

        try {
            $path = $file->getRealPath();
            if ($path === false) {
                throw new \RuntimeException('No se pudo acceder al archivo temporal.');
            }
            $stream = fopen($path, 'r');
            Storage::disk('r2')->put($key, $stream);
            $uploaded = true;

            $baseUrl = rtrim((string) config('filesystems.disks.r2.url', ''), '/');
            $publicUrl = $baseUrl ? "{$baseUrl}/{$key}" : $key;

            $media = $incident->media()->create([
                'url' => $publicUrl,
                'media_type' => $data['media_type'] ?? 'photo',
                'file_name' => $file->getClientOriginalName(),
                'file_size' => $file->getSize(),
            ]);

            return response()->json($media, 201);
        } catch (\Throwable $e) {
            if ($uploaded) {
                Storage::disk('r2')->delete($key);
            }

            // DIAGNÓSTICO TEMPORAL — se revierte apenas se identifique la causa real.
            return response()->json(['message' => 'No se pudo subir el archivo.', 'debug' => $e->getMessage()], 500);
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
            'url' => ['required', 'url', 'max:2048'],
            'media_type' => ['sometimes', 'string', 'in:photo,video'],
            'file_name' => ['nullable', 'string', 'max:255'],
        ]);

        $media = $incident->media()->create([
            'url' => $data['url'],
            'media_type' => $data['media_type'] ?? 'photo',
            'file_name' => $data['file_name'] ?? null,
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
