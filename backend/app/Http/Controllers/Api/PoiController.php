<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\GooglePlacesService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PoiController extends Controller
{
    private const RADIUS_METERS = 4000;

    /** @var array<string, string> */
    private const TYPES = [
        'gas_station' => 'Gasolinera',
        'police'      => 'UPC / Policía',
        'lodging'     => 'Hostal / Hotel',
    ];

    /** Gasolineras, UPC/policía y hostales cerca de la ruta activa — mismo
     * criterio y servicio que el reporte PDF (`GooglePlacesService`), pero en
     * vivo sobre cualquier ruta calculada: el frontend manda puntos ya
     * muestreados de la polilínea (cada ~15km, más separados si la ruta es
     * larga — ver `sampleEveryKm`/`MAX_POI_POINTS` en RoutePlanner.tsx) en
     * vez de mandar la ruta completa. Las consultas (punto × tipo) se piden
     * todas en paralelo (`searchNearbyMany`), no una por una — con rutas
     * largas eso podía tardar decenas de segundos. */
    public function nearbyRoute(Request $request, GooglePlacesService $places): JsonResponse
    {
        $data = $request->validate([
            'points'          => ['required', 'array', 'min:1', 'max:40'],
            'points.*.lat'    => ['required', 'numeric', 'between:-90,90'],
            'points.*.lng'    => ['required', 'numeric', 'between:-180,180'],
        ]);

        $queries = [];
        foreach ($data['points'] as $point) {
            foreach (array_keys(self::TYPES) as $type) {
                $queries[] = ['lat' => (float) $point['lat'], 'lng' => (float) $point['lng'], 'type' => $type];
            }
        }

        $pois = [];
        $vistos = [];

        foreach ($places->searchNearbyMany($queries, self::RADIUS_METERS, 5) as $p) {
            // Redondeado a ~11m de precisión — dedupe del mismo lugar
            // encontrado desde 2 puntos de muestreo cercanos.
            $clave = round($p['lat'], 4) . ',' . round($p['lng'], 4);
            if (isset($vistos[$clave])) {
                continue;
            }
            $vistos[$clave] = true;
            $pois[] = [
                'name'    => $p['name'],
                'lat'     => $p['lat'],
                'lng'     => $p['lng'],
                'address' => $p['address'],
                'tipo'    => self::TYPES[$p['type']] ?? $p['type'],
            ];
        }

        return response()->json(['pois' => $pois]);
    }
}
