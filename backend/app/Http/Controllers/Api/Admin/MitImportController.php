<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
    public function route(Request $request): JsonResponse
    {
        // ?force=1 recalcula TAMBIÉN los tramos que ya tienen ruta_polyline —
        // necesario tras un cambio de formato/lógica de trazado (ej. pasar de
        // `overview_polyline` a la polyline de cada `step`); sin esto, los ya
        // calculados con el formato/lógica anterior quedarían obsoletos para
        // siempre, ya que la corrida normal solo procesa los `null`.
        Artisan::call('mit:route', ['--force' => $request->boolean('force')]);

        return response()->json(['route' => trim(Artisan::output())]);
    }
}
