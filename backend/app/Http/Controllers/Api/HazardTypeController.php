<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HazardType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class HazardTypeController extends Controller
{
    public function index(): JsonResponse
    {
        $hazardTypes = HazardType::query()
            ->orderBy('name')
            ->get(['id', 'condition', 'name', 'risks', 'severity']);

        return response()->json(['data' => $hazardTypes]);
    }

    /**
     * Crea un tipo de incidente nuevo "al vuelo" desde el combobox de tipo,
     * cuando el que se necesita no está en el catálogo — así queda guardado
     * en la BD y aparece para todos en futuras selecciones (`index()` de
     * arriba). Find-or-create case-insensitive por nombre: si ya existe uno
     * con ese nombre (con otra capitalización), lo devuelve tal cual en vez
     * de crear un duplicado.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'condition' => ['required', 'string', Rule::in(['fisica', 'natural', 'entorno_riesgo_publico'])],
            'severity' => ['required', 'string', Rule::in(['low', 'medium', 'high', 'critical'])],
            'risks' => ['nullable', 'string', 'max:2000'],
        ]);

        $name = trim($data['name']);

        $existing = HazardType::query()->whereRaw('lower(name) = ?', [mb_strtolower($name)])->first();
        if ($existing) {
            return response()->json($existing->only(['id', 'condition', 'name', 'risks', 'severity']), 200);
        }

        $hazardType = HazardType::query()->create([
            'name' => $name,
            'condition' => $data['condition'],
            'severity' => $data['severity'],
            'risks' => $data['risks'] ?? null,
        ]);

        return response()->json($hazardType->only(['id', 'condition', 'name', 'risks', 'severity']), 201);
    }
}
