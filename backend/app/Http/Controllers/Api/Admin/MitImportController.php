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
}
