<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Artisan;

class AntImportController extends Controller
{
    /** Corre `ant:import` en producción — Render free tier no da acceso a
     * shell, así que este es el modo de disparar la carga del histórico de
     * siniestros ANT. Solo admin. Se re-ejecuta cada vez que se sube un
     * archivo nuevo (mensual): reemplaza la tabla completa, no acumula. */
    public function run(): JsonResponse
    {
        Artisan::call('ant:import');

        return response()->json(['import' => trim(Artisan::output())]);
    }
}
