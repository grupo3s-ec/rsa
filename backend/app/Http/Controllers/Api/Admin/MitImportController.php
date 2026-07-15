<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Artisan;

class MitImportController extends Controller
{
    /** Corre `mit:import` + `mit:geocode` en producción — Render free tier no
     * da acceso a shell, así que este es el único modo de disparar la carga
     * inicial del histórico MIT/MTOP. Solo admin (mismo middleware que el
     * resto de /api/admin/*), pensado para uso único, no un cron recurrente. */
    public function run(): JsonResponse
    {
        Artisan::call('mit:import');
        $importOutput = Artisan::output();

        Artisan::call('mit:geocode');
        $geocodeOutput = Artisan::output();

        return response()->json([
            'import'  => trim($importOutput),
            'geocode' => trim($geocodeOutput),
        ]);
    }

    /** Corre `mit:route` — calcula el trazado por carretera entre inicio y fin
     * de cada tramo ya geocodificado, para dibujarlo alineado a la vía real en
     * vez de una línea recta. Aparte de `run()` (import+geocode): agrega tiempo
     * de corrida por la llamada extra a Directions API por tramo distinto, y
     * `mit:import` borra y reimporta la tabla en cada corrida (perdiendo
     * `ruta_polyline` calculado antes), así que conviene poder re-disparar
     * solo este paso sin repetir import+geocode. */
    public function route(): JsonResponse
    {
        Artisan::call('mit:route');

        return response()->json(['route' => trim(Artisan::output())]);
    }
}
