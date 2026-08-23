<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\UserSavedRoute;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class SavedRouteController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $routes = UserSavedRoute::query()
            ->where('user_id', $request->user()->id)
            ->orderBy('nombre')
            ->get();

        return response()->json($routes);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nombre' => ['required', 'string', 'max:60'],
            // 'list' exige un array secuencial (índices 0..n-1) — sin esto,
            // un objeto asociativo ({"a":{...},"b":{...}}) pasaba 'array' y
            // 'min:2' igual, y luego el frontend (`route.waypoints.map`)
            // reventaba con TypeError al cargar el favorito.
            'waypoints' => ['required', 'array', 'list', 'min:2', 'max:8'],
            'waypoints.*.lat' => ['required', 'numeric', 'between:-90,90'],
            'waypoints.*.lng' => ['required', 'numeric', 'between:-180,180'],
            'waypoints.*.address' => ['nullable', 'string', 'max:200'],
            'waypoints.*.placeId' => ['nullable', 'string', 'max:200'],
        ]);

        // La tabla tiene un unique(user_id, nombre) — sin este chequeo previo,
        // reguardar un nombre ya usado (el flujo natural para "actualizar" una
        // ruta favorita, no hay endpoint de update) tiraba una QueryException
        // sin capturar → 500 "Server Error" genérico en vez de un mensaje
        // claro. Chequeo manual (en vez de Rule::unique) para poder devolver
        // un mensaje de nivel superior específico — el de ValidationException
        // siempre es el genérico "The given data was invalid.".
        $exists = UserSavedRoute::query()
            ->where('user_id', $request->user()->id)
            ->where('nombre', $data['nombre'])
            ->exists();

        if ($exists) {
            return response()->json(['message' => 'Ya tienes una ruta guardada con ese nombre.'], 422);
        }

        $route = UserSavedRoute::query()->create([
            'user_id' => $request->user()->id,
            'nombre' => $data['nombre'],
            'waypoints' => $data['waypoints'],
        ]);

        return response()->json($route, 201);
    }

    public function destroy(Request $request, UserSavedRoute $savedRoute): JsonResponse
    {
        Gate::allowIf(fn () => $savedRoute->user_id === $request->user()->id);

        $savedRoute->delete();

        return response()->json(null, 204);
    }
}
