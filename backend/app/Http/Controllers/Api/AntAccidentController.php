<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AntAccident;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AntAccidentController extends Controller
{
    /** Siniestros de tránsito de la ANT, filtrables por provincia/fecha/tipo —
     * mismo patrón que MitAdverseEventController::index(). */
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'provincias'     => ['sometimes', 'string', 'max:255'],
            'tipo_siniestro' => ['sometimes', 'string', 'max:60'],
            'from'           => ['sometimes', 'date'],
            'to'             => ['sometimes', 'date'],
        ]);

        $query = AntAccident::query()->orderByDesc('fecha')->orderByDesc('id');

        if (!empty($data['provincias'])) {
            $provincias = array_filter(explode(',', $data['provincias']));
            if ($provincias !== []) {
                $query->whereIn('provincia', $provincias);
            }
        }

        if (isset($data['tipo_siniestro']) && $data['tipo_siniestro'] !== '') {
            $query->where('tipo_siniestro', $data['tipo_siniestro']);
        }

        if (isset($data['from']) && $data['from'] !== '') {
            $query->where('fecha', '>=', $data['from']);
        }

        if (isset($data['to']) && $data['to'] !== '') {
            $query->where('fecha', '<=', $data['to']);
        }

        return response()->json($query->paginate(200));
    }

    /** Valores disponibles para poblar los selects de filtro del frontend. */
    public function opciones(): JsonResponse
    {
        return response()->json([
            'tipos_siniestro' => AntAccident::query()
                ->whereNotNull('tipo_siniestro')
                ->distinct()
                ->orderBy('tipo_siniestro')
                ->pluck('tipo_siniestro'),
            'provincias' => AntAccident::query()
                ->whereNotNull('provincia')
                ->distinct()
                ->orderBy('provincia')
                ->pluck('provincia'),
        ]);
    }
}
