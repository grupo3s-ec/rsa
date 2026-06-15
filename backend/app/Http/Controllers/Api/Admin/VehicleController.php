<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Vehicle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VehicleController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Vehicle::query()->orderBy('placa')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'placa'  => ['required', 'string', 'max:20', 'unique:vehicles,placa'],
            'marca'  => ['required', 'string', 'max:100'],
            'modelo' => ['required', 'string', 'max:100'],
            'anio'   => ['nullable', 'integer', 'min:1990', 'max:2100'],
            'activo' => ['boolean'],
        ]);

        $vehicle = Vehicle::query()->create($data);

        return response()->json($vehicle, 201);
    }

    public function update(Request $request, Vehicle $vehicle): JsonResponse
    {
        $data = $request->validate([
            'placa'  => ['sometimes', 'string', 'max:20', "unique:vehicles,placa,{$vehicle->id}"],
            'marca'  => ['sometimes', 'string', 'max:100'],
            'modelo' => ['sometimes', 'string', 'max:100'],
            'anio'   => ['nullable', 'integer', 'min:1990', 'max:2100'],
            'activo' => ['boolean'],
        ]);

        $vehicle->update($data);

        return response()->json($vehicle->refresh());
    }

    public function destroy(Vehicle $vehicle): JsonResponse
    {
        $vehicle->delete();

        return response()->json(null, 204);
    }
}
