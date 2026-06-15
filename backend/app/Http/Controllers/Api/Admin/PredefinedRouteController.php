<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\PredefinedRoute;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PredefinedRouteController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(PredefinedRoute::query()->orderBy('nombre')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nombre'      => ['required', 'string', 'max:200'],
            'descripcion' => ['nullable', 'string'],
            'origen'      => ['required', 'string', 'max:200'],
            'destino'     => ['required', 'string', 'max:200'],
            'activo'      => ['boolean'],
        ]);

        $route = PredefinedRoute::query()->create($data);

        return response()->json($route, 201);
    }

    public function update(Request $request, PredefinedRoute $predefinedRoute): JsonResponse
    {
        $data = $request->validate([
            'nombre'      => ['sometimes', 'string', 'max:200'],
            'descripcion' => ['nullable', 'string'],
            'origen'      => ['sometimes', 'string', 'max:200'],
            'destino'     => ['sometimes', 'string', 'max:200'],
            'activo'      => ['boolean'],
        ]);

        $predefinedRoute->update($data);

        return response()->json($predefinedRoute->refresh());
    }

    public function destroy(PredefinedRoute $predefinedRoute): JsonResponse
    {
        $predefinedRoute->delete();

        return response()->json(null, 204);
    }
}
